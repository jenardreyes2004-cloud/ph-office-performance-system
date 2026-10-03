import type { Permission } from "@/lib/permissions";

/**
 * Navigation, grouped into four spines.
 *
 * The grouping is the whole point. The app deals with two fundamentally
 * different things that used to be mixed together and named inconsistently:
 *
 *   STRUCTURE — who belongs where. The organizational hierarchy and the
 *               people in it. Describes the organisation itself.
 *   WORK      — what people are doing. Projects, assignments, quotas,
 *               progress. Describes activity.
 *
 * Conflating them is why "Offices" used to show a tree of units *and* an
 * employee count, and why "Plans" and "Projects" were the same screen. A
 * department head looking for their department should never have to wonder
 * whether they are looking at structure or at a project.
 *
 * A third and fourth spine keep results and machinery separate from both, so
 * the sidebar reads as four questions rather than eleven unrelated links.
 */
export interface NavItem {
  to: string;
  label: string;
  description: string;
  /** Visible when the user holds any one of these. */
  anyOf: readonly Permission[];
}

export interface NavGroup {
  /** Shown as a small uppercase heading in the sidebar. */
  title: string;
  /** One line explaining what this spine is for, shown as a tooltip-ish line. */
  blurb: string;
  items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "Overview",
    blurb: "Where you stand",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        description: "Your numbers and your place in the hierarchy",
        anyOf: ["dashboard.view"],
      },
    ],
  },
  {
    title: "Structure",
    blurb: "Who belongs where — the organizational hierarchy",
    items: [
      {
        to: "/organization",
        label: "Organization",
        description: "Offices, people and who heads what",
        anyOf: ["offices.view"],
      },
      // People was a separate page and is now part of the organization chart.
      // The roster lives inside the node that owns it, which is where people
      // actually think about it -- "who works in MSD" rather than "row 40 of
      // the roster". /employees redirects rather than 404ing so old links keep
      // working; the IT administrator still manages the roster from here.
    ],
  },
  {
    title: "Work",
    blurb: "What people are doing — projects and progress",
    items: [
      {
        to: "/projects",
        label: "Projects",
        description: "Projects, offices and assignments",
        anyOf: ["plans.view"],
      },
      {
        to: "/my-work",
        label: "My Work",
        description: "Your assignments and targets",
        anyOf: ["plans.view"],
      },
      {
        to: "/monthly-updates",
        label: "Monthly Updates",
        description: "Progress submitted each month",
        anyOf: ["monthlyUpdates.view"],
      },
    ],
  },
  {
    title: "Results",
    blurb: "How it is measured",
    items: [
      {
        to: "/scorecards",
        label: "Scorecards",
        description: "Office performance reports",
        anyOf: ["scorecards.view"],
      },
      {
        to: "/performance-scores",
        label: "Performance Scores",
        description: "Individual employee scores",
        anyOf: ["performance.view"],
      },
      {
        to: "/metrics",
        label: "Metrics",
        description: "Metric definitions and weights",
        anyOf: ["metrics.view"],
      },
    ],
  },
  {
    title: "System",
    blurb: "Messages, oversight and your own access",
    items: [
      {
        to: "/notifications",
        label: "Notifications",
        description: "Messages for you",
        anyOf: ["notifications.view"],
      },
      {
        to: "/audit-log",
        label: "Audit Log",
        description: "Who changed what",
        anyOf: ["auditLog.view"],
      },
      {
        to: "/it-ops",
        label: "System Health",
        description: "Uptime, errors, sign-in threats",
        anyOf: ["itOps.view"],
      },
      {
        to: "/accounts",
        label: "Accounts",
        description: "Logins, roles, and access",
        anyOf: ["accounts.view"],
      },
      {
        to: "/system-log",
        label: "System Log",
        description: "Raw server events",
        anyOf: ["systemLog.view"],
      },
      {
        to: "/access",
        label: "My Access",
        description: "What you can do",
        anyOf: ["access.view"],
      },
    ],
  },
];

/**
 * Legacy paths kept working. Renaming a URL is free for us and expensive for
 * anyone with a bookmark, a shared link, or muscle memory.
 */
export const ROUTE_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: "/offices", to: "/organization" },
  { from: "/employees", to: "/organization" },
  { from: "/plans", to: "/projects" },
  { from: "/plans/:id", to: "/projects/:id" },
  { from: "/reports", to: "/scorecards" },
  { from: "/reports/office-scorecards/:id", to: "/scorecards/:id" },
  { from: "/performance", to: "/metrics" },
  { from: "/performance/records", to: "/performance-scores" },
];

/** Flattened, for callers that just want the visible items. */
export function visibleNavItems(canAny: (anyOf: readonly Permission[]) => boolean): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items).filter((item) => canAny(item.anyOf));
}
