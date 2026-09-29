import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Source: the PhilHealth ORGANIZATION STRUCTURE chart (the org chart handed
// over alongside the requirements doc).
//
// Transcribed as a nested literal so the parent/child shape is obvious at a
// glance. `head: true` marks the offices that run a Balanced Scorecard —
// the Office of the Vice President and the three NCR regional offices.
// Everything below them is structure, plans, and employees, but is not
// scored on its own.
//
// Re-runnable: every office is upserted by `code` and then re-parented, so
// running this twice is a no-op rather than a duplicate tree.
// ---------------------------------------------------------------------------

interface Node {
  code: string;
  name: string;
  head?: boolean;
  children?: Node[];
}

const TREE: Node = {
  code: "OVP",
  name: "Office of the Vice President",
  head: true,
  children: [
    {
      code: "SBAC",
      name: "Secretariat on Bids & Awards Committee",
      children: [{ code: "PROCUREMENT-UNIT", name: "Procurement Unit" }],
    },
    {
      code: "MSD",
      name: "Management Services Division",
      children: [
        {
          code: "FMS",
          name: "Fund Management Section",
          children: [
            { code: "COMPTROLLERSHIP", name: "Comptrollership Unit" },
            { code: "CASHIERING", name: "Cashiering Unit" },
            { code: "BUDGET", name: "Budget Unit" },
          ],
        },
        {
          code: "AS",
          name: "Admin Services Section",
          children: [
            {
              code: "GSU",
              name: "General Services Unit",
              children: [
                { code: "MOTORPOOL", name: "Motorpool" },
                { code: "RECORDS-LIB", name: "Records Library & Mailing Unit" },
              ],
            },
            { code: "HRU", name: "Human Resource Unit" },
            { code: "PSMU", name: "Property & Supply Management Unit" },
          ],
        },
      ],
    },
    { code: "LEGAL", name: "Legal Office" },
    {
      code: "BEN-TAMO",
      name: "Benefit & Technical Assistance Monitoring Office",
    },
    {
      code: "HCDMD",
      name: "Health Care & Claims Management Division",
      children: [
        { code: "AQAS", name: "Accreditation & Quality Assurance Section" },
      ],
    },
    { code: "PAU", name: "Public Affairs Unit" },
    {
      code: "PMMO",
      name: "Planning & Member Management Office",
      children: [
        { code: "PLANNING-UNIT", name: "Planning Unit" },
        { code: "MMU", name: "Member Management Unit" },
      ],
    },
    { code: "ITMS", name: "IT Management Section" },
    // The three regional offices hang directly off the OVP spine on the
    // chart, and each runs its own scorecard.
    { code: "NCR-N", name: "NCR North", head: true },
    { code: "NCR-C", name: "NCR Central", head: true },
    { code: "NCR-S", name: "NCR South", head: true },
  ],
};

async function upsertNode(node: Node, parentId: string | null, depth = 0): Promise<number> {
  const office = await prisma.office.upsert({
    where: { code: node.code },
    update: {
      name: node.name,
      parentId,
      isHeadOffice: node.head ?? false,
    },
    create: {
      code: node.code,
      name: node.name,
      parentId,
      isHeadOffice: node.head ?? false,
    },
  });

  console.log(
    `${"  ".repeat(depth)}${office.name} (${office.code})${office.isHeadOffice ? "  [scored]" : ""}`,
  );

  for (const child of node.children ?? []) {
    await upsertNode(child, office.id, depth + 1);
  }

  return depth;
}

async function main() {
  console.log("Seeding PhilHealth organization structure…\n");
  await upsertNode(TREE, null);

  const total = await prisma.office.count();
  const heads = await prisma.office.count({ where: { isHeadOffice: true } });
  const leaves = await prisma.office.count({
    where: { archivedAt: null, children: { none: {} } },
  });

  console.log(`\nDone. ${total} offices total.`);
  console.log(`Head offices that run scorecards: ${heads}`);
  console.log(`Leaf offices (no sub-units): ${leaves}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
