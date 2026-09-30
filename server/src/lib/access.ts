import type { AccessLevel, OrgNodeKind, UserRole } from "@/generated/prisma/client";

import { prisma } from "@/prisma/client";
import { descendantOfficeIds } from "@/lib/officeTree";

/**
 * Resolves a signed-in user into their position in the organizational
 * hierarchy, and answers access questions from it.
 *
 * This replaces the old model, where a `UserRole` enum decided everything.
 * That could answer "may an office admin do this?" but never "is this *their*
 * office?" — so a department head could edit another department's plan, and
 * the only way to fix that was to duplicate every check by hand.
 *
 * Two ideas carry the model:
 *
 *  1. A person's level comes from *which node they head*, not from a role
 *     they were assigned. `Employee.headedOfficeId` points at their node; the
 *     node's `kind` says whether that makes them a department, office or
 *     sub-unit head. Restructuring the org therefore changes what people can
 *     do without anyone touching a role field.
 *
 *  2. Team lead is deliberately NOT a level. It is scoped to one project, so
 *     the same person can lead a team on one plan and be an ordinary
 *     contributor on another. It lives in `ProjectTeam.leadEmployeeId` and is
 *     read per project — see `AccessContext.leadsTeamOn`.
 *
 * The IT Admin is a systems function, not a level: it sits outside the tree
 * entirely, and is carried by `isItAdmin` rather than a headship.
 */

/** A sentinel that matches no row, for "you may see nothing of this". */
const NOTHING = "__no_access__";

export interface AccessContext {
  userId: string;
  role: UserRole;

  isSuperAdmin: boolean;
  /** Systems function: accounts, database, configuration. Not a tree level. */
  isItAdmin: boolean;

  employeeId: string | null;
  /** The caller's own office. */
  officeId: string | null;
  /** The node the caller is responsible for, if any. */
  headedOfficeId: string | null;
  headedOfficeKind: OrgNodeKind | null;

  level: AccessLevel;

  /** True for any of the three node-head levels. */
  isNodeHead: boolean;
  isDepartmentHead: boolean;
  isOfficeHead: boolean;
  isSubUnitHead: boolean;
  /** The hierarchy root. */
  isHierarchyHead: boolean;

  /** The caller's office plus every office beneath it. Empty when unassigned. */
  officeScopeIds: string[];
}

/** Which level does heading a node of this kind make you? */
function levelForKind(kind: OrgNodeKind | null): AccessLevel {
  switch (kind) {
    case "DEPARTMENT":
      return "DEPARTMENT_HEAD";
    case "OFFICE":
      return "OFFICE_HEAD";
    case "SUB_UNIT":
      return "SUB_UNIT_HEAD";
    default:
      return "EMPLOYEE";
  }
}

export async function resolveAccess(userId: string, role: UserRole): Promise<AccessContext> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      officeId: true,
      headedOfficeId: true,
      headedOffice: { select: { id: true, kind: true } },
    },
  });

  // Scope is the caller's own office subtree. Someone heading a department
  // therefore sees that department and everything under it, which is what
  // "departments can only give the offices, sub-units, team leads and
  // employees that are only within the department" means in practice.
  const scopeRoot = employee?.headedOfficeId ?? employee?.officeId ?? null;
  const officeScopeIds = scopeRoot ? await descendantOfficeIds(scopeRoot) : [];

  const headedOfficeKind = employee?.headedOffice?.kind ?? null;
  const isSuperAdmin = role === "MAIN_ADMIN";
  const isItAdmin = role === "IT_ADMIN";

  // A super admin heads the hierarchy by definition, whatever the tree says.
  const level: AccessLevel = isSuperAdmin
    ? "HIERARCHY_HEAD"
    : isItAdmin
      ? "EMPLOYEE"
      : levelForKind(headedOfficeKind);

  return {
    userId,
    role,
    isSuperAdmin,
    isItAdmin,
    employeeId: employee?.id ?? null,
    officeId: employee?.officeId ?? null,
    headedOfficeId: employee?.headedOfficeId ?? null,
    headedOfficeKind,
    level,
    isNodeHead:
      level === "DEPARTMENT_HEAD" || level === "OFFICE_HEAD" || level === "SUB_UNIT_HEAD",
    isDepartmentHead: level === "DEPARTMENT_HEAD",
    isOfficeHead: level === "OFFICE_HEAD",
    isSubUnitHead: level === "SUB_UNIT_HEAD",
    isHierarchyHead: isSuperAdmin,
    officeScopeIds,
  };
}

// ---------------------------------------------------------------------------
// Read scoping — the same role `lib/scope.ts` provides, but driven by headship
// rather than by UserRole. Kept alongside it so the two can be compared while
// the migration is in progress.
// ---------------------------------------------------------------------------

/** Offices the caller may see. Null means unrestricted. */
export function visibleOffices(ctx: AccessContext): string[] | null {
  if (ctx.isSuperAdmin) return null;
  if (ctx.isItAdmin) return null; // the roster is system-wide
  return ctx.officeScopeIds.length > 0 ? ctx.officeScopeIds : [NOTHING];
}

/**
 * Plans the caller may see.
 * - Super admin: all
 * - Any node head: plans covering any office in their subtree
 * - Employee: plans they are assigned to, or covering their office
 * - IT admin: none — it holds a systems function, not plan authority
 */
