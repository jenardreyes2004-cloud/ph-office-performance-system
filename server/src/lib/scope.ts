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
  /** The node they head, which is what their scope is measured from. */
  headedOfficeId: string | null;
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

/**
 * May this actor read or change the scorecard belonging to `officeId`?
 *
 * Scorecards were the one place the scope model was not applied: the routes
 * gated on role alone, so any OFFICE_ADMIN could create, edit, band, submit
 * and finalize scorecards for *any* office in the system. That is precisely the
 * bug the hierarchy exists to prevent, and the one place it was still
 * reachable.
 *
 * Pure, so it is testable without a database, like the other scope helpers.
 *
 * - MAIN_ADMIN: every office. No argument for withholding the organization's
 *   own results from the top of it.
 * - IT_ADMIN: none. It holds a systems function -- accounts, database,
 *   config -- and deliberately no reporting authority. A staff member who can
 *   see office scorecards can read every office's performance.
 * - everyone else: only offices inside their own subtree.
 *
 * A caller outside their scope gets 404 rather than 403, so the endpoint never
 * confirms that another office's scorecard exists.
 */
/**
 * Is this office inside the caller's authority -- meaning they are answerable
 * for it, not merely that it belongs to them?
 *
 * Shared by the scorecard guard and the org detail panel because both ask the
 * same question and previously answered it two different ways. When they
 * drifted, an employee attached to the root office became FULL on the whole
 * organization in one view and refused in the other.
 */
export function isOfficeInAuthority(scope: ActorScope, officeId: string | null): boolean {
  if (!officeId) return false;
  // A plain employee is not responsible for the office they sit in, so their
  // subtree is not their authority. Anyone attached to the root office -- which
  // is where unassigned staff land -- would otherwise cover everything.
  if (scope.isEmployee) return scope.officeId === officeId;
  return scope.officeScopeIds.includes(officeId);
}

export function canActOnScorecardOffice(scope: ActorScope, officeId: string | null): boolean {
  if (!officeId) return false;
  if (scope.isSuperAdmin) return true;
  if (scope.role === "IT_ADMIN") return false;
  return isOfficeInAuthority(scope, officeId);
}

/** Offices whose scorecards this actor may act on. Null means unrestricted. */
export function scorecardOfficeIds(scope: ActorScope): string[] | null {
  if (scope.isSuperAdmin) return null;
  if (scope.role === "IT_ADMIN") return [NOTHING];
  return scope.officeScopeIds.length > 0 ? scope.officeScopeIds : [NOTHING];
}

/**
 * How much of an organization node a caller may see.
 *
 * The chart itself is public: an employee seeing "MSD -> FMS -> AS -> GSU"
 * learns nothing sensitive, because the shape of an org chart is not the data
 * in it. The people behind the nodes, and the work those nodes do, are the
 * sensitive part.
 *
 * So detail is layered rather than all-or-nothing:
 *
 *  - FULL   - head, managers, people, plans, progress, scorecard. Everyone
 *             inside their own subtree, plus MAIN_ADMIN everywhere.
 *  - PEOPLE - head, managers and people by name, but no plans, progress or
 *             scorecard. The IT admin reads the whole roster and nothing about
 *             reporting, which is the whole point of keeping that role outside
 *             the tree.
 *  - NAMES  - the node exists and is named, nothing more. What an employee sees
 *             for an office outside their subtree.
 */
export type OrgDetailLevel = "FULL" | "PEOPLE" | "NAMES";

export function orgNodeDetailLevel(scope: ActorScope, officeId: string | null): OrgDetailLevel {
  if (!officeId) return "NAMES";

  // The hierarchy head sees everything, everywhere.
  if (scope.isSuperAdmin) return "FULL";

  // The systems role is capped before the scope check, not after.
  //
  // The IT admin holds no headship, and its Employee row is attached to OVP --
  // so `officeScopeIds` covers the whole tree. Testing scope first would hand
  // it FULL everywhere, and with FULL comes plans, progress and scorecards:
  // every office's reporting, to the one role that is deliberately kept outside
  // the tree. The cap has to come first.
  if (scope.role === "IT_ADMIN") return "PEOPLE";

  if (isOfficeInAuthority(scope, officeId)) return "FULL";

  // Outside your subtree the node is visible but its contents are not.
  return "NAMES";
}

/** May this actor read the plan and progress attached to this node? */
export function canSeeOfficeWork(scope: ActorScope, officeId: string | null): boolean {
  return orgNodeDetailLevel(scope, officeId) === "FULL";
}

export async function resolveActor(userId: string, role: UserRole): Promise<ActorScope> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, officeId: true, headedOfficeId: true },
  });

  // The node they head wins over the office they are attached to.
  //
  // These were two different answers to the same question. `resolveAccess` in
  // lib/access.ts has always preferred `headedOfficeId`; this one read only
  // `officeId`. Seeded heads are attached to OVP while heading MSD, AS or GSU,
  // so the difference was not theoretical: every node head's scope resolved to
  // the whole 26-office tree, and every "cannot see outside your scope" check
  // passed vacuously because there was no outside.
  const scopeRoot = employee?.headedOfficeId ?? employee?.officeId ?? null;
  const officeScopeIds = scopeRoot ? await descendantOfficeIds(scopeRoot) : [];

  return {
    userId,
    role,
    employeeId: employee?.id ?? null,
    officeId: employee?.officeId ?? null,
    headedOfficeId: employee?.headedOfficeId ?? null,
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
