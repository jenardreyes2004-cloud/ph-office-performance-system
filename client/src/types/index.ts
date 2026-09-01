// Keep these in sync with server/prisma/schema.prisma enums.

export type UserRole = "MAIN_ADMIN" | "OFFICE_ADMIN" | "IT_ADMIN" | "EMPLOYEE";

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
}
