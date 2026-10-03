import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveActor, orgNodeDetailLevel, type ActorScope } from "../src/lib/scope.js";
import type { UserRole } from "../src/generated/prisma/client.js";

/**
 * Proves the layered organization detail.
 *
 * The chart is public: everyone sees every node, because the shape of an org
 * chart is not the data in it. What a node *contains* is layered --
 * FULL inside your own subtree, PEOPLE for the IT admin, NAMES outside.
 *
 * The failure this guards against is the one that already happened twice in
 * this codebase: the IT admin is attached to OVP, so its scope covers the whole
 * tree, and a scope check placed before the IT cap silently handed it FULL
 * everywhere -- which means every office's plans and scorecards. That is exactly
 * what keeping the systems role outside the hierarchy is meant to prevent.
 *
 * Read-only. Run: npx tsx prisma/checkOrgDetail.ts
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

async function scopeFor(email: string, role: UserRole): Promise<ActorScope> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return resolveActor(user.id, role);
}

async function main() {
  console.log("Organization detail levels — who may open what\n");

  const offices = await prisma.office.findMany({
    where: { archivedAt: null },
    select: { id: true, code: true, kind: true },
  });
  const byCode = new Map(offices.map((o) => [o.code, o]));
  check("there are offices to test against", offices.length > 0, `${offices.length}`);

  const main = await scopeFor("main.admin@test.local", "MAIN_ADMIN");
  const dept = await scopeFor("dept.head@test.local", "OFFICE_ADMIN");
  const officeHead = await scopeFor("office.head@test.local", "OFFICE_ADMIN");
  const employee = await scopeFor("employee@test.local", "EMPLOYEE");
  const itAdmin = await scopeFor("it.admin@test.local", "IT_ADMIN");

  const msd = byCode.get("MSD")!;
  const asOffice = byCode.get("AS")!;
  const gsu = byCode.get("GSU")!;
  const ncrC = byCode.get("NCR-C")!;

  // -----------------------------------------------------------------
  console.log("\nthe hierarchy head sees everything");
  // -----------------------------------------------------------------
  check("FULL on any node", orgNodeDetailLevel(main, msd.id) === "FULL");
  check("FULL on an unrelated office", orgNodeDetailLevel(main, ncrC.id) === "FULL");

  // -----------------------------------------------------------------
  console.log("\nthe systems role is capped, not scoped");
  // -----------------------------------------------------------------
  // The load-bearing assertions. Its Employee row sits on OVP, so its
  // officeScopeIds covers the entire tree -- which is why the cap has to be
  // evaluated before the scope test.
  check(
    "the IT admin's scope really does cover the whole tree",
    itAdmin.officeScopeIds.length === offices.length,
    `scope=${itAdmin.officeScopeIds.length} of ${offices.length}`,
  );
  for (const o of [msd, asOffice, ncrC, offices[0]]) {
    check(
      `IT admin is PEOPLE on ${o.code}, never FULL`,
      orgNodeDetailLevel(itAdmin, o.id) === "PEOPLE",
      `got ${orgNodeDetailLevel(itAdmin, o.id)}`,
    );
  }

  // -----------------------------------------------------------------
  console.log("\nnode heads get FULL inside their own subtree");
  // -----------------------------------------------------------------
  check("department head FULL on the office it heads", orgNodeDetailLevel(dept, msd.id) === "FULL");
  check("department head FULL on its child office", orgNodeDetailLevel(dept, asOffice.id) === "FULL");
  check("department head FULL on its grandchild", orgNodeDetailLevel(dept, gsu.id) === "FULL");
  check("department head NAMES on an unrelated office", orgNodeDetailLevel(dept, ncrC.id) === "NAMES");

  check("office head FULL on the office it heads", orgNodeDetailLevel(officeHead, asOffice.id) === "FULL");
  check("office head FULL on its child", orgNodeDetailLevel(officeHead, gsu.id) === "FULL");
  check("office head NAMES on its own department", orgNodeDetailLevel(officeHead, msd.id) === "NAMES");

  // -----------------------------------------------------------------
  console.log("\ncontainment still holds");
  // -----------------------------------------------------------------
  check(
    "a department head's FULL set contains an office head's",
    dept.officeScopeIds.length > officeHead.officeScopeIds.length,
    `dept=${dept.officeScopeIds.length} office=${officeHead.officeScopeIds.length}`,
  );
  check(
    "and every office head's in-scope node is also in-scope for the department head",
    officeHead.officeScopeIds.every((id) => dept.officeScopeIds.includes(id)),
  );

  // -----------------------------------------------------------------
  console.log("\nplain employees");
  // -----------------------------------------------------------------
  const employeeOffice = employee.officeId;
  check("an employee gets FULL on their own office", orgNodeDetailLevel(employee, employeeOffice) === "FULL");
  for (const o of [msd, ncrC]) {
    if (o.id === employeeOffice) continue;
    check(
      `an employee gets NAMES on ${o.code}`,
      orgNodeDetailLevel(employee, o.id) === "NAMES",
      `got ${orgNodeDetailLevel(employee, o.id)}`,
    );
  }

  // -----------------------------------------------------------------
  console.log("\ndegenerate input is never permissive");
  // -----------------------------------------------------------------
  check("a null office id is NAMES for everyone", orgNodeDetailLevel(main, null) === "NAMES");
  check("an unknown office id is NAMES for a head", orgNodeDetailLevel(dept, "00000000-0000-4000-8000-000000000000") === "NAMES");

  // -----------------------------------------------------------------
  console.log("\nseeded heads sit in the offices they head");
  // -----------------------------------------------------------------
  // Not an access question, but the org chart reads "who works here" from
  // officeId. When the seed set only headedOfficeId, every node reported zero
  // staff and the panel looked broken while access was fine.
  const misplaced = await prisma.employee.findMany({
    where: { headedOfficeId: { not: null } },
    select: { headedOfficeId: true, officeId: true },
  });
  const mismatched = misplaced.filter((e) => e.officeId !== e.headedOfficeId);
  check(
    `every head is attached to the office it heads (${misplaced.length} heads)`,
    mismatched.length === 0,
    `${mismatched.length} attached elsewhere`,
  );

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Organization detail is layered correctly for every role.");
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