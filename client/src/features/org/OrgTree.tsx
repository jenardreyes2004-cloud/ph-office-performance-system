import { ChevronRight, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgTreeNode } from "@/features/org/types";
import type { OrgNodeKind } from "@/types";

const KIND_LABEL: Record<OrgNodeKind, string> = {
  DEPARTMENT: "Department",
  OFFICE: "Office",
  SUB_UNIT: "Sub-unit",
};

const KIND_ACCENT: Record<OrgNodeKind, string> = {
  DEPARTMENT: "border-l-blue-500",
  OFFICE: "border-l-red-500",
  SUB_UNIT: "border-l-emerald-500",
};

/** Width of one level of indentation, and the gutter the connectors live in. */
const GUTTER = 26;

/**
 * The organization as a top-down tree with its connectors always drawn.
 *
 * Vertical, and every branch visible without touching anything. That is not a
 * style preference: the radial version needed a tap to reveal a relationship,
 * so you could not answer "what sits under this?" without interacting -- and on
 * a chart meant to answer that question, that is the whole job.
 *
 * Connectors are CSS borders on the nesting, not a drawn overlay, so they line
 * up at any width, survive a resize and print correctly. The elbow is the
 * standard org-chart shape: a spine down the gutter, and a stub across to each
 * child. The spine stops below the last child so a row of three does not look
 * like it continues forever.
 *
 * The server already rooted this tree at whatever the caller runs, so there is
 * nothing to filter here and no way for the client to reveal a branch it was
 * never sent.
 */
export function OrgTree({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: OrgTreeNode[];
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
  depth?: number;
}) {
  return (
    <ul
      className={cn("flex flex-col", depth > 0 && "ml-[13px] border-l border-border")}
      style={depth === 0 ? undefined : { paddingLeft: GUTTER - 1 }}
    >
      {nodes.map((node) => (
        <li key={node.id} className="relative">
          {/* Stub from the spine across to this row. */}
          {depth > 0 && (
            <span
              aria-hidden
              className="absolute left-0 top-[22px] h-px bg-border"
              style={{ width: GUTTER }}
            />
          )}
          <OrgTreeRow
            node={node}
            selected={selectedId === node.id}
            onSelect={onSelect}
          />
          {node.children && node.children.length > 0 && (
            <OrgTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function OrgTreeRow({
  node,
  selected,
  onSelect,
}: {
  node: OrgTreeNode;
  selected: boolean;
  onSelect: (node: OrgTreeNode) => void;
}) {
  const branchCount = node.children?.length ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative mb-1.5 flex w-full max-w-xl items-center gap-3 rounded-md border border-l-4 bg-card px-3 py-2 text-left transition-colors hover:bg-accent",
        KIND_ACCENT[node.kind],
        selected && "ring-2 ring-primary",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{node.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {node.code}
          {branchCount > 0 &&
            ` · ${branchCount} branch${branchCount === 1 ? "" : "es"} · ${node.totalEmployeeCount} people`}
        </span>
      </span>

      <Badge variant="outline" className="shrink-0 text-[10px]">
        {KIND_LABEL[node.kind]}
      </Badge>

      {node.employeeCount > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" />
          {node.employeeCount}
        </span>
      )}

      {node.isScored && node.scorecard?.officeRating && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {node.scorecard.officeRating}
        </Badge>
      )}

      {branchCount > 0 && (
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}