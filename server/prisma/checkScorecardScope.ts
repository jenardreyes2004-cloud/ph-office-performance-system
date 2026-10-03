import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { canActOnScorecardOffice, resolveActor, type ActorScope } from "../src/lib/scope.js";
import type { UserRole } from "../src/generated/prisma/client.js";

/**
 * Proves scorecards are scoped, which was the one place the hierarchy was not
 * applied.
 *
 * The scorecard routes gated on role alone, so any OFFICE_ADMIN could create,
 * edit, band, submit and finalize *every* office's scorecard. Role cannot
 * express "is this their office?", so the checks here are the part that matters:
 * a pure predicate, tested against the real tree rather than a fixture.
 *
 * Read-only. Creates nothing.
 * Run: npx tsx prisma/checkScorecardScope.ts
 */

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

function permits(label: string, scope: ActorScope, officeId: string) {
  check(label, canActOnScorecardOffice(scope, officeId));
}

function refuses(label: string, scope: ActorScope, officeId: string) {
  const ok = !canActOnScorecardOffice(scope, officeId);
  check(label, ok, ok ? "" : "permitted when it must not be");
}

async function main() {
  console.log("Scorecard scoping — canActOnScorecardOffice\n");

  const offices = await prisma.office.findMany({
    where: { archivedAt: null, kind: "OFFICE" },
    select: { id: true, code: true, name: true },
  });
  check("there are scored offices to test against", offices.length > 0, `${offices.length}`);

  // -----------------------------------------------------------------
  console.log("\nthe hierarchy head sees every office");
  // -----------------------------------------------------------------
  const superScope = await resolveActor(
    (await prisma.user.findUniqueOrThrow({ where: { email: "main.admin@test.local" } })).id,
    "MAIN_ADMIN" as UserRole,
  );
  for (const o of offices.slice(0, 3)) {
    permits(`MAIN_ADMIN may act on ${o.code}`, superScope, o.id);
  }

  // -----------------------------------------------------------------
  console.log("\nthe IT administrator has no scorecard access at all");
  // -----------------------------------------------------------------
  // It holds a systems function -- accounts, database, config. A staff member
  // who can read every office's scorecard can read the whole organization's
  // performance, which is not part of that function.
  const itUser = await prisma.user.findUniqueOrThrow({
    where: { email: "it.admin@test.local" },
  });
  const itScope = await resolveActor(itUser.id, "IT_ADMIN" as UserRole);
  check("the IT admin's scope resolves", itScope.role === "IT_ADMIN");
  for (const o of offices.slice(0, 3)) {
    refuses(`IT_ADMIN may not act on ${o.code}`, itScope, o.id);
  }

  // -----------------------------------------------------------------
  console.log("\nheadships bound what a node head can reach");
  // -----------------------------------------------------------------
  const headshipCases = [
    { email: "dept.head@test.local", heads: "MSD", label: "department head (MSD)" },
    { email: "office.head@test.local", heads: "AS", label: "office head (AS)" },
    { email: "subunit.head@test.local", heads: "GSU", label: "sub-unit head (GSU)" },
  ];

  for (const c of headshipCases) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: c.email } });
    const scope = await resolveActor(user.id, "OFFICE_ADMIN" as UserRole);
    const own = await prisma.office.findUniqueOrThrow({ where: { code: c.heads } });
    const descendant = await prisma.office.findFirstOrThrow({
      where: { parentId: own.id, archivedAt: null },
      select: { id: true, code: true },
    });
    const elsewhere = offices.find((o) => o.code === "NCR-C") ?? offices[0];

    permits(`${c.label} may act on the office they head (${own.code})`, scope, own.id);
    permits(`${c.label} may act on their own sub-unit (${descendant.code})`, scope, descendant.id);
    if (descendant.id !== elsewhere.id) {
      refuses(`${c.label} may not act on an unrelated office (${elsewhere.code})`, scope, elsewhere.id);
    }
  }

  // The department head's reach must strictly contain the office head's --
  // that containment is the whole point of the hierarchy.
  const deptScope = await resolveActor(
    (await prisma.user.findUniqueOrThrow({ where: { email: "dept.head@test.local" } })).id,
    "OFFICE_ADMIN" as UserRole,
  );
  const officeScope = await resolveActor(
    (await prisma.user.findUniqueOrThrow({ where: { email: "office.head@test.local" } })).id,
    "OFFICE_ADMIN" as UserRole,
  );
  const gsu = await prisma.office.findUniqueOrThrow({ where: { code: "GSU" } });
  check(
    "a department head's scope contains an office head's scope",
    deptScope.officeScopeIds.length > officeScope.officeScopeIds.length,
    `dept=${deptScope.officeScopeIds.length} office=${officeScope.officeScopeIds.length}`,
  );
  check(
    "and the department head can reach the office head's node",
    deptScope.officeScopeIds.includes(gsu.id),
  );

  // -----------------------------------------------------------------
  console.log("\nrole alone grants nothing");
  // -----------------------------------------------------------------
  // An OFFICE_ADMIN with no headship: the misleading case. Same role as every
  // node head, no authority, so it must reach nothing.
  const noHeadshipUser = await prisma.user.findUniqueOrThrow({
    where: { email: "office.admin@test.local" },
  });
  const noHeadship = await resolveActor(noHeadshipUser.id, "OFFICE_ADMIN" as UserRole);
  check("an OFFICE_ADMIN with no headship resolves", noHeadship.role === "OFFICE_ADMIN");
  const reachesAny = offices.filter((o) => canActOnScorecardOffice(noHeadship, o.id));
  check(
    `an OFFICE_ADMIN with no headship reaches no scored office (${reachesAny.length})`,
    reachesAny.length === 0,
    reachesAny.map((o) => o.code).join(", "),
  );

  const employeeUser = await prisma.user.findUniqueOrThrow({
    where: { email: "employee@test.local" },
  });
  const employeeScope = await resolveActor(employeeUser.id, "EMPLOYEE" as UserRole);
  for (const o of offices.slice(0, 2)) {
    refuses(`an EMPLOYEE may not act on ${o.code}`, employeeScope, o.id);
  }

  // -----------------------------------------------------------------
  console.log("\nnull and unknown ids are refused");
  // -----------------------------------------------------------------
  // A missing office must not read as "unrestricted".
  check("a null office id is refused", !canActOnScorecardOffice(superScope, null));
  // MAIN_ADMIN is permitted for any office id, including one that does not
  // exist. This predicate answers "may this actor act on this office", not
  // "does this office exist" -- existence is the service's job, and it 404s
  // there. Asserted so the boundary is deliberate rather than accidental.
  check(
    "MAIN_ADMIN's permission does not itself confirm existence",
    canActOnScorecardOffice(superScope, "00000000-0000-4000-8000-000000000000"),
    "existence is enforced by the service, not here",
  );
  check(
    "but a non-super-admin cannot use an unknown id either",
    !canActOnScorecardOffice(officeScope, "00000000-0000-4000-8000-000000000000"),
  );

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Scorecards are scoped to the caller's own offices.");
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