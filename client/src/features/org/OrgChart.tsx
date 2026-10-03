import { useEffect, useRef, useState } from "react";
import { Building2, Landmark, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { computeChartLayout, type ChartNode } from "@/features/org/chartLayout";
import { cn } from "@/lib/utils";
import type { OrgTreeNode } from "@/features/org/types";
import type { OrgNodeKind } from "@/types";

/**
 * The organization as an org chart: solid circles in rows, joined by elbows.
 *
 * Nodes are filled circles with the label underneath, because that is the form
 * people already read as a hierarchy. The earlier list lost the node entirely,
 * and the radial version kept the node but drew straight diagonals between
 * centres -- which reads as a web, because the eye follows an elbow and does not
 * follow a diagonal.
 *
 * Connectors are strictly horizontal and vertical. That is the whole point:
 * a vertical drop says "descends from", a horizontal run says "sibling of", and
 * the two together are unambiguous at a glance.
 */

const KIND_COLOR: Record<OrgNodeKind, string> = {
  DEPARTMENT: "hsl(215 72% 45%)",
  OFFICE: "hsl(348 68% 46%)",
  SUB_UNIT: "hsl(150 58% 40%)",
};

/** The root is neutral, so it reads as the trunk rather than another branch. */
const ROOT_COLOR = "hsl(215 15% 28%)";

function Glyph({ kind }: { kind: OrgNodeKind }) {
  return kind === "DEPARTMENT" ? (
    <Landmark className="size-1/2" strokeWidth={2} />
  ) : (
    <Building2 className="size-1/2" strokeWidth={2} />
  );
}

export function OrgChart({
  tree,
  selectedId,
  onSelect,
}: {
  tree: OrgTreeNode[];
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
}) {
  const layout = computeChartLayout(tree);
  const byId = new Map(flatten(tree).map((n) => [n.id, n]));

  // Fit by default, enlarge on demand.
  //
  // The whole point of a chart is seeing the shape, so it has to be on screen
  // whole. With the super admin's 26 nodes that means small labels at first --
  // which is what "fit" is for, and why there is a zoom control rather than the
  // alternative of scrolling around a two-thousand-pixel canvas to find the
  // root. Everyone scoped to one branch sees it near 1:1 straight away.
  const [fit, setFit] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching to the enlarged view has to centre the root, not merely scroll to
  // the corner: the layout is centred on the root, which for the hierarchy
  // head's 26 nodes sits well past the right edge of the panel, so scrolling to
  // the origin shows the leftmost leaf instead.
  //
  // Deferred by a frame because the container is still fitted when the effect
  // runs; scrolling then and resizing afterwards leaves the viewport wherever
  // it happened to be, which is exactly the bug this replaces.
  useEffect(() => {
    if (fit) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const root = layout.nodes.find((n) => n.depth === 0);
      if (!root) return;
      el.scrollLeft = Math.max(0, root.x - el.clientWidth / 2);
      // A little headroom so the root circle is not clipped by the container edge.
      el.scrollTop = 0;
      void el;
    });
    return () => cancelAnimationFrame(id);
  }, [fit, layout.nodes]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFit((f) => !f)}
          aria-pressed={!fit}
        >
          {fit ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
          {fit ? "Read labels" : "Fit to view"}
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-background p-4"
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={
            fit
              ? { width: "100%", height: "auto", display: "block" }
              : { width: layout.width, height: layout.height, display: "block" }
          }
          role="tree"
          aria-label="Organization hierarchy"
          className="mx-auto"
        >
        {/* Connectors behind the nodes, so a line never crosses a circle. */}
        <g fill="none" stroke="hsl(var(--border))" strokeWidth={1.5}>
          {layout.connectors.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        <g>
          {layout.nodes.map((n) => (
            <ChartNodeView
              key={n.id}
              node={n}
              treeNode={byId.get(n.id)}
              selected={selectedId === n.id}
              onSelect={onSelect}
            />
          ))}
        </g>
      </svg>
      </div>
    </div>
  );
}

function ChartNodeView({
  node,
  treeNode,
  selected,
  onSelect,
}: {
  node: ChartNode;
  treeNode: OrgTreeNode | undefined;
  selected: boolean;
  onSelect: (node: OrgTreeNode) => void;
}) {
  if (!treeNode) return null;
  const r = node.radius;
  const isRoot = node.depth === 0;
  const fill = isRoot ? ROOT_COLOR : KIND_COLOR[node.kind];
  // Room for the name and the two lines beneath it, centred under the circle.
  const labelY = r + 20;

  return (
    <g>
      {/* The button is a circle the size of the node so the whole hit area is
          the node, not a bounding box around the label. */}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={fill}
        stroke={selected ? "hsl(var(--foreground))" : "transparent"}
        strokeWidth={3}
        className="transition-[stroke]"
      />
      <foreignObject x={node.x - r} y={node.y - r} width={r * 2} height={r * 2}>
        <button
          type="button"
          aria-label={`${treeNode.name}, ${treeNode.kind.replace("_", " ").toLowerCase()}`}
          aria-current={selected ? "true" : undefined}
          onClick={() => onSelect(treeNode)}
          className="flex size-full items-center justify-center rounded-full text-white"
        >
          <Glyph kind={node.kind} />
        </button>
      </foreignObject>

      <text
        x={node.x}
        y={node.y + labelY}
        textAnchor="middle"
        className={cn(
          "fill-foreground text-[13px] font-semibold",
          selected && "fill-primary",
        )}
      >
        {truncate(treeNode.name, 24)}
      </text>
      <text x={node.x} y={node.y + labelY + 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {treeNode.code}
      </text>
      <text x={node.x} y={node.y + labelY + 29} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {describe(treeNode)}
      </text>
    </g>
  );
}

/** One short line of context per node, rather than a wall of numbers. */
function describe(node: OrgTreeNode): string {
  const branches = node.children?.length ?? 0;
  const people = node.totalEmployeeCount;
  const bits: string[] = [];
  if (branches > 0) bits.push(`${branches} branch${branches === 1 ? "" : "es"}`);
  if (people > 0) bits.push(`${people} ${people === 1 ? "person" : "people"}`);
  if (bits.length === 0) return node.kind.replace("_", " ").toLowerCase();
  return bits.join(" · ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function flatten(nodes: OrgTreeNode[]): OrgTreeNode[] {
  const out: OrgTreeNode[] = [];
  const walk = (list: OrgTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}