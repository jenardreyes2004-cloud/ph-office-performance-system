// Keep these in sync with server/prisma/schema.prisma enums.

export type UserRole = "MAIN_ADMIN" | "OFFICE_ADMIN" | "IT_ADMIN" | "EMPLOYEE";

/**
 * Position in the organizational hierarchy, resolved server-side from the node
 * the person heads. This is what actually governs authority — the UserRole above
 * is the account type, not the level.
 */
export type AccessLevel =
  | "HIERARCHY_HEAD"
  | "DEPARTMENT_HEAD"
  | "OFFICE_HEAD"
  | "SUB_UNIT_HEAD"
  | "TEAM_LEAD"
  | "EMPLOYEE";

export type OrgNodeKind = "DEPARTMENT" | "OFFICE" | "SUB_UNIT";

export type SystemLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type PlanStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ONGOING"
  | "COMPLETED"
  | "DELAYED"
  | "ARCHIVED";

export type AssignmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELAYED"
  | "CANCELLED";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Hierarchy level, resolved from the node this person heads. */
  accessLevel: AccessLevel;
  headedOfficeId: string | null;
}
