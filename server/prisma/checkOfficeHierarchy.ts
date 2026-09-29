import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// One-off integrity scan: walks every office up its parent chain looking for a
// cycle or an implausible depth. Not part of the app — kept out of src/.
async function main() {
  const all = await prisma.office.findMany({
    select: { id: true, code: true, parentId: true },
  });
  const byId = new Map(all.map((o) => [o.id, o]));

  let bad = 0;
  for (const o of all) {
    if (!o.parentId) continue;
    const seen = new Set<string>();
    let cur: string | null = o.parentId;
    let depth = 0;
    while (cur && depth < 30) {
      if (seen.has(cur)) {
        console.log(`CYCLE: ${o.code} loops back to ${byId.get(cur)?.code}`);
        bad++;
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)?.parentId ?? null;
      depth++;
    }
    if (depth >= 30) {
      console.log(`TOO DEEP: ${o.code}`);
      bad++;
    }
  }

  console.log(bad === 0 ? "OK: no cycles, all chains under 30 deep" : `${bad} problem(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
