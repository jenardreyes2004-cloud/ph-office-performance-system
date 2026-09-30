import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { UserRole } from "../src/generated/prisma/client.js";
import { resolveAccess, planWhere, employeeWhere } from "../src/lib/access";

/**
 * Asserts that each seeded account resolves to the access level it is meant
 * to have, and to a scope that is neither the whole system nor nothing.
 *
 * Run: npm run check:access
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EXPECTED: { email: string; level: string; scope: "all" | "some" | "none" }[] = [
  { email: "main.admin@test.local", level: "HIERARCHY_HEAD", scope: "all" },
  { email: "dept.head@test.local", level: "DEPARTMENT_HEAD", scope: "some" },
  { email: "office.head@test.local", level: "OFFICE_HEAD", scope: "some" },
  { email: "subunit.head@test.local", level: "SUB_UNIT_HEAD", scope: "some" },
  { email: "it.admin@test.local", level: "EMPLOYEE", scope: "some" },
  { email: "employee@test.local", level: "EMPLOYEE", scope: "some" },
];

const failures: string[] = [];

function check(label: string, ok: boolean, detail: string) {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label} — ${detail}`);
    failures.push(label);
  }
}

async function main() {
  const totalOffices = await prisma.office.count();
  const totalEmployees = await prisma.employee.count();
  // employeeWhere filters to active staff, so the roster baseline has to be
  // the active count too.
  const activeEmployees = await prisma.employee.count({ where: { isActive: true } });
  const totalPlans = await prisma.plan.count();

  console.log(
    `Dataset: ${totalOffices} offices, ${activeEmployees} active of ${totalEmployees} employees, ${totalPlans} plans\n`,
  );

  for (const spec of EXPECTED) {
    const user = await prisma.user.findUnique({ where: { email: spec.email } });
    if (!user) {
      console.log(`${spec.email}: not found — run npm run db:seed:levels\n`);
      continue;
    }

    const ctx = await resolveAccess(user.id, user.role as UserRole);
    const plans = await prisma.plan.count({ where: planWhere(ctx) });
    const employees = await prisma.employee.count({ where: employeeWhere(ctx) });

    console.log(
      `${spec.email}\n  level=${ctx.level} role=${ctx.role} headed=${ctx.headedOfficeKind ?? "-"} scope=${ctx.officeScopeIds.length} office(s)\n  plans=${plans}/${totalPlans} employees=${employees}/${totalEmployees}\n`,
    );

    check(`${spec.email} resolves to ${spec.level}`, ctx.level === spec.level, `got ${ctx.level}`);

    if (spec.scope === "all") {
      check(`${spec.email} sees every plan`, plans === totalPlans, `${plans}/${totalPlans}`);
    } else {
      check(`${spec.email} plans are scoped`, plans <= totalPlans, `${plans}/${totalPlans}`);
    }
  }

  // A sub-unit head must see strictly less than the department head above it:
  // that narrowing is the whole point of the hierarchy.
  const dept = await prisma.user.findUnique({ where: { email: "dept.head@test.local" } });
  const sub = await prisma.user.findUnique({ where: { email: "subunit.head@test.local" } });
  if (dept && sub) {
    const deptCtx = await resolveAccess(dept.id, dept.role as UserRole);
    const subCtx = await resolveAccess(sub.id, sub.role as UserRole);
    check(
      "department head's scope contains the sub-unit head's scope",
      subCtx.officeScopeIds.every((id) => deptCtx.officeScopeIds.includes(id)),
      "sub-unit escaped its department",
    );
    check(
      "department head sees at least as much as the sub-unit head",
      deptCtx.officeScopeIds.length >= subCtx.officeScopeIds.length,
      `${deptCtx.officeScopeIds.length} vs ${subCtx.officeScopeIds.length}`,
    );
  }

  // The IT admin holds a systems function, not plan authority.
  const it = await prisma.user.findUnique({ where: { email: "it.admin@test.local" } });
  if (it) {
    const itCtx = await resolveAccess(it.id, it.role as UserRole);
    const plans = await prisma.plan.count({ where: planWhere(itCtx) });
    const employees = await prisma.employee.count({ where: employeeWhere(itCtx) });
    check("IT admin is flagged as a systems function", itCtx.isItAdmin, "isItAdmin false");
    check("IT admin sees no plans", plans === 0, `${plans} leaked`);
    check(
      "IT admin sees the whole active roster",
      employees === activeEmployees,
      `${employees}/${activeEmployees}`,
    );
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("All access-level checks passed.");
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