export function planWhere(ctx: AccessContext): Record<string, unknown> {
  if (ctx.isSuperAdmin) return {};

  if (ctx.isItAdmin) return { id: NOTHING };

  if (ctx.isNodeHead || ctx.officeScopeIds.length > 0) {
    const offices = visibleOffices(ctx) ?? [NOTHING];
    return { planOffices: { some: { officeId: { in: offices } } } };
  }

  if (ctx.employeeId) {
    return {
      OR: [
        { planAssignments: { some: { employeeId: ctx.employeeId } } },
        { planOffices: { some: { officeId: { in: ctx.officeScopeIds } } } },
      ],
    };
  }

  return { id: NOTHING };
}

/** True when the caller may see this specific plan. */
export async function canAccessPlan(ctx: AccessContext, planId: string): Promise<boolean> {
  if (ctx.isSuperAdmin) return true;
  if (ctx.isItAdmin) return false;

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      planOffices: { select: { officeId: true } },
      planAssignments: { select: { employeeId: true } },
    },
  });
  if (!plan) return false;

  if (ctx.isNodeHead) {
    return plan.planOffices.some((po) => ctx.officeScopeIds.includes(po.officeId));
  }

  if (ctx.employeeId) {
    if (plan.planAssignments.some((pa) => pa.employeeId === ctx.employeeId)) return true;
    return plan.planOffices.some((po) => ctx.officeScopeIds.includes(po.officeId));
  }

  return false;
}

/**
 * Performance records the caller may see.
 * - Super admin: all
 * - Node head: records for employees in their subtree
 * - Employee: only their own
 */
export function performanceRecordWhere(ctx: AccessContext): Record<string, unknown> {
  if (ctx.isSuperAdmin) return {};
  if (ctx.isItAdmin) return { id: NOTHING };

  if (ctx.isNodeHead) {
    return { employee: { officeId: { in: ctx.officeScopeIds.length ? ctx.officeScopeIds : [NOTHING] } } };
  }
  if (ctx.employeeId) return { employeeId: ctx.employeeId };
  return { id: NOTHING };
}

/** Employees the caller may see. The roster is system-wide for admin functions. */
export function employeeWhere(
  ctx: AccessContext,
  filters: { officeId?: string; includeInactive?: boolean } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...(filters.officeId ? { officeId: filters.officeId } : {}),
    ...(filters.includeInactive ? {} : { isActive: true }),
  };

  if (ctx.isSuperAdmin || ctx.isItAdmin) return base;

  if (ctx.isNodeHead) {
    return { ...base, officeId: { in: ctx.officeScopeIds.length ? ctx.officeScopeIds : [NOTHING] } };
  }
  if (ctx.employeeId) return { ...base, id: ctx.employeeId };
  return { ...base, id: NOTHING };
}

/** Can this person see that employee? */
export async function canAccessEmployee(ctx: AccessContext, employeeId: string): Promise<boolean> {
  if (ctx.isSuperAdmin || ctx.isItAdmin) return true;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, officeId: true },
  });
  if (!employee) return false;
  if (!ctx.isNodeHead && ctx.employeeId) return employee.id === ctx.employeeId;
  return ctx.officeScopeIds.includes(employee.officeId);
}

/** Offices the caller may create or move work into. */
export function assignableOfficeIds(ctx: AccessContext): string[] | null {
  if (ctx.isSuperAdmin) return null;
  if (ctx.isNodeHead) return ctx.officeScopeIds.length ? ctx.officeScopeIds : [NOTHING];
  return [NOTHING];
}

// ---------------------------------------------------------------------------
// Capability checks
//
// These replace `requireRole` for everything governed by the six levels. The
// distinction matters: a role guard says "this kind of user may do this", a
// capability check says "this user may do this to the thing in front of them".
// ---------------------------------------------------------------------------

/** May the caller form a team and appoint its lead? Levels 2, 3 and 4. */
export function canFormTeam(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin || ctx.isNodeHead;
}

/** May the caller set quotas? Everyone above a plain employee. */
export function canSetQuotas(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin || ctx.isNodeHead;
}

/** May the caller grade a team's performance? Levels 1 to 5, never 6. */
export function canGrade(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin || ctx.isNodeHead;
}

/** May the caller see a team's actual progress? Never an employee. */
export function canSeeProgress(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin || ctx.isNodeHead;
}

/** Is the caller the lead of this specific team? Resolved per project. */
export async function leadsTeam(ctx: AccessContext, teamId: string): Promise<boolean> {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.employeeId) return false;
  const team = await prisma.projectTeam.findUnique({
    where: { id: teamId },
    select: { leadEmployeeId: true },
  });
  return team?.leadEmployeeId === ctx.employeeId;
}

/** The plan ids on which the caller is a team lead. */
export async function ledPlanIds(ctx: AccessContext): Promise<string[]> {
  if (ctx.isSuperAdmin) return [];
  if (!ctx.employeeId) return [];
  const roles = await prisma.projectTeam.findMany({
    where: { leadEmployeeId: ctx.employeeId },
    select: { planId: true },
  });
  return roles.map((r) => r.planId);
}

/**
 * Tags and org-structure edits are reserved to the super admin, per the
 * hierarchy rules: "super admin is the only one that can tag departments,
 * sub units and offices".
 */
export function canTagOrgNodes(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin;
}

export function canRestructureOrg(ctx: AccessContext): boolean {
  return ctx.isSuperAdmin;
}
