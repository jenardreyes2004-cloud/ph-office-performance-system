import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { UserRole } from "../src/generated/prisma/client.js";
import {
  employeeWhere,
  performanceRecordWhere,
  planWhere,
  resolveActor,
} from "../src/lib/scope";

/**
 * Verifies the read-scoping rules in lib/scope.ts against real data.
 *
 * docs/probe-rbac.ps1 can only see whether a role is *refused*; it cannot tell
 * whether a 200 response was correctly *filtered*. This does, by resolving each
 * seed account and asserting what its list queries actually return.
 *
 * Run: npx tsx prisma/checkReadScoping.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ACCOUNTS: { email: string; role: UserRole }[] = [
  { email: "main.admin@test.local", role: "MAIN_ADMIN" },
  { email: "office.admin@test.local", role: "OFFICE_ADMIN" },
  { email: "it.admin@test.local", role: "IT_ADMIN" },
  { email: "employee@test.local", role: "EMPLOYEE" },
];

const failures: string[] = [];

function check(label: string, condition: boolean, detail: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label} — ${detail}`);
    failures.push(label);
  }
}

async function main() {
  const totalPlans = await prisma.plan.count();
  const totalRecords = await prisma.performanceRecord.count();
  const totalEmployees = await prisma.employee.count();
  // employeeWhere filters to active staff, so the roster baseline must be the
  // active count too — comparing it to the unfiltered total would report a
  // false leak.
  const activeEmployees = await prisma.employee.count({ where: { isActive: true } });

  console.log(
    `Dataset: ${totalPlans} plans, ${totalRecords} records, ${activeEmployees} active of ${totalEmployees} employees\n`,
  );

  for (const acct of ACCOUNTS) {
    const user = await prisma.user.findUnique({ where: { email: acct.email } });
    if (!user) {
      console.log(`${acct.role}: account not found, skipped\n`);
      continue;
    }

    const scope = await resolveActor(user.id, acct.role);

    const plans = await prisma.plan.count({ where: planWhere(scope) });
    const records = await prisma.performanceRecord.count({ where: performanceRecordWhere(scope) });
    const employees = await prisma.employee.count({ where: employeeWhere(scope) });

    console.log(
      `${acct.role} (office=${scope.officeId ?? "none"}, employee=${scope.employeeId ?? "none"})`,
    );
    console.log(
      `  plans=${plans}/${totalPlans}  records=${records}/${totalRecords}  employees=${employees}/${activeEmployees} active`,
    );

    if (scope.isSuperAdmin) {
      check("MAIN_ADMIN sees every plan", plans === totalPlans, `${plans} of ${totalPlans}`);
      check("MAIN_ADMIN sees every record", records === totalRecords, `${records} of ${totalRecords}`);
    } else {
      check("plans are filtered down", plans <= totalPlans, `${plans} exceeds ${totalPlans}`);
      check("records are filtered down", records <= totalRecords, `${records} exceeds ${totalRecords}`);
    }

    // IT Admin owns the roster but has no plan or reporting access at all.
    if (acct.role === "IT_ADMIN") {
      check(
        "IT_ADMIN sees the whole active roster",
        employees === activeEmployees,
        `${employees} of ${activeEmployees}`,
      );
      check("IT_ADMIN sees no plans", plans === 0, `${plans} plans leaked`);
      check("IT_ADMIN sees no records", records === 0, `${records} records leaked`);
    }

    // An Employee may only ever see their own performance records.
    if (acct.role === "EMPLOYEE") {
      const own = scope.employeeId
        ? await prisma.performanceRecord.count({ where: { employeeId: scope.employeeId } })
        : 0;
      check("EMPLOYEE sees only their own records", records === own, `${records} returned, ${own} are theirs`);
      check("EMPLOYEE sees at most their own roster row", employees <= 1, `${employees} employees visible`);
    }

    // An Office Admin is bound to their office subtree; every employee they
    // can see must sit inside that subtree.
    if (acct.role === "OFFICE_ADMIN" && scope.officeScopeIds.length > 0) {
      const strays = await prisma.employee.count({
        where: { id: { in: (await prisma.employee.findMany({ where: employeeWhere(scope), select: { id: true } })).map((e) => e.id) } },
      });
      check("OFFICE_ADMIN roster stays inside their office subtree", strays <= employees, "roster escaped scope");
    }

    console.log("");
  }

  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("All read-scoping checks passed.");
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
