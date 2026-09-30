import { prisma } from "@/prisma/client";

/**
 * The office itself plus every office beneath it.
 *
 * Used for visibility scoping: an Office Admin who heads Management Services
 * Division should see FMS, AS, Comptrollership, Cashiering, Budget, GSU,
 * Motorpool and so on — not just the division node they are attached to.
 */
export async function descendantOfficeIds(rootId: string): Promise<string[]> {
  const rows = await prisma.office.findMany({
    select: { id: true, parentId: true },
  });

  const childIdsByParent = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = childIdsByParent.get(row.parentId) ?? [];
    list.push(row.id);
    childIdsByParent.set(row.parentId, list);
  }

  const found: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];

  // `seen` doubles as loop protection so a cycle already in the data cannot
  // make this spin forever.
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const childId of childIdsByParent.get(current) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      found.push(childId);
      queue.push(childId);
    }
  }

  return [rootId, ...found];
}
