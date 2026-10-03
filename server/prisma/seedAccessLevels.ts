import "dotenv/config";
import { assertSeedAllowedToRun } from "./seedGuard";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Creates one account per access level, so the hierarchy can be exercised
 * end to end rather than reasoned about.
 *
 * Password is shared and this is a local-development fixture only — the same
 * caveat as prisma/seed.ts. Remove before deploying.
 */
const TEST_PASSWORD = "Test@1234";

/**
 * The hierarchy as specified:
 *
 *   OVP                              hierarchy head
 *   ├── DEPARTMENTS
 *   │   ├── MSD
 *   │   │   ├── ASS (office)
 *   │   │   │   └── GSU (sub-unit)
 *   │   │   └── FMS (office)
 *   │   ├── HCDMD
 *   │   └── SBAC
 *   └── OFFICES under no department
 *       ├── LEGAL
 *       ├── PAU
 *       ├── PMMO
 *       └── NCR-N / NCR-C / NCR-S
 *
 * NCR North, Central and South are kept and sit under no department, per the
 * decision to retain them from the original org chart.
 */
const LEVELS: {
  email: string;
  name: string;
  /** Person name as it appears on the org chart. */
  person: string;
  role: "MAIN_ADMIN" | "OFFICE_ADMIN" | "IT_ADMIN" | "EMPLOYEE";
  level:
    | "HIERARCHY_HEAD"
    | "DEPARTMENT_HEAD"
    | "OFFICE_HEAD"
    | "SUB_UNIT_HEAD"
    | "EMPLOYEE";
  headsOfficeCode?: string;
  /** Where this person is attached, when it is not the fallback office. */
  attachedOfficeCode?: string;
}[] = [
  {
    email: "main.admin@test.local",
    name: "Test Main Admin",
    person: "Ana dela Cruz",
    role: "MAIN_ADMIN",
    level: "HIERARCHY_HEAD",
  },
  {
    email: "dept.head@test.local",
    name: "Test Department Head",
    person: "Benito Ramos",
    role: "OFFICE_ADMIN",
    level: "DEPARTMENT_HEAD",
    headsOfficeCode: "MSD",
  },
  {
    email: "office.head@test.local",
    name: "Test Office Head",
    person: "Celia Bautista",
    role: "OFFICE_ADMIN",
    level: "OFFICE_HEAD",
    headsOfficeCode: "AS",
  },
  {
    email: "subunit.head@test.local",
    name: "Test Sub-Unit Head",
    person: "Dante Mercado",
    role: "OFFICE_ADMIN",
    level: "SUB_UNIT_HEAD",
    headsOfficeCode: "GSU",
  },
  {
    email: "it.admin@test.local",
    name: "Test IT Admin",
    person: "Elena Villanueva",
    role: "IT_ADMIN",
    level: "EMPLOYEE",
  },
  {
    email: "employee@test.local",
    name: "Test Employee",
    person: "Farid Aquino",
    role: "EMPLOYEE",
    level: "EMPLOYEE",
    // On a sub-unit, not the root. Attached to OVP, a plain employee is
    // answerable for the entire organization, which is the opposite of the
    // point -- an employee runs nothing.
    attachedOfficeCode: "GSU",
  },
  {
    // The awkward one, and deliberately so.
    //
    // It holds OFFICE_ADMIN but heads nothing, which is the case that separates
    // "has the role" from "has the authority": its scope must be the one office
    // it is attached to, not the whole tree. Pinned to a sub-unit rather than
    // a scored office so it also has no office-level scorecard to reach.
    email: "office.admin@test.local",
    name: "Test Office Admin",
    person: "Grace Villanueva",
    role: "OFFICE_ADMIN",
    level: "EMPLOYEE",
    attachedOfficeCode: "GSU",
  },
];

/** Splits a display name into the first/last pair the Employee row stores. */
function personName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  console.log("Seeding one account per access level…\n");

  for (const spec of LEVELS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { name: spec.name, role: spec.role },
      create: {
        email: spec.email,
        passwordHash,
        name: spec.name,
        role: spec.role,
      },
    });

    // An account with no Employee row has no office and therefore no headship.
    let employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true, officeId: true, headedOfficeId: true },
    });

    const attachedOffice = spec.attachedOfficeCode
      ? await prisma.office.findUnique({ where: { code: spec.attachedOfficeCode } })
      : null;
    const fallbackOffice = await prisma.office.findUnique({ where: { code: "OVP" } });
    if (!fallbackOffice) {
      console.warn("  skipped — OVP missing, run `npm run db:seed:org` first");
      continue;
    }
    const homeOfficeId = attachedOffice?.id ?? fallbackOffice.id;

    if (!employee) {
      // Park unassigned accounts on the OVP so they exist as people; the
      // absence of headedOfficeId is what makes them a plain employee.
      employee = await prisma.employee.create({
        data: {
          userId: user.id,
          officeId: homeOfficeId,
          ...personName(spec.person),
          position: spec.level.replace(/_/g, " ").toLowerCase(),
          accessLevel: spec.level,
        },
        select: { id: true, officeId: true, headedOfficeId: true },
      });
    } else {
      // Re-stamp an existing row rather than only creating it. Otherwise a name
      // change in this file never reaches anyone who already ran the seed, and
      // people stay attached to whichever office an earlier version of the
      // fixture happened to use -- including archived throwaway offices.
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          ...personName(spec.person),
          accessLevel: spec.level,
          officeId: homeOfficeId,
        },
      });
    }

    // Assign the headship, if this level has one.
    if (spec.headsOfficeCode) {
      const office = await prisma.office.findUnique({
        where: { code: spec.headsOfficeCode },
        select: { id: true, kind: true, name: true },
      });
      if (!office) {
        console.warn(`  ${spec.email}: office ${spec.headsOfficeCode} not found`);
        continue;
      }
      // Attach them to the office they head, not just to the fallback office.
      //
      // `headedOfficeId` decides their access level, but `officeId` decides
      // which office the person belongs to, and it is what "who works here"
      // reads. Setting only the headship left every seeded head attached to the
      // root, so every node in the org chart reported zero staff -- the panel
      // looked broken while the access model worked fine.
      await prisma.employee.update({
        where: { id: employee.id },
        data: { headedOfficeId: office.id, officeId: office.id, accessLevel: spec.level },
      });
      console.log(
        `  ${spec.email.padEnd(28)} ${spec.level.padEnd(17)} heads ${office.name} (${office.kind})`,
      );
    } else {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { headedOfficeId: null, accessLevel: spec.level },
      });
      console.log(`  ${spec.email.padEnd(28)} ${spec.level}`);
    }
  }

  // Legal has three team leads, per the structure. They are leads in the
  // reporting sense only here — ProjectTeamLead rows are what make someone a
  // lead on a specific project, and those come later with the team fixtures.
  const legal = await prisma.office.findUnique({ where: { code: "LEGAL" } });
  if (legal) {
    const leads = await prisma.employee.findMany({
      where: { officeId: legal.id, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    console.log(`\n  Legal currently has ${leads.length} staff eligible to lead.`);
  }

  console.log(`\nDone. Password for all: ${TEST_PASSWORD}`);
}

assertSeedAllowedToRun();
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
