import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import {
  canSeeOfficeWork,
  orgNodeDetailLevel,
  type ActorScope,
  type OrgDetailLevel,
} from "@/lib/scope";
import { descendantOfficeIds } from "@/lib/officeTree";

/**
 * What a single organization node shows when clicked.
 *
 * The detail level is resolved by the caller and threaded through here, because
 * the shape of the response depends on it: a node outside the caller's subtree
 * carries a name and nothing else, so returning plans for it would defeat the
 * filter no matter what the client chose to hide.
 *
 * `NAMES` deliberately returns no people and no counts. Employee counts are
 * aggregate but they are still a fact about another department, and the whole
 * point of the level is that an employee learns where their office sits in the
 * organization and nothing more.
 */
export async function nodeOverview(
  scope: ActorScope,
  officeId: string,
): Promise<Record<string, unknown>> {
  const level: OrgDetailLevel = orgNodeDetailLevel(scope, officeId);

  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: {
      id: true,
      name: true,
      code: true,
      kind: true,
      parentId: true,
      archivedAt: true,
      description: true,
      parent: { select: { id: true, name: true, code: true } },
      _count: { select: { employees: true, children: true } },
    },
  });
  if (!office) throw new AppError("Office not found", 404);

  const base = {
    id: office.id,
    name: office.name,
    code: office.code,
    kind: office.kind,
    parentId: office.parentId,
    parentName: office.parent?.name ?? null,
    archivedAt: office.archivedAt,
    // The UI uses this to explain a sparse panel rather than render an empty one.
    detailLevel: level,
  };

  if (level === "NAMES") return base;

  // ---------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------
  // Who heads it, who the other node heads beneath it are, and who works there.
  const [headedBy, descendantHeads, employees] = await Promise.all([
    prisma.employee.findFirst({
      where: { headedOfficeId: officeId },
      select: { id: true, firstName: true, lastName: true, position: true, accessLevel: true },
    }),
    prisma.employee.findMany({
      where: { headedOfficeId: { in: await descendantOfficeIds(officeId) }, id: { not: office.id } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        accessLevel: true,
        headedOffice: { select: { id: true, name: true } },
      },
      take: 50,
    }),
    prisma.employee.findMany({
      where: { officeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        accessLevel: true,
        isActive: true,
      },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
    }),
  ]);

  // A head is also in the employee list; kept separate so the panel can show
  // the head once, at the top, rather than twice in two lists.
  const headId = headedBy?.id ?? null;
  const others = employees.filter((e) => e.id !== headId);

  const withPeople = {
    ...base,
    head: headedBy,
    managers: descendantHeads.filter((m) => m.id !== headId),
    employees: others,
    employeeCount: office._count.employees,
    childCount: office._count.children,
  };

  if (level === "PEOPLE") return withPeople;

  // ---------------------------------------------------------------------
  // Work
  // ---------------------------------------------------------------------
  const subtree = await descendantOfficeIds(officeId);

  const [plans, latestScorecard] = await Promise.all([
    prisma.plan.findMany({
      where: { planOffices: { some: { officeId: { in: subtree } } } },
      select: {
        id: true,
        title: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        _count: { select: { planAssignments: true } },
      },
      orderBy: { periodEnd: "desc" },
      take: 12,
    }),
    prisma.officeScorecard.findFirst({
      where: { officeId },
      orderBy: { period: { startDate: "desc" } },
      select: {
        id: true,
        status: true,
        totalWeight: true,
        totalScore: true,
        officeRating: true,
        finalizedAt: true,
        period: { select: { label: true } },
      },
    }),
  ]);

  return {
    ...withPeople,
    description: office.description,
    plans: plans.map((p) => ({
      ...p,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      assignedCount: p._count.planAssignments,
    })),
    scorecard: latestScorecard
      ? {
          ...latestScorecard,
          totalWeight: latestScorecard.totalWeight === null ? null : Number(latestScorecard.totalWeight),
          totalScore: latestScorecard.totalScore === null ? null : Number(latestScorecard.totalScore),
          finalizedAt: latestScorecard.finalizedAt?.toISOString() ?? null,
        }
      : null,
    canSeeWork: canSeeOfficeWork(scope, officeId),
  };
}