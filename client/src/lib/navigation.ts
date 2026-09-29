import type { Permission } from "@/lib/permissions";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  /** Visible when the user holds any one of these. */
  anyOf: readonly Permission[];
}

/**
 * Sidebar entries, in order. Each item declares the permission that reveals
 * it, so a role only ever sees the sections it can actually reach:
 *
 *   MAIN_ADMIN    8 sections — the whole system
 *   OFFICE_ADMIN  5 sections — plans, progress, and their office's scorecard
 *   IT_ADMIN      3 sections — the roster and notifications
 *   EMPLOYEE      4 sections — read-only on their own plans and performance
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    description: "Your summary",
    anyOf: ["dashboard.view"],
  },
  {
    to: "/plans",
    label: "Plans",
    description: "Plans and assignments",
    anyOf: ["plans.view"],
  },
  {
    to: "/performance/records",
    label: "My Performance",
    description: "Performance records",
    anyOf: ["performance.view"],
  },
  {
    to: "/reports",
    label: "Reports",
    description: "Office scorecards",
    anyOf: ["scorecards.view"],
  },
  {
    to: "/performance",
    label: "Performance Metrics",
    description: "Metric definitions and weights",
    anyOf: ["metrics.view"],
  },
  {
    to: "/employees",
    label: "Employees",
    description: "Roster and assignments",
    anyOf: ["employees.view"],
  },
  {
    to: "/offices",
    label: "Offices",
    description: "Office directory",
    anyOf: ["offices.view"],
  },
  {
    to: "/access",
    label: "My Access",
    description: "What you can do",
    anyOf: ["access.view"],
  },
];
