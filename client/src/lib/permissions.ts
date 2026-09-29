import type { UserRole } from "@/types";

/**
 * Client-side mirror of the server's RBAC.
 *
 * Every entry here corresponds to a `requireRole(...)` guard in
 * server/src/routes/*.routes.ts — if you change a guard there, change it
 * here too. This is a UX layer only: the server still enforces the real
 * rules, and every mutation below is refused with a 403 if the client
 * somehow lets it through.
 */
export type Permission =
  // Views
  | "dashboard.view"
  | "offices.view"
  | "employees.view"
  | "plans.view"
  | "metrics.view"
  | "performance.view"
  | "monthlyUpdates.view"
  | "notifications.view"
  | "scorecards.view"
  | "access.view"
  // Writes
  | "offices.manage"
  | "employees.manage"
  | "plans.manage"
  | "metrics.manage"
  | "performance.manage"
  | "monthlyUpdates.manage"
  | "notifications.send"
  | "scorecards.manage"
  | "scorecards.finalize"
  | "scorecardPeriods.manage";

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  // Sees everything and can change everything.
  MAIN_ADMIN: [
    "dashboard.view",
    "offices.view",
    "employees.view",
    "plans.view",
    "metrics.view",
    "performance.view",
    "monthlyUpdates.view",
    "notifications.view",
    "scorecards.view",
    "access.view",
    "offices.manage",
    "employees.manage",
    "plans.manage",
    "metrics.manage",
    "performance.manage",
    "monthlyUpdates.manage",
    "notifications.send",
    "scorecards.manage",
    "scorecards.finalize",
    "scorecardPeriods.manage",
  ],

  // Runs the plan for their office: builds plans, assigns people, files
  // monthly updates, and fills in their office's scorecard. Cannot touch
  // the office list, the metric definitions, or finalize a scorecard.
  OFFICE_ADMIN: [
    "dashboard.view",
    "plans.view",
    "performance.view",
    "monthlyUpdates.view",
    "notifications.view",
    "scorecards.view",
    "access.view",
    "plans.manage",
    "monthlyUpdates.manage",
    "scorecards.manage",
  ],

  // Owns the employee roster and the notification channel. No plan or
  // reporting access.
  IT_ADMIN: [
    "dashboard.view",
    "employees.view",
    "notifications.view",
    "access.view",
    "employees.manage",
    "notifications.send",
  ],

  // Read-only on their own work. No configuration, no management.
  EMPLOYEE: [
    "dashboard.view",
    "plans.view",
    "performance.view",
    "access.view",
  ],
};

export function can(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(
  role: UserRole | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  MAIN_ADMIN: "Main Administrator",
  OFFICE_ADMIN: "Office Administrator",
  IT_ADMIN: "IT Administrator",
  EMPLOYEE: "Employee",
};

export const ROLE_SUMMARIES: Record<UserRole, string> = {
  MAIN_ADMIN:
    "Full access. Manages offices, the employee roster, metrics, plans, and finalizes office scorecards.",
  OFFICE_ADMIN:
    "Manages plans and assignments for their office, files monthly updates, and fills in their office's scorecard.",
  IT_ADMIN: "Manages the employee roster and can send notifications. No plan or reporting access.",
  EMPLOYEE: "Read-only access to their own plans and performance records.",
};

/** Grouping + copy for the "Your access" screen. */
export const PERMISSION_GROUPS: {
  title: string;
  permissions: { permission: Permission; label: string; description: string }[];
}[] = [
  {
    title: "Setup & configuration",
    permissions: [
      {
        permission: "offices.manage",
        label: "Manage offices",
        description: "Create, edit, archive, and restore offices.",
      },
      {
        permission: "employees.manage",
        label: "Manage employees",
        description: "Add employees, edit profiles, and deactivate or reactivate them.",
      },
      {
        permission: "metrics.manage",
        label: "Manage performance metrics",
        description: "Define the weighted metrics used to score performance.",
      },
      {
        permission: "scorecardPeriods.manage",
        label: "Create scorecard periods",
        description: "Open a new reporting cycle, such as CY 2026.",
      },
    ],
  },
  {
    title: "Plans & progress",
    permissions: [
      {
        permission: "plans.manage",
        label: "Manage plans",
        description: "Create plans, attach offices, and assign employees to them.",
      },
      {
        permission: "monthlyUpdates.manage",
        label: "Submit monthly updates",
        description: "File and amend an office's monthly progress update.",
      },
      {
        permission: "performance.manage",
        label: "Record performance",
        description: "Enter and correct employee performance scores.",
      },
    ],
  },
  {
    title: "Reporting",
    permissions: [
      {
        permission: "scorecards.manage",
        label: "Fill in office scorecards",
        description: "Start a scorecard and submit results for each measure.",
      },
      {
        permission: "scorecards.finalize",
        label: "Finalize scorecards",
        description: "Lock a scorecard and publish the office's rating.",
      },
    ],
  },
  {
    title: "Communication",
    permissions: [
      {
        permission: "notifications.send",
        label: "Send notifications",
        description: "Send a notification to another user.",
      },
    ],
  },
  {
    title: "Read-only views",
    permissions: [
      {
        permission: "offices.view",
        label: "View offices",
        description: "See the office directory.",
      },
      {
        permission: "employees.view",
        label: "View employees",
        description: "See employee profiles and office assignments.",
      },
      {
        permission: "plans.view",
        label: "View plans",
        description: "See plans, their offices, and their assignments.",
      },
      {
        permission: "metrics.view",
        label: "View metrics",
        description: "See the metric definitions and their weights.",
      },
      {
        permission: "performance.view",
        label: "View performance records",
        description: "See recorded performance scores.",
      },
      {
        permission: "monthlyUpdates.view",
        label: "View monthly updates",
        description: "See submitted monthly progress updates.",
      },
      {
        permission: "scorecards.view",
        label: "View office scorecards",
        description: "Open and print office scorecards.",
      },
      {
        permission: "notifications.view",
        label: "View own notifications",
        description: "See notifications addressed to you.",
      },
    ],
  },
];
