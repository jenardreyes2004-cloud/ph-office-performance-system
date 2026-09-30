import type { UserRole } from "@/generated/prisma/client";

import { prisma } from "@/prisma/client";
import { descendantOfficeIds } from "@/lib/officeTree";

/**
 * Who the caller is, and therefore what they are allowed to see.
 *
 * The `requireRole` guards answer "may this role do this action?". They cannot
 * answer "whose data is this?" — that needs the caller's own office, which is
 * only known at runtime. This module supplies that missing half so list
 * endpoints can be filtered and single-record endpoints can be checked.
 *
 * Without it, any authenticated user receives every plan, performance record,
 * and employee in the database.
 */
export interface ActorScope {
  userId: string;
  role: UserRole;
  /** The caller's own Employee row, if they have one. */
  employeeId: string | null;
  /** The caller's own office, if they have an Employee row. */
  officeId: string | null;
  /** Their office plus every office beneath it. Empty when they have no office. */
  officeScopeIds: string[];
  /** MAIN_ADMIN sees the whole system. */
  isSuperAdmin: boolean;
  /** IT_ADMIN owns the entire roster, but not plans or reporting. */
  seesWholeRoster: boolean;
  /** OFFICE_ADMIN: their office subtree. */
  isOfficeAdmin: boolean;
  /** EMPLOYEE: read-only, limited to their own records. */
  isEmployee: boolean;
}

export async function resolveActor(userId: string, role: UserRole): Promise<ActorScope> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, officeId: true },
  });

  const officeScopeIds = employee ? await descendantOfficeIds(employee.officeId) : [];

  return {
    userId,
    role,
    employeeId: employee?.id ?? null,
    officeId: employee?.officeId ?? null,
    officeScopeIds,
    isSuperAdmin: role === "MAIN_ADMIN",
    seesWholeRoster: role === "MAIN_ADMIN" || role === "IT_ADMIN",
    isOfficeAdmin: role === "OFFICE_ADMIN",
    isEmployee: role === "EMPLOYEE",
  };
}

/**
 * A sentinel for "matches nothing". Used where a role has no business seeing
 * a row at all — an IT Admin querying plans should get an empty list, not the
 * whole table.
 */
const NOTHING = "__no_access__";

/** Offices the caller may see. Null means unrestricted. */
function visibleOffices(scope: ActorScope): string[] | null {
  if (scope.isSuperAdmin) return null;
  if (scope.seesWholeRoster) return null;
  return scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
}

/**
 * Plans the caller may see:
 * - MAIN_ADMIN: all
 * - OFFICE_ADMIN: plans covering any office in their subtree
 * - EMPLOYEE: plans they are personally assigned to, or covering their office
 * - IT_ADMIN: none
 */
export function planWhere(scope: ActorScope): Record<string, unknown> {
  if (scope.isSuperAdmin) return {};

  if (scope.isOfficeAdmin) {
    const offices = visibleOffices(scope) ?? [NOTHING];
    return { planOffices: { some: { officeId: { in: offices } } } };
  }

  if (scope.isEmployee) {
    const offices = scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
    return {
      OR: [
        { planAssignments: { some: { employeeId: scope.employeeId ?? NOTHING } } },
        { planOffices: { some: { officeId: { in: offices } } } },
      ],
    };
  }

  return { id: NOTHING };
}

/** True when the caller is allowed to see this specific plan. */
export async function canAccessPlan(scope: ActorScope, planId: string): Promise<boolean> {
  if (scope.isSuperAdmin) return true;
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      planOffices: { select: { officeId: true } },
      planAssignments: { select: { employeeId: true } },
    },
  });
  if (!plan) return false;

  if (scope.isOfficeAdmin) {
    const offices = scope.officeScopeIds;
    return plan.planOffices.some((po) => offices.includes(po.officeId));
  }

  if (scope.isEmployee) {
    if (scope.employeeId && plan.planAssignments.some((pa) => pa.employeeId === scope.employeeId)) {
      return true;
    }
    return plan.planOffices.some((po) => scope.officeScopeIds.includes(po.officeId));
  }

  return false;
}

/**
 * Performance records the caller may see:
 * - MAIN_ADMIN: all
 * - OFFICE_ADMIN: records for employees in their office subtree
 * - EMPLOYEE: only their own records
 * - IT_ADMIN: none
 */
export function performanceRecordWhere(scope: ActorScope): Record<string, unknown> {
  if (scope.isSuperAdmin) return {};

  if (scope.isOfficeAdmin) {
    const offices = visibleOffices(scope) ?? [NOTHING];
    return { employee: { officeId: { in: offices } } };
  }

  if (scope.isEmployee) {
    return { employeeId: scope.employeeId ?? NOTHING };
  }

  return { id: NOTHING };
}

/**
 * Employees the caller may see:
 * - MAIN_ADMIN / IT_ADMIN: the whole roster (they own it)
 * - OFFICE_ADMIN: their office subtree
 * - EMPLOYEE: only themselves
 */
export function employeeWhere(
  scope: ActorScope,
  filters: { officeId?: string; includeInactive?: boolean } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
    ...(filters.includeInactive ? {} : { isActive: true }),
  };

  if (scope.seesWholeRoster) return base;

  if (scope.isOfficeAdmin) {
    const offices = scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
    return { ...base, officeId: { in: offices } };
  }

  return { ...base, id: scope.employeeId ?? NOTHING };
}

/** True when the caller may see this specific employee. */
export async function canAccessEmployee(scope: ActorScope, employeeId: string): Promise<boolean> {
  if (scope.seesWholeRoster) return true;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, officeId: true },
  });
  if (!employee) return false;
  if (scope.isEmployee) return employee.id === scope.employeeId;
  return scope.officeScopeIds.includes(employee.officeId);
}

/**
 * Monthly updates the caller may see:
 * - MAIN_ADMIN: all
 * - OFFICE_ADMIN: their office subtree
 * - EMPLOYEE: their own office
 * - IT_ADMIN: none
 */
export function monthlyUpdateWhere(scope: ActorScope): Record<string, unknown> {
  if (scope.isSuperAdmin) return {};
  const offices = scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
  return { officeId: { in: offices } };
}

/** Office ids the caller may assign work to. Null means unrestricted. */
export function assignableOfficeIds(scope: ActorScope): string[] | null {
  if (scope.isSuperAdmin) return null;
  if (scope.isOfficeAdmin) {
    return scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
  }
  return [NOTHING];
}
