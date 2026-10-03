import { useState } from "react";
import { ChevronRight, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrgTreeNode } from "@/features/org/types";
import { cn } from "@/lib/utils";
import type { OrgNodeKind } from "@/types";

const KIND_LABEL: Record<OrgNodeKind, string> = {
  DEPARTMENT: "Department",
  OFFICE: "Office",
  SUB_UNIT: "Sub-unit",
};

const KIND_TONE: Record<OrgNodeKind, "default" | "secondary" | "outline"> = {
  DEPARTMENT: "default",
  OFFICE: "secondary",
  SUB_UNIT: "outline",
};

/**
 * The organization as a chart.
 *
 * Plain nested markup with CSS connector lines rather than a graph library or
 * canvas. The tree is three levels deep and about two dozen nodes, so the
 * layout is trivial -- and doing it in the DOM means it is keyboard reachable,
 * printable, and readable by a screen reader without any of that being
 * retrofitted later.
 *
 * Every node is a button. Selecting one opens the detail drawer; expanding is a
 * separate control so a keyboard user is not forced to open a node just to see
 * what is under it.
 */
export function OrgChart({
  nodes,
  selectedId,
  onSelect,
  matchIds,
}: {
  nodes: OrgTreeNode[];
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
  /** Ids matching the current search, highlighted in the chart. */
  matchIds?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <ChartNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          collapsed={collapsed}
          toggle={toggle}
          matchIds={matchIds}
        />
      ))}
    </ul>
  );
}

function ChartNode({
  node,
  depth,
  selectedId,
  onSelect,
  collapsed,
  toggle,
  matchIds,
}: {
  node: OrgTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  matchIds?: Set<string>;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isCollapsed = collapsed.has(node.id);
  const isSelected = selectedId === node.id;
  const isMatch = matchIds?.has(node.id) ?? false;

  return (
    <li>
      <div
        className="relative flex items-stretch"
        style={{ paddingLeft: depth === 0 ? 0 : 20 }}
      >
        {/* Connector line to the parent, drawn rather than typed as characters. */}
        {depth > 0 && (
          <>
            <span
              aria-hidden
              className="absolute left-0 top-0 h-1/2 w-3 border-b border-l border-border"
            />
            <span aria-hidden className="absolute left-3 top-0 h-full border-l border-border" />
          </>
        )}

        <div
          className={cn(
            "my-1 flex flex-1 items-center gap-3 rounded-md border p-2 transition-colors",
            isSelected ? "border-primary bg-primary/5" : "border-border",
            isMatch && !isSelected && "border-amber-500/60 bg-amber-500/5",
          )}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 shrink-0 p-0"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.name}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggle(node.id)}
            >
              <ChevronRight
                className={cn("size-4 transition-transform", !isCollapsed && "rotate-90")}
              />
            </Button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden />
          )}

          <button
            type="button"
            onClick={() => onSelect(node)}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{node.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {node.code}
              </span>
            </span>

            <Badge variant={KIND_TONE[node.kind]} className="shrink-0 text-[10px]">
              {KIND_LABEL[node.kind]}
            </Badge>

            {node.employeeCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" />
                {node.employeeCount}
              </span>
            )}

            {/* Scored units carry their own Balanced Scorecard; departments and
                sub-units roll up into the office above them. */}
            {node.isScored && node.scorecard && (
              <span className="ml-auto shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {node.scorecard.officeRating ?? node.scorecard.status}
                </Badge>
              </span>
            )}
          </button>
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="flex flex-col">
          {node.children!.map((child) => (
            <ChartNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsed={collapsed}
              toggle={toggle}
              matchIds={matchIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Search across offices and people.
 *
 * Losing the People page means losing the flat roster list, so this has to
 * stand in for it: matching a name has to be able to point at the node that
 * person sits under, not just at the office they head.
 */
