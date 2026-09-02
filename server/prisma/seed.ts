import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// NOTE: These are TEMPORARY testing accounts only.
// Remove or disable this seed before deploying to production.
const TEST_PASSWORD = "Test@1234";

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // --- Test users (one per role) ---
  const itAdmin = await prisma.user.upsert({
    where: { email: "it.admin@test.local" },
    update: {},
    create: {
      email: "it.admin@test.local",
      passwordHash,
      name: "Test IT Admin",
      role: "IT_ADMIN",
    },
  });

  const mainAdmin = await prisma.user.upsert({
    where: { email: "main.admin@test.local" },
    update: {},
    create: {
      email: "main.admin@test.local",
      passwordHash,
      name: "Test Main Admin",
      role: "MAIN_ADMIN",
    },
  });

  const officeAdmin = await prisma.user.upsert({
    where: { email: "office.admin@test.local" },
    update: {},
    create: {
      email: "office.admin@test.local",
      passwordHash,
      name: "Test Office Admin",
      role: "OFFICE_ADMIN",
    },
  });

  const employeeUser = await prisma.user.upsert({
    where: { email: "employee@test.local" },
    update: {},
    create: {
      email: "employee@test.local",
      passwordHash,
      name: "Test Employee",
      role: "EMPLOYEE",
    },
  });

  // --- Sample office ---
  const office = await prisma.office.upsert({
    where: { code: "TEST-OFC" },
    update: {},
    create: {
      name: "Test Office",
      code: "TEST-OFC",
      description: "Seeded office for local testing",
    },
  });

  // --- Link office admin & employee as roster entries under the test office ---
  await prisma.employee.upsert({
    where: { userId: officeAdmin.id },
    update: {},
    create: {
      userId: officeAdmin.id,
      officeId: office.id,
      firstName: "Test",
      lastName: "OfficeAdmin",
      position: "Head of Office",
    },
  });

  const employeeRecord = await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {},
    create: {
      userId: employeeUser.id,
      officeId: office.id,
      firstName: "Test",
      lastName: "Employee",
      position: "Staff",
      addedByUserId: officeAdmin.id,
    },
  });

  // --- Sample plan tied to the test office ---
  const plan = await prisma.plan.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      title: "Sample Test Plan",
      description: "Seeded plan for local testing",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      status: "ACTIVE",
      planOffices: {
        create: [{ officeId: office.id, target: "100% test completion" }],
      },
      planAssignments: {
        create: [
          {
            employeeId: employeeRecord.id,
            responsibility: "Sample test task",
            status: "IN_PROGRESS",
            assignedByUserId: officeAdmin.id,
          },
        ],
      },
    },
  });

  console.log("Seed complete.");
  console.log("---------------------------------------------");
  console.log("Test accounts (password for all):", TEST_PASSWORD);
  console.log("IT_ADMIN:      it.admin@test.local");
  console.log("MAIN_ADMIN:    main.admin@test.local");
  console.log("OFFICE_ADMIN:  office.admin@test.local");
  console.log("EMPLOYEE:      employee@test.local");
  console.log("---------------------------------------------");
  console.log("Test office:", office.code, "| Test plan:", plan.title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
