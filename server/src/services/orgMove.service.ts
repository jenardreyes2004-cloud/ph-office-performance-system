import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { resolveActor } from "@/lib/scope";
import { descendantOfficeIds } from "@/lib/officeTree";

/**
 * Re-parents a node, and reports who it affects before anything moves.
 *
 * Re-parenting is the single most consequential change in the system, and it is
 * not obvious why. Moving a node rewrites `officeScopeIds` for every head
 * beneath it, which decides who can see every plan, performance record, monthly
 * update and scorecard underneath -- silently, and retroactively. A drag that
 * looks like tidy-up can take an office head's visibility away from them.
 *
 * So this is deliberately not a bare update:
 *
 *  - `impact` is a dry run. It names the heads that would gain or lose scope,
 *    so the confirmation can state the consequence rather than ask "are you
 *    sure?" about a label nobody reads.
 *  - The move refuses to create a cycle, and refuses to move a node under its
 *    own descendant.
 *  - It is super-admin only. Restructuring the organization is the one power
 *    the hierarchy reserves to the top.
 */
export async function previewMove(officeId: string, newParentId: string | null) {
  if (officeId === newParentId) {
    throw new AppError("An office cannot be its own parent", 400);
  }

  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { id: true, name: true, code: true, kind: true },
  });
  if (!office) throw new AppError("Office not found", 404);

  const descendants = await descendantOfficeIds(officeId);
  if (newParentId && descendants.includes(newParentId)) {
    throw new AppError(
      "That office sits beneath this one. Moving it there would make the hierarchy circular.",
      400,
    );
  }

  const [beforeHeads, afterHeads] = await Promise.all([
    headsUnder(officeId),
    newParentId ? headsUnder(newParentId) : headsUnder(null),
  ]);

  const beforeIds = new Set(beforeHeads.map((h) => h.id));
  const afterIds = new Set(afterHeads.map((h) => h.id));

  const gained = afterHeads.filter((h) => !beforeIds.has(h.id));
  const lost = beforeHeads.filter((h) => !afterIds.has(h.id));

  return {
    officeId: office.id,
    officeName: office.name,
    officeCode: office.code,
    newParentId,
    movedCount: descendants.length,
    headsGainingScope: gained,
    headsLosingScope: lost,
    unchanged: beforeHeads.length - lost.length,
  };
}

async function headsUnder(officeId: string | null) {
  const ids = officeId ? await descendantOfficeIds(officeId) : null;
  return prisma.employee.findMany({
    where: {
      headedOfficeId: ids ? { in: ids } : { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accessLevel: true,
      headedOffice: { select: { name: true } },
    },
  });
}

export async function moveNode(
  actor: { userId: string; role: Parameters<typeof resolveActor>[1] },
  officeId: string,
  newParentId: string | null,
) {
  // Super-admin only, stated here rather than trusted from the route alone.
  const scope = await resolveActor(actor.userId, actor.role);
  if (!scope.isSuperAdmin) {
    throw new AppError("Only the hierarchy head may restructure the organization.", 403);
  }

  // Re-runs the cycle and self-parent checks as part of the write, not only in
  // the preview. A preview is advisory; the write must not depend on someone
  // having looked at it.
  await previewMove(officeId, newParentId);

  if (newParentId) {
    const parent = await prisma.office.findUnique({
      where: { id: newParentId },
      select: { id: true, archivedAt: true },
    });
    if (!parent) throw new AppError("Target office not found", 404);
    if (parent.archivedAt) {
      throw new AppError("An office cannot be moved under an archived office.", 400);
    }
  }

  return prisma.office.update({
    where: { id: officeId },
    data: { parentId: newParentId },
    select: { id: true, name: true, code: true, parentId: true },
  });
}