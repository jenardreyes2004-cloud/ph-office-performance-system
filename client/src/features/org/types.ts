import type { AccessLevel, OrgNodeKind } from "@/types";

/**
 * Shape of the organization chart's data.
 *
 * Kept apart from the hooks module so the layout can be imported and exercised
 * without pulling React Query in with it. A pure layout is only pure as long as
 * nothing drags a framework along.
 */

export interface OrgTreeScorecard {
  id: string;
  status: string;
  officeRating: string | null;
  totalScore: string | number | null;
  finalizedAt: string | null;
}

export interface OrgTreeNode {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  parentId: string | null;
  employeeCount: number;
  totalEmployeeCount: number;
  isScored: boolean;
  children?: OrgTreeNode[];
  scorecard?: OrgTreeScorecard | null;
}

export interface OrgPerson {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  accessLevel: AccessLevel;
  isActive?: boolean;
  headedOffice?: { id: string; name: string } | null;
}

export interface OrgPlanSummary {
  id: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  assignedCount: number;
}

/** What a caller may see of a node. Mirrors the server's orgNodeDetailLevel. */
export type DetailLevel = "FULL" | "PEOPLE" | "NAMES";

export interface NodeOverview {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  parentId: string | null;
  parentName: string | null;
  archivedAt: string | null;
  detailLevel: DetailLevel;
  // Present only at FULL or PEOPLE. Absent keys, not null: a NAMES node carries
  // nothing to leak, so there is nothing for the client to accidentally render.
  head?: OrgPerson | null;
  managers?: OrgPerson[];
  employees?: OrgPerson[];
  employeeCount?: number;
  childCount?: number;
  description?: string | null;
  plans?: OrgPlanSummary[];
  scorecard?: {
    id: string;
    status: string;
    period: { label: string };
    totalWeight: number | null;
    totalScore: number | null;
    officeRating: string | null;
    finalizedAt: string | null;
  } | null;
  canSeeWork?: boolean;
}

export interface MoveImpact {
  officeId: string;
  officeName: string;
  officeCode: string;
  newParentId: string | null;
  movedCount: number;
  headsGainingScope: OrgPerson[];
  headsLosingScope: OrgPerson[];
  unchanged: number;
}

export type { OrgNodeKind };