import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { OrgNodeKind } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Source: the PhilHealth ORGANIZATION STRUCTURE chart (the org chart handed
// over alongside the requirements doc).
//
// Transcribed as a nested literal so the parent/child shape is obvious at a
// glance.
//
// `kind` is set explicitly on every node rather than inferred from depth,
// because depth does not decide it. MSD, HCDMD and SBAC are departments sitting
// at the same level as the offices beside them, and the level below a
// department is an office while the level below an office is a sub-unit. It
// also decides who is scored: only nodes of kind OFFICE carry their own
// Balanced Scorecard, which are the Office of the Vice President, the offices
// and divisions directly beneath it, and the three NCR regionals. That
// replaced a boolean `isHeadOffice`, which could not say "this is a department"
// and so had to be duplicated into the access level.
//
// Re-runnable: every office is upserted by `code` and then re-parented, so
// running this twice is a no-op rather than a duplicate tree.
// ---------------------------------------------------------------------------

interface Node {
  code: string;
  name: string;
  kind: OrgNodeKind;
  children?: Node[];
}

const TREE: Node = {
  code: "OVP",
  name: "Office of the Vice President",
  kind: "OFFICE",
  children: [
    {
      code: "SBAC",
      name: "Secretariat on Bids & Awards Committee",
      kind: "DEPARTMENT",
      children: [{ code: "PROCUREMENT-UNIT", name: "Procurement Unit", kind: "SUB_UNIT" }],
    },
    {
      code: "MSD",
      name: "Management Services Division",
      kind: "DEPARTMENT",
      children: [
        {
          code: "FMS",
          name: "Fund Management Section",
          kind: "OFFICE",
          children: [
            { code: "COMPTROLLERSHIP", name: "Comptrollership Unit", kind: "SUB_UNIT" },
            { code: "CASHIERING", name: "Cashiering Unit", kind: "SUB_UNIT" },
            { code: "BUDGET", name: "Budget Unit", kind: "SUB_UNIT" },
          ],
        },
        {
          code: "AS",
          name: "Admin Services Section",
          kind: "OFFICE",
          children: [
            {
              code: "GSU",
              name: "General Services Unit",
              kind: "SUB_UNIT",
              children: [
                { code: "MOTORPOOL", name: "Motorpool", kind: "SUB_UNIT" },
                { code: "RECORDS-LIB", name: "Records Library & Mailing Unit", kind: "SUB_UNIT" },
              ],
            },
            { code: "HRU", name: "Human Resource Unit", kind: "SUB_UNIT" },
            { code: "PSMU", name: "Property & Supply Management Unit", kind: "SUB_UNIT" },
          ],
        },
      ],
    },
    { code: "LEGAL", name: "Legal Office", kind: "OFFICE" },
    {
      code: "BEN-TAMO",
      name: "Benefit & Technical Assistance Monitoring Office",
      kind: "OFFICE",
    },
    {
      code: "HCDMD",
      name: "Health Care & Claims Management Division",
      kind: "DEPARTMENT",
      children: [
        { code: "AQAS", name: "Accreditation & Quality Assurance Section", kind: "SUB_UNIT" },
      ],
    },
    { code: "PAU", name: "Public Affairs Unit", kind: "OFFICE" },
    {
      code: "PMMO",
      name: "Planning & Member Management Office",
      kind: "OFFICE",
      children: [
        { code: "PLANNING-UNIT", name: "Planning Unit", kind: "SUB_UNIT" },
        { code: "MMU", name: "Member Management Unit", kind: "SUB_UNIT" },
      ],
    },
    { code: "ITMS", name: "IT Management Section", kind: "OFFICE" },
    // The three regional offices hang directly off the OVP spine on the
    // chart, and each runs its own scorecard.
    { code: "NCR-N", name: "NCR North", kind: "OFFICE" },
    { code: "NCR-C", name: "NCR Central", kind: "OFFICE" },
    { code: "NCR-S", name: "NCR South", kind: "OFFICE" },
  ],
};

async function upsertNode(node: Node, parentId: string | null, depth = 0): Promise<number> {
  const office = await prisma.office.upsert({
    where: { code: node.code },
    update: {
      name: node.name,
      parentId,
      kind: node.kind,
    },
    create: {
      code: node.code,
      name: node.name,
      parentId,
      kind: node.kind,
    },
  });

  console.log(
    `${"  ".repeat(depth)}${office.name} (${office.code})  [${office.kind}]` +
      `${office.kind === "OFFICE" ? "  [scored]" : ""}`,
  );

  for (const child of node.children ?? []) {
    await upsertNode(child, office.id, depth + 1);
  }

  return depth;
}

async function main() {
  console.log("Seeding PhilHealth organization structure…\n");
  await upsertNode(TREE, null);

  const total = await prisma.office.count({ where: { archivedAt: null } });
  const byKind = await prisma.office.groupBy({
    by: ["kind"],
    where: { archivedAt: null },
    _count: { _all: true },
  });
  const leaves = await prisma.office.count({
    where: { archivedAt: null, children: { none: {} } },
  });

  console.log(`\nDone. ${total} active offices.`);
  for (const row of byKind.sort((a, b) => a.kind.localeCompare(b.kind))) {
    console.log(`  ${row.kind.padEnd(11)} ${row._count._all}`);
  }
  // Only OFFICE-kind nodes are scored on their own; departments and sub-units
  // are structure and roll up into the office above them.
  const scored = byKind.find((r) => r.kind === "OFFICE")?._count._all ?? 0;
  console.log(`Offices carrying their own scorecard: ${scored}`);
  console.log(`Leaf offices (no children): ${leaves}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
