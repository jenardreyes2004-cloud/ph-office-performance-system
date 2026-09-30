import { prisma } from "@/prisma/client";
import {
  assignableOfficeIds,
  employeeWhere,
  performanceRecordWhere,
  planWhere,
  type ActorScope,
} from "@/lib/scope";

/**
 * Counts for the dashboard.
 *
 * Every figure is computed through the caller's scope, so an Office Admin's
 * "active plans" means plans covering their office, and an Employee's means
 * the plans they are assigned to. The shape is identical for every role —
 * only the numbers differ, and roles with no business seeing a figure get
 * null rather than a misleading zero.
 */
export const dashboardService = {
  async stats(scope: ActorScope) {
    const planFilter = planWhere(scope);
    const recordFilter = performanceRecordWhere(scope);
    const officeScope = assignableOfficeIds(scope);

    const [
      totalOffices,
      activeOffices,
      totalEmployees,
      myAssignments,
      totalPlans,
      activePlans,
      delayedPlans,
      totalRecords,
      openScorecards,
      finalizedScorecards,
      recentAssignments,
    ] = await Promise.all([
      // total deliberately includes archived offices so the pair reads as
      // "27 of 29 are in service" rather than a duplicated number.
      prisma.office.count({
        where: officeScope ? { id: { in: officeScope } } : {},
      }),
      prisma.office.count({
        where: {
          archivedAt: null,
          ...(officeScope ? { id: { in: officeScope } } : {}),
        },
      }),
      // employeeWhere already encodes the rule: MAIN_ADMIN and IT_ADMIN see
      // the whole roster, an Office Admin their subtree, an Employee only
      // themselves. Using officeScope directly would have hidden the roster
      // from the very role that owns it.
      prisma.employee.count({ where: employeeWhere(scope) }),
      // "mine" means assignments belonging to the caller: their own for an
      // Employee, their office's for an Office Admin, the whole system for a
      // Main Admin. IT Admin has no plan access at all, so it falls to 0.
      prisma.planAssignment.count({
        where:
          scope.employeeId !== null
            ? { employeeId: scope.employeeId }
            : officeScope && !scope.seesWholeRoster
              ? { employee: { officeId: { in: officeScope } } }
              : scope.isSuperAdmin
                ? {}
                : { id: "__none__" },
      }),
      prisma.plan.count({ where: planFilter }),
      prisma.plan.count({
        where: { ...planFilter, status: { in: ["ACTIVE", "ONGOING"] } },
      }),
      prisma.plan.count({ where: { ...planFilter, status: "DELAYED" } }),
      prisma.performanceRecord.count({ where: recordFilter }),
      prisma.officeScorecard.count({ where: { status: "DRAFT" } }),
      prisma.officeScorecard.count({ where: { status: "FINALIZED" } }),
      prisma.planAssignment.findMany({
        where:
          scope.employeeId !== null
            ? { employeeId: scope.employeeId }
            : officeScope && !scope.seesWholeRoster
              ? { employee: { officeId: { in: officeScope } } }
              : scope.isSuperAdmin
                ? {}
                : { id: "__none__" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          progressPct: true,
          dueDate: true,
          plan: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      role: scope.role,
      offices: { total: totalOffices, active: activeOffices },
      employees: totalEmployees,
      assignments: {
        mine: myAssignments,
        recent: recentAssignments.map((a) => ({
          id: a.id,
          planId: a.plan.id,
          planTitle: a.plan.title,
          status: a.status,
          progressPct: Number(a.progressPct),
          dueDate: a.dueDate,
        })),
      },
      plans: { total: totalPlans, active: activePlans, delayed: delayedPlans },
      performanceRecords: totalRecords,
      scorecards: { draft: openScorecards, finalized: finalizedScorecards },
    };
  },
};
