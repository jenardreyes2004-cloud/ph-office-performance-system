import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AccessLevel, OrgNodeKind } from "@/types";

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
  scorecard?: {
    id: string;
    status: string;
    officeRating: string | null;
    totalScore: string | number | null;
    finalizedAt: string | null;
  } | null;
}

/** What a caller may see of a node. Mirrors the server's orgNodeDetailLevel. */
export type DetailLevel = "FULL" | "PEOPLE" | "NAMES";

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

export interface NodeOverview {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  parentId: string | null;
  parentName: string | null;
  archivedAt: string | null;
  detailLevel: DetailLevel;
  // Present only at FULL. Absent keys, not null: a NAMES node carries nothing
  // to leak, so there is nothing for the client to accidentally render.
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

const KEY = ["org"] as const;

export function useOrgTree() {
  return useQuery({
    queryKey: [...KEY, "tree"],
    queryFn: async () => {
      const res = await api.get<OrgTreeNode[]>("/offices/tree");
      return res.data;
    },
    // Structure changes rarely and everyone sees the same chart, so it is worth
    // holding on to.
    staleTime: 60_000,
  });
}

export function useNodeOverview(officeId: string | null) {
  return useQuery({
    queryKey: [...KEY, "overview", officeId],
    queryFn: async () => {
      const res = await api.get<NodeOverview>(`/offices/${officeId}/overview`);
      return res.data;
    },
    enabled: officeId !== null,
  });
}

/**
 * The blast radius of a move, fetched *before* the confirmation is shown.
 *
 * Re-parenting rewrites scope for every head beneath, so the dialog states who
 * gains and loses access rather than asking "are you sure?" about a label.
 */
export function useMoveImpact(officeId: string | null, parentId: string | null) {
  return useQuery({
    queryKey: [...KEY, "move-impact", officeId, parentId],
    queryFn: async () => {
      const res = await api.get<MoveImpact>(
        `/offices/${officeId}/move-options${parentId ? `?parentId=${parentId}` : ""}`,
      );
      return res.data;
    },
    enabled: officeId !== null,
  });
}

export function useMoveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, parentId }: { id: string; parentId: string | null }) => {
      const res = await api.post<{ id: string; name: string }>(`/offices/${id}/move`, {
        parentId,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** Flattens the tree for search, keeping depth so results can show context. */
export interface FlatNode extends OrgTreeNode {
  depth: number;
}

export function flattenTree(nodes: OrgTreeNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (list: OrgTreeNode[], depth: number) => {
    for (const n of list) {
      out.push({ ...n, depth });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}