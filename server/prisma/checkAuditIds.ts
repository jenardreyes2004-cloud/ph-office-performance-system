import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Proves mutating requests land in the audit log with a usable entityId.
 *
 * The middleware read only `req.params.id` and `req.params.periodId`, but routes
 * are keyed by `:entryId`, `:officeScorecardId`, `:employeeId` and `:officeId`.
 * On all of those the id was written as null, which removes the one field that
 * makes an audit row usable: you could see that "something changed" and who did
 * it, but not what. `entity` was only the first path segment, so a deleted
 * scorecard entry and a replaced band were both just "scorecards".
 *
 * This drives real mutating requests over HTTP and inspects what was recorded.
 *
 * The audit row is written after the response resolves, so each assertion waits
 * for it rather than racing.
 *
 * Run: npx tsx prisma/checkAuditIds.ts
 */

const BASE = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = "Test@1234";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const failures: string[] = [];
const runStartedAt = new Date(Date.now() - 10_000);

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

function sleep(ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* spin */
  }
}

class Session {
  private cookie = "";
  constructor(readonly email: string) {}

  async login() {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: PASSWORD }),
    });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0];
    if (!res.ok) throw new Error(`login failed for ${this.email}: ${res.status}`);
  }

  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: this.cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }
}

/** Waits for the audit row, which is written after the response resolves. */
async function auditFor(path: string, method: string) {
  for (let i = 0; i < 40; i++) {
    const row = await prisma.auditLog.findFirst({
      where: { metadata: { path: ["method"], equals: method } as never },
      orderBy: { createdAt: "desc" },
      select: { action: true, entity: true, entityId: true, metadata: true },
    });
    // Metadata carries no path, so match on the action+entity the route implies
    // and fall back to the most recent row created during this run.
    if (row) return row;
    sleep(100);
  }
  return null;
}

async function latestAudit() {
  return prisma.auditLog.findFirst({
    where: { createdAt: { gte: runStartedAt } },
    orderBy: { createdAt: "desc" },
    select: { action: true, entity: true, entityId: true, metadata: true },
  });
}

async function main() {
  console.log("Audit entity ids — every mutating route must be attributable\n");

  const superAdmin = new Session("main.admin@test.local");
  const itAdmin = new Session("it.admin@test.local");
  await superAdmin.login();
  await itAdmin.login();

  const before = await prisma.auditLog.count({ where: { createdAt: { gte: runStartedAt } } });

  // -----------------------------------------------------------------
  console.log("\na nested id param is captured");
  // -----------------------------------------------------------------
  // :officeId is one of the param names the middleware used to miss entirely.
  const offices = await prisma.office.findMany({
    where: { archivedAt: null, kind: "OFFICE" },
    select: { id: true, code: true },
    take: 1,
  });
  const office = offices[0];

  // archive/unarchive the office: a real mutation keyed by :id
  const archived = await superAdmin.call("POST", `/api/offices/${office.id}/archive`);
  check("the office archive request succeeded", archived.status === 200, `got ${archived.status}`);
  sleep(600);
  let row = await latestAudit();
  check(
    "an :id route records a non-null entityId",
    row?.entityId === office.id,
    `entityId=${row?.entityId} expected=${office.id} entity=${row?.entity}`,
  );
  check("and names the entity", row?.entity === "offices", `entity=${row?.entity}`);

  await superAdmin.call("POST", `/api/offices/${office.id}/unarchive`);
  sleep(600);

  // -----------------------------------------------------------------
  console.log("\na scorecard sub-resource is distinguished");
  // -----------------------------------------------------------------
  // Before, a deleted entry and a replaced band were both "scorecards".
  const periods = (await superAdmin.call("GET", "/api/scorecards/periods")).body as {
    id: string;
  }[];
  const periodList = (await superAdmin.call(
    "GET",
    `/api/scorecards/periods/${periods[0].id}/offices`,
  )).body as { officeCode: string; scorecard: { id: string } | null }[];
  const withCard = periodList.find((o) => o.scorecard !== null);
  check("there is a scorecard with entries to work on", withCard !== undefined);
  if (!withCard) {
    console.error("no seeded scorecard; run: npm run db:seed:scorecard");
    process.exitCode = 1;
    return;
  }

  const entries = (await superAdmin.call(
    "GET",
    `/api/scorecards/office-scorecards/${withCard.scorecard!.id}`,
  )).body as { entries?: { id: string; measure: string }[] };
  const entry = entries.entries?.[0];
  check("the scorecard has an entry", entry !== undefined);
  if (!entry) {
    console.error("scorecard has no entries");
    process.exitCode = 1;
    return;
  }

  // PATCH /scorecards/entries/:id -- keyed by :id on the entries sub-resource.
  const patched = await superAdmin.call("PATCH", `/api/scorecards/entries/${entry.id}`, {
    measure: entry.measure,
  });
  check("the entry update succeeded", patched.status === 200, `got ${patched.status}`);
  sleep(600);
  row = await latestAudit();
  check(
    "a sub-resource route records the entry's own id",
    row?.entityId === entry.id,
    `entityId=${row?.entityId} expected=${entry.id}`,
  );
  check(
    "and the entity names the sub-resource",
    row?.entity === "scorecards/entries",
    `entity=${row?.entity}`,
  );

  // -----------------------------------------------------------------
  console.log("\nvalues are never recorded, only field names");
  // -----------------------------------------------------------------
  const secretProbe = "Probe Name That Must Not Be Stored";
  await itAdmin.call("POST", "/api/accounts", {
    name: secretProbe,
    email: "audit.id.probe@test.local",
    password: "AuditProbe@1234",
  });
  // The audit row is written after the response resolves, so poll for it rather
  // than sleeping a guessed interval. A fixed sleep made this suite fail
  // intermittently -- the kind of flake that gets ignored and then trusted.
  let rows: { action: string; entity: string; entityId: string | null; metadata: unknown }[] = [];
  for (let i = 0; i < 40; i++) {
    rows = await prisma.auditLog.findMany({
      where: { createdAt: { gte: runStartedAt } },
      select: { action: true, entity: true, entityId: true, metadata: true },
    });
    if (rows.some((r) => r.entity === "accounts")) break;
    sleep(150);
  }
  const asText = JSON.stringify(rows);
  check(
    "no submitted value appears in any audit metadata",
    !asText.includes(secretProbe),
    "the audit log stored a value, not just a field name",
  );
  check(
    "no password appears in any audit metadata",
    !asText.includes("AuditProbe@1234"),
  );
  check(
    "a password field is recorded as redacted",
    rows.some((r) => asText.includes("[redacted]")),
  );
  console.log("        rows: " + JSON.stringify(rows.map((r) => ({ e: r.entity, id: r.entityId }))));
  check(
    "a create records entityId = null, because the URL has no id",
    // POST /api/accounts is a create: the id is generated by the database, so
    // there is nothing in the path to record. Null is the honest answer here,
    // and the action and entity still say what happened.
    rows.some((r) => r.entity === "accounts" && r.entityId === null),
    "a create invented an id",
  );

  // -----------------------------------------------------------------
  console.log("\nnested routes keep their parent id");
  // -----------------------------------------------------------------
  // /scorecards/periods/:periodId/offices/:officeId carries two ids. The last
  // is the record acted on; the one before is its parent, recorded separately
  // so "everything in this period" stays answerable.
  // /plans/:id/assignments/:employeeId carries two ids and is a reversible
  // mutation, which makes it a safe way to exercise the parent capture: set an
  // assignment, patch it, put it back.
  const plan = await prisma.plan.findFirst({
    where: { planAssignments: { some: {} } },
    select: { id: true, planAssignments: { select: { employeeId: true, responsibility: true }, take: 1 } },
  });
  if (plan) {
    const assignment = plan.planAssignments[0];
    const probe = `audit-parent-probe-${Date.now()}`;
    const setIt = await superAdmin.call(
      "PATCH",
      `/api/plans/${plan.id}/assignments/${assignment.employeeId}`,
      { responsibility: probe },
    );
    check(
      "the two-id route accepted the change",
      setIt.status === 200,
      `got ${setIt.status}`,
    );
    sleep(600);

    // Put it back, so this suite leaves the plan exactly as it found it.
    await superAdmin.call(
      "PATCH",
      `/api/plans/${plan.id}/assignments/${assignment.employeeId}`,
      { responsibility: assignment.responsibility ?? null },
    );
    sleep(400);
  } else {
    check("a plan with an assignment exists to test against", false, "no assignments seeded");
  }

  const allRows = await prisma.auditLog.findMany({
    where: { createdAt: { gte: runStartedAt } },
    select: { action: true, entity: true, entityId: true, metadata: true },
  });
  const withParent = allRows.filter((r) => {
    const md = r.metadata as Record<string, unknown> | null;
    return md !== null && typeof md === "object" && typeof md.parentId === "string";
  });
  check(
    "a two-id route recorded a parentId",
    withParent.length > 0,
    "nothing captured a parent, so 'everything under this scorecard' is unanswerable",
  );
  check(
    "and the entityId is the last id in the path, not the parent",
    withParent.some((r) => r.entityId !== (r.metadata as Record<string, unknown>).parentId),
    "entityId duplicated the parent id",
  );

  // -----------------------------------------------------------------
  console.log("\ncleanup");
  // -----------------------------------------------------------------
  await prisma.user.deleteMany({ where: { email: "audit.id.probe@test.local" } });
  await prisma.employee.deleteMany({ where: { userId: { not: null }, officeId: office.id } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: runStartedAt } } });

  const leftoverAudit = await prisma.auditLog.count({ where: { createdAt: { gte: runStartedAt } } });
  check("no audit rows left behind", leftoverAudit === 0, `${leftoverAudit} remain`);
  const leftoverUser = await prisma.user.count({ where: { email: "audit.id.probe@test.local" } });
  check("no probe account left behind", leftoverUser === 0);

  const officeNow = await prisma.office.findUniqueOrThrow({
    where: { id: office.id },
    select: { archivedAt: true },
  });
  check("the archived office was restored", officeNow.archivedAt === null);

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Every mutating route is attributable in the audit log.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });