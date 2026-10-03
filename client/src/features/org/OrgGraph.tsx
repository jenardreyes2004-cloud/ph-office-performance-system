import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Landmark, Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { computeRadialLayout, nodeRadius, type RadialLayout } from "@/features/org/radialLayout";
import type { OrgTreeNode } from "@/features/org/types";
import type { OrgNodeKind } from "@/types";

/**
 * The organization as a radial graph.
 *
 * Root at the centre, depth becomes radius, and each branch gets an angular
 * slice sized by the leaves beneath it. It is the shape people already
 * recognise from a dependency map, which is the point: nobody has to learn it.
 *
 * Drawn as SVG rather than a canvas or a graph library, so every node is a real
 * focusable button, the whole thing is reachable by keyboard, and it prints.
 *
 * Pan and zoom are hand-rolled -- two numbers and a transform -- because a
 * library for this would be most of the dependency.
 */

const KIND_COLOR: Record<OrgNodeKind, string> = {
  // Saturated for the top of the tree, lighter as it descends: depth reads as
  // tone, so a glance tells you how far down the branch is.
  DEPARTMENT: "hsl(215 72% 45%)",
  OFFICE: "hsl(348 68% 46%)",
  SUB_UNIT: "hsl(150 58% 40%)",
};

function Icon({ kind, className }: { kind: OrgNodeKind; className?: string }) {
  if (kind === "DEPARTMENT") return <Landmark className={className} />;
  if (kind === "SUB_UNIT") return <Building2 className={className} />;
  return <Building2 className={className} />;
}

export function OrgGraph({
  tree,
  selectedId,
  onSelect,
}: {
  tree: OrgTreeNode[];
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
}) {
  const layout = useMemo(() => computeRadialLayout(tree), [tree]);
  const byId = useMemo(() => new Map(treeNodes(tree).map((n) => [n.id, n])), [tree]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedNode = selectedId
    ? layout.nodes.find((n) => n.id === selectedId)
    : undefined;

  // The viewport is a *window* onto the graph rather than a fitted viewBox.
  // Fitting the whole thing into the panel made every label about eight pixels
  // tall, which is the same as not showing the chart at all. Zooming changes how
  // much of the graph the window covers; panning moves the window.
  // Sized to the panel's proportions on purpose. A landscape viewBox in a
  // portrait panel is scaled by whichever axis is tighter, and the graph ends up
  // at 43% with eight-pixel labels -- which is the same as not drawing it.
  const VIEW_W = 640;
  const VIEW_H = 840;
  // Labels are drawn outside their node's circle, so a viewBox that ends
  // exactly at the outermost node clips the text of everything near the rim.
  // This much slack on every side keeps the edge labels whole.
  const PAD = 90;
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const viewW = VIEW_W / zoom;
  const viewH = VIEW_H / zoom;
  const clamp = (z: number) => Math.min(3, Math.max(0.5, z));

  const reset = useCallback(() => {
    setZoom(1);
    setCentre({ x: 0, y: 0 });
  }, []);

  const fit = useCallback(() => {
    // At zoom z the window shows VIEW_W / z units. To see the whole graph the
    // window has to be at least as wide as the graph, so z = VIEW_W / width.
    // (Dividing the wrong way round zooms *in* to the root and hides the
    // branches, which is the opposite of fitting.)
    const widest = Math.max(layout.width, layout.height * (VIEW_W / VIEW_H));
    setZoom(clamp(VIEW_W / widest));
    setCentre({ x: 0, y: 0 });
  }, [layout.width, layout.height]);

  // Centre on the chosen node, so selecting one brings its neighbourhood into
  // view rather than leaving it off the edge.
  useEffect(() => {
    if (!selectedId) return;
    const node = layout.nodes.find((n) => n.id === selectedId);
    if (node) setCentre({ x: node.x, y: node.y });
  }, [selectedId, layout.nodes]);

  // Centre defaults to the root, in graph coordinates.
  const focusX = centre.x || layout.centerX;
  const focusY = centre.y || layout.centerY;

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => clamp(z + 0.25))} aria-label="Zoom in">
          <Plus className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => clamp(z - 0.25))} aria-label="Zoom out">
          <Minus className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={fit}>
          Fit
        </Button>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <span className="ml-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Legend kind="DEPARTMENT" label="Department" />
          <Legend kind="OFFICE" label="Office" />
          <Legend kind="SUB_UNIT" label="Sub-unit" />
        </span>
      </div>

      <div
        className="overflow-hidden rounded-lg border border-border bg-background"
        style={{ height: 560, cursor: drag.current ? "grabbing" : "grab" }}
        role="application"
        aria-label="Organization chart. Drag to pan, use the buttons to zoom."
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, panX: centre.x, panY: centre.y };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          // Panning moves the window onto the graph, not the graph under the
          // window. Keeping the drag in graph units means the content tracks the
          // pointer exactly at any zoom.
          const scale = viewW / 490;
          setCentre({
            x: drag.current.panX - (e.clientX - drag.current.x) * scale,
            y: drag.current.panY - (e.clientY - drag.current.y) * scale,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${focusX - viewW / 2 - PAD} ${focusY - viewH / 2 - PAD} ${viewW + PAD * 2} ${viewH + PAD * 2}`}
          preserveAspectRatio="xMidYMid meet"
          role="tree"
          aria-label="Organization hierarchy"
        >
          <g>
            {/* Edges first so nodes always sit above the lines. */}
            <g>
              {layout.edges.map((e) => {
                const from = layout.nodes.find((n) => n.id === e.fromId);
                const to = layout.nodes.find((n) => n.id === e.toId);
                if (!from || !to) return null;
                const isPath = selectedId === e.fromId || selectedId === e.toId;
                return (
                  <line
                    key={`${e.fromId}-${e.toId}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isPath ? "hsl(215 72% 45%)" : "hsl(var(--border))"}
                    strokeWidth={isPath ? 2.5 : 1.25}
                    opacity={selectedId && !isPath ? 0.35 : 1}
                  />
                );
              })}
            </g>

            <g>
              {layout.nodes.map((n) => {
                const node = byId.get(n.id);
                if (!node) return null;
                const r = nodeRadius(n, 30, 15);
                const isSelected = selectedId === n.id;
                const isHovered = hoveredId === n.id;
                // Depth is the crowding signal: the hub has eleven children on
                // one ring, and full names for all of them overlap into an
                // unreadable mat. The top two levels keep their names; deeper
                // nodes show a code and reveal their name on hover or selection,
                // which is when someone is actually reading one.
                const showLongLabel = n.depth <= 1 || isHovered || isSelected;
                const primary = showLongLabel
                  ? truncate(n.name, 20)
                  : n.code;
                const secondary =
                  n.depth === 0 || showLongLabel
                    ? n.code
                    : node.employeeCount > 0
                      ? `${node.employeeCount} staff`
                      : null;
                const dimmed = selectedId !== null && !isSelected && !isAncestorOrChild(
                  layout,
                  selectedId,
                  n.id,
                );
                // Labels sit outside the circle on the side away from the
                // centre, so they never land on top of the parent's line.
                const outward = n.radius === 0 ? 0 : 1;
                const lx = n.x + Math.cos(n.angle) * (r + 8) * outward + (outward ? 0 : 0);
                const ly = n.y + Math.sin(n.angle) * (r + 8) * outward;
                const anchor = labelAnchor(n.angle);

                return (
                  <g
                    key={n.id}
                    opacity={dimmed ? 0.28 : 1}
                    className="transition-opacity"
                    onPointerEnter={() => setHoveredId(n.id)}
                    onPointerLeave={() => setHoveredId((h) => (h === n.id ? null : h))}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill={KIND_COLOR[n.kind]}
                      stroke={isSelected ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <foreignObject
                      x={n.x - r}
                      y={n.y - r}
                      width={r * 2}
                      height={r * 2}
                    >
                      <button
                        type="button"
                        aria-label={`${n.name}, ${n.kind.replace("_", " ").toLowerCase()}`}
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => onSelect(node)}
                        className="flex size-full items-center justify-center rounded-full text-white"
                      >
                        <Icon kind={n.kind} className="size-1/2" />
                      </button>
                    </foreignObject>

                    <text
                      x={lx + (anchor === "end" ? -6 : anchor === "start" ? 6 : 0)}
                      y={ly - 6}
                      textAnchor={anchor}
                      className={
                        isSelected
                          ? "fill-foreground text-[15px] font-semibold"
                          : "fill-foreground text-[14px] font-medium"
                      }
                    >
                      {primary}
                    </text>
                    {secondary && (
                      <text
                        x={lx + (anchor === "end" ? -6 : anchor === "start" ? 6 : 0)}
                        y={ly + 11}
                        textAnchor={anchor}
                        className="fill-muted-foreground text-[12px]"
                      >
                        {secondary}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {selectedNode && (
        <p className="text-xs text-muted-foreground">
          {byId.get(selectedNode.id)?.name} — {selectedNode.subtreeSize} node
          {selectedNode.subtreeSize === 1 ? "" : "s"} beneath it.
        </p>
      )}
    </div>
  );
}

function Legend({ kind, label }: { kind: OrgNodeKind; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: KIND_COLOR[kind] }}
      />
      {label}
    </span>
  );
}

/** Which side of the node the label belongs on, so it reads outward. */
function labelAnchor(angle: number): "start" | "middle" | "end" {
  const cos = Math.cos(angle);
  if (cos > 0.25) return "start";
  if (cos < -0.25) return "end";
  return "middle";
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** True when `otherId` is on the path between `selectedId` and the root. */
function isAncestorOrChild(layout: RadialLayout, selectedId: string, otherId: string): boolean {
  const parents = new Map(layout.nodes.map((n) => [n.id, n.parentId]));
  const isAncestor = (maybeAncestor: string, of: string): boolean => {
    let cursor = parents.get(of) ?? null;
    while (cursor) {
      if (cursor === maybeAncestor) return true;
      cursor = parents.get(cursor) ?? null;
    }
    return false;
  };
  return isAncestor(selectedId, otherId) || isAncestor(otherId, selectedId);
}

function treeNodes(nodes: OrgTreeNode[]): OrgTreeNode[] {
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

export { KIND_COLOR };