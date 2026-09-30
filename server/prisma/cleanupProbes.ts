import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Removes leftovers from manual verification runs. Safe: only touches rows
// whose names match the explicit probe prefixes below.
const PROBE_NAMES = ["Audit Probe Metric", "Audit Probe 2"];

async function main() {
  const deleted = await prisma.performanceMetric.deleteMany({
    where: { name: { in: PROBE_NAMES } },
  });
  console.log(`Removed ${deleted.count} probe metric(s).`);

  // Audit rows from the same runs, so the trail starts clean.
  const logs = await prisma.auditLog.deleteMany({
    where: { entity: "metrics", action: { startsWith: "CREATE" } },
  });
  console.log(`Removed ${logs.count} probe audit row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
