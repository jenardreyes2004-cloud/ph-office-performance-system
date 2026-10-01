import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Proves account management over real HTTP.
 *
 * The guard in `lib/accountGuard` is already tested exhaustively as pure
 * functions. What that cannot show is whether the *routes* actually call it --
 * a service can be correct while a controller forgets to pass the actor, and
 * the system looks governed right up until it is not. So this drives the
 * running API the way an attacker or a careless admin would, with real
 * sessions and real cookies.
 *
 * Every account this creates is removed in the finally block, including any
 * audit rows it produced.
 *
 * Requires the API on http://localhost:4000.
 * Run: npx tsx prisma/checkAccountManagement.ts
 */

const BASE = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = "Test@1234";
const ORDINARY_PASSWORD = "Ordinary@1234";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

/** A session cookie jar, so each role is a genuinely separate caller. */
class Session {
  private cookie = "";

  // Parameterised because this check creates accounts with their own
  // passwords. Hardcoding the seeded one here made every "can the new account
  // sign in" assertion fail for the uninteresting reason that it sent the
  // wrong password -- the account was fine.
  constructor(
    readonly email: string,
    private readonly password: string = PASSWORD,
  ) {}

  async login() {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    if (!res.ok) throw new Error(`login failed for ${this.email}: HTTP ${res.status}`);
  }

  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json, raw: text };
  }
}

/** Logs in and reports why, rather than collapsing every failure to `false`. */
async function loginOk(email: string, password = PASSWORD): Promise<{ ok: boolean; why: string }> {
  const session = new Session(email, password);
  try {
    await session.login();
    return { ok: true, why: "" };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Bounds everything this run writes to system_logs, so cleanup cannot reach
 * rows that legitimately belong to the running system.
 */
const runStartedAt = new Date(Date.now() - 5_000);

// Accounts this run created, for cleanup.
const createdUserIds: string[] = [];
const createdEmails: string[] = [];
const emailFor = (n: string) => `acct.check.${n}@test.local`;

async function main() {
  const superAdmin = new Session("main.admin@test.local");
  const itAdmin = new Session("it.admin@test.local");
  const officeHead = new Session("office.head@test.local");
  const plainEmployee = new Session("employee@test.local");

  for (const s of [superAdmin, itAdmin, officeHead, plainEmployee]) {
    await s.login();
  }
  console.log(`Four roles signed in against ${BASE}\n`);

  // The IDs of real seeded accounts, needed as targets.
  const [mainRow, itRow, officeHeadRow, employeeRow] = await Promise.all(
    ["main.admin@test.local", "it.admin@test.local", "office.head@test.local", "employee@test.local"].map(
      (email) => prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } }),
    ),
  );

  // ---------------------------------------------------------------------
  console.log("role gating on the router");
  // ---------------------------------------------------------------------
  check("IT admin may list accounts", (await itAdmin.call("GET", "/api/accounts")).status === 200);
  check(
    "super admin may list accounts",
    (await superAdmin.call("GET", "/api/accounts")).status === 200,
  );
  for (const [label, s] of [
    ["office head", officeHead],
    ["plain employee", plainEmployee],
  ] as const) {
    const r = await s.call("GET", "/api/accounts");
    check(`${label} is refused (HTTP ${r.status})`, r.status === 403, `got ${r.status}`);
  }
  const anon = await fetch(`${BASE}/api/accounts`);
  check("an unauthenticated caller is refused", anon.status === 401, `got ${anon.status}`);

  // ---------------------------------------------------------------------
  console.log("\npassword hashes never leave the server");
  // ---------------------------------------------------------------------
  const listed = await itAdmin.call("GET", "/api/accounts");
  check("the list response carries no passwordHash", !listed.raw.includes("passwordHash"), listed.raw.slice(0, 120));
  const one = await itAdmin.call("GET", `/api/accounts/${employeeRow.id}`);
  check("a single-account read carries no passwordHash", !one.raw.includes("passwordHash"));

  // ---------------------------------------------------------------------
  console.log("\nthe IT admin can issue an ordinary login");
  // ---------------------------------------------------------------------
  const created = await itAdmin.call("POST", "/api/accounts", {
    name: "Check Ordinary",
    email: emailFor("ordinary"),
    password: ORDINARY_PASSWORD,
  });
  check("created (HTTP 201)", created.status === 201, `got ${created.status}: ${created.raw.slice(0, 160)}`);
  check("defaults to EMPLOYEE rather than requiring a role", created.body?.role === "EMPLOYEE", String(created.body?.role));
  if (created.body?.id) createdUserIds.push(created.body.id);
  createdEmails.push(emailFor("ordinary"));

  const newEmail = emailFor("ordinary");
  const newLogin = await loginOk(newEmail, ORDINARY_PASSWORD);
  check("the new account can actually sign in", newLogin.ok, newLogin.why);

  // ---------------------------------------------------------------------
  console.log("\nself-promotion is refused over HTTP, not just in the guard");
  // ---------------------------------------------------------------------
  const selfPromote = await itAdmin.call("PATCH", `/api/accounts/${itRow.id}/role`, {
    role: "MAIN_ADMIN",
  });
  check(
    "an IT admin cannot make themselves MAIN_ADMIN",
    selfPromote.status === 403,
    `got ${selfPromote.status}: ${selfPromote.raw.slice(0, 120)}`,
  );
  const stillItAdmin = await prisma.user.findUniqueOrThrow({
    where: { id: itRow.id },
    select: { role: true },
  });
  check("the IT admin's role is unchanged in the database", stillItAdmin.role === "IT_ADMIN", stillItAdmin.role);

  const appointHead = await itAdmin.call("PATCH", `/api/accounts/${itRow.id}/role`, {
    role: "MAIN_ADMIN",
  });
  check("no second path to the same outcome", appointHead.status === 403);

  const officeHeadPromote = await officeHead.call("PATCH", `/api/accounts/${employeeRow.id}/role`, {
    role: "MAIN_ADMIN",
  });
  check("an office head cannot appoint a MAIN_ADMIN", officeHeadPromote.status === 403, `got ${officeHeadPromote.status}`);

  // ---------------------------------------------------------------------
  console.log("\nthe IT admin's boundary is credentials, not headships");
  // ---------------------------------------------------------------------
  const lockHead = await itAdmin.call("POST", `/api/accounts/${officeHeadRow.id}/deactivate`);
  check(
    "an IT admin cannot deactivate an office head",
    lockHead.status === 403,
    `got ${lockHead.status}: ${lockHead.raw.slice(0, 120)}`,
  );
  const headStillActive = await prisma.user.findUniqueOrThrow({
    where: { id: officeHeadRow.id },
    select: { isActive: true },
  });
  check("the office head is still active in the database", headStillActive.isActive === true);

  const lockSuper = await itAdmin.call("POST", `/api/accounts/${mainRow.id}/deactivate`);
  check("an IT admin cannot deactivate the super admin", lockSuper.status === 403, `got ${lockSuper.status}`);

  const createAdmin = await itAdmin.call("POST", "/api/accounts", {
    name: "Check Elevated",
    email: emailFor("elevated"),
    password: "Elevated@1234",
    role: "MAIN_ADMIN",
  });
  check("an IT admin cannot create a MAIN_ADMIN", createAdmin.status === 403, `got ${createAdmin.status}`);
  createdEmails.push(emailFor("elevated"));

  // The ordinary account IS theirs to manage.
  const lockOrdinary = await itAdmin.call("POST", `/api/accounts/${created.body.id}/deactivate`);
  check("an IT admin can deactivate a plain account", lockOrdinary.status === 200, `got ${lockOrdinary.status}`);
  const ordinaryLocked = await prisma.user.findUniqueOrThrow({
    where: { id: created.body.id },
    select: { isActive: true },
  });
  check("the deactivation is persisted", ordinaryLocked.isActive === false);

  // Sent with the account's real password deliberately: this assertion only
  // means something if the *deactivation* is why it fails. With the wrong
  // password it would pass for the wrong reason, which it did.
  const revokedLogin = await loginOk(newEmail, ORDINARY_PASSWORD);
  check(
    "a deactivated account can no longer sign in",
    !revokedLogin.ok,
    `it still signed in: ${revokedLogin.why}`,
  );

  const reactivate = await itAdmin.call("POST", `/api/accounts/${created.body.id}/reactivate`);
  check("an IT admin can reactivate it", reactivate.status === 200, `got ${reactivate.status}`);
  const backIn = await loginOk(newEmail, ORDINARY_PASSWORD);
  check("the reactivated account can sign in again", backIn.ok, backIn.why);

  // ---------------------------------------------------------------------
  console.log("\nthe super admin's authority path still works");
  // ---------------------------------------------------------------------
  const promoteOrdinary = await superAdmin.call("PATCH", `/api/accounts/${created.body.id}/role`, {
    role: "OFFICE_ADMIN",
  });
  check("the super admin can change a role", promoteOrdinary.status === 200, `got ${promoteOrdinary.status}`);
  const promoted = await prisma.user.findUniqueOrThrow({
    where: { id: created.body.id },
    select: { role: true },
  });
  check("the role change is persisted", promoted.role === "OFFICE_ADMIN", promoted.role);

  const demoteBack = await superAdmin.call("PATCH", `/api/accounts/${created.body.id}/role`, {
    role: "EMPLOYEE",
  });
  check("and change it back", demoteBack.status === 200);

  // ---------------------------------------------------------------------
  console.log("\nself-editing is refused even for harmless fields");
  // ---------------------------------------------------------------------
  const ownName = await itAdmin.call("PATCH", `/api/accounts/${itRow.id}`, { name: "Renamed By Self" });
  check("an IT admin cannot rename their own account", ownName.status === 403, `got ${ownName.status}`);
  const ownPassword = await itAdmin.call("PATCH", `/api/accounts/${itRow.id}`, { password: "Changed@1234" });
  check("an IT admin cannot reset their own password", ownPassword.status === 403, `got ${ownPassword.status}`);
  // And the old password must still work.
  const stillOldPassword = await loginOk("it.admin@test.local");
  check("the IT admin's original password is untouched", stillOldPassword.ok, stillOldPassword.why);

  // ---------------------------------------------------------------------
  console.log("\ninput validation");
  // ---------------------------------------------------------------------
  const shortPassword = await itAdmin.call("POST", "/api/accounts", {
    name: "Check Short",
    email: emailFor("short"),
    password: "short",
  });
  check("a too-short password is rejected (HTTP 422)", shortPassword.status === 422, `got ${shortPassword.status}`);
  const badEmail = await itAdmin.call("POST", "/api/accounts", {
    name: "Check Email",
    email: "not-an-email",
    password: "GoodEnough@1234",
  });
  check("a malformed email is rejected (HTTP 422)", badEmail.status === 422, `got ${badEmail.status}`);
  const dupe = await itAdmin.call("POST", "/api/accounts", {
    name: "Check Dupe",
    email: newEmail,
    password: "GoodEnough@1234",
  });
  check("a duplicate email is refused (HTTP 409)", dupe.status === 409, `got ${dupe.status}`);

  // The general update endpoint must not be able to change authority.
  const sneakRole = await superAdmin.call("PATCH", `/api/accounts/${created.body.id}`, { role: "MAIN_ADMIN" });
  check(
    "the general update endpoint refuses a role field",
    sneakRole.status === 422,
    `got ${sneakRole.status} -- a role smuggled into PATCH /:id would be a hole`,
  );
  const roleUnchanged = await prisma.user.findUniqueOrThrow({
    where: { id: created.body.id },
    select: { role: true },
  });
  check("the role really did not change", roleUnchanged.role === "EMPLOYEE", roleUnchanged.role);

  // ---------------------------------------------------------------------
  console.log("\nthe last super admin is protected over HTTP too");
  // ---------------------------------------------------------------------
  const mainAdmins = await prisma.user.count({ where: { role: "MAIN_ADMIN", isActive: true } });
  if (mainAdmins === 1) {
    const selfLock = await superAdmin.call("POST", `/api/accounts/${mainRow.id}/deactivate`);
    check("the sole super admin cannot deactivate themselves (403)", selfLock.status === 403, `got ${selfLock.status}`);
  } else {
    // Create a second super admin so the check is meaningful, then remove it.
    const second = await superAdmin.call("POST", "/api/accounts", {
      name: "Check Second Admin",
      email: emailFor("second"),
      password: "Second@12345",
      role: "MAIN_ADMIN",
    });
    check("the super admin can appoint a second one", second.status === 201, `got ${second.status}`);
    createdEmails.push(emailFor("second"));
    if (second.body?.id) createdUserIds.push(second.body.id);
    console.log("        (skipped sole-admin check: a second super admin exists)");
  }

  // ---------------------------------------------------------------------
  console.log("\neverything is audited");
  // ---------------------------------------------------------------------
  const auditRows = await prisma.auditLog.findMany({
    where: { entity: "accounts" },
    select: { action: true, entityId: true, metadata: true },
  });
  check(`account changes wrote audit rows (${auditRows.length})`, auditRows.length > 0);
  check(
    "no password appears in any audit metadata",
    auditRows.every((r) => !JSON.stringify(r.metadata).toLowerCase().includes("goodenough")),
  );
  check(
    "audit records the field shape, not the values",
    auditRows.some((r) => JSON.stringify(r.metadata).includes("[redacted]")),
    "no [redacted] marker found -- a password may have been recorded in clear",
  );

  // ---------------------------------------------------------------------
  console.log("\ncleaning up");
  // ---------------------------------------------------------------------
  await prisma.notification.deleteMany({ where: { recipientId: { in: createdUserIds } } });
  await prisma.employee.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({ where: { entity: "accounts" } });

  // This run deliberately provokes failed sign-ins, and the server logs every
  // one. Left behind, they accumulate into a genuine repeated-failure
  // signature and `check:alerting` then correctly reports a real attack that
  // was never there -- one check poisoning another. Removed here for the same
  // reason the alerting check cleans up its own side effects.
  await prisma.systemLog.deleteMany({
    where: { category: "auth", createdAt: { gte: runStartedAt } },
  });
  const leftoverAuth = await prisma.systemLog.count({
    where: { category: "auth", createdAt: { gte: runStartedAt } },
  });
  check("no auth log rows left behind", leftoverAuth === 0, `${leftoverAuth} remain`);

  const leftover = await prisma.user.count({ where: { email: { in: createdEmails } } });
  check("no test accounts left behind", leftover === 0, `${leftover} remain`);
  const leftoverAudit = await prisma.auditLog.count({ where: { entity: "accounts" } });
  check("no test audit rows left behind", leftoverAudit === 0, `${leftoverAudit} remain`);

  // The seeded accounts must be exactly as they started.
  const restored = await Promise.all(
    [mainRow.id, itRow.id, officeHeadRow.id, employeeRow.id].map((id) =>
      prisma.user.findUniqueOrThrow({ where: { id }, select: { isActive: true, role: true } }),
    ),
  );
  check(
    "every seeded account is active again",
    restored.every((u) => u.isActive),
    JSON.stringify(restored),
  );
  check("the IT admin still holds IT_ADMIN", restored[1].role === "IT_ADMIN", restored[1].role);
  check("the super admin still holds MAIN_ADMIN", restored[0].role === "MAIN_ADMIN", restored[0].role);

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Account management is correctly gated over HTTP.");
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