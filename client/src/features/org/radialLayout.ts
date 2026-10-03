import type { OrgNodeKind, OrgTreeNode } from "./types";

/**
 * Radial layout for the organization chart.
 *
 * Pure geometry, deliberately separate from rendering, because a layout that is
 * only ever checked by looking at it will be wrong before anyone notices: two
 * subtrees can both be told to occupy the same wedge and the result still looks
 * plausible.
 *
 * The shape is the one people recognise from a dependency graph: the root at the
 * centre, depth becomes radius, and each node gets an angular slice sized by the
 * number of leaves beneath it. Sizing by leaf count rather than by child count
 * is what keeps branches from colliding -- a node with one wide subtree and a
 * node with five narrow ones each get the room they actually need.
 */

export interface RadialNode {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  parentId: string | null;
  depth: number;
  /** Radians, measured clockwise from straight up. */
  angle: number;
  radius: number;
  x: number;
  y: number;
  /** Leaves in this subtree; drives both slice size and node size. */
  leafCount: number;
  /** Everyone in this subtree, not counting itself. */
  subtreeSize: number;
}

export interface RadialEdge {
  fromId: string;
  toId: string;
}

export interface RadialLayout {
  nodes: RadialNode[];
  edges: RadialEdge[];
  /** Bounding box of the whole graph, including label allowance. */
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  maxRadius: number;
}

export interface LayoutOptions {
  /** Distance from the centre to each successive level. */
  ringGap?: number;
  /** Node radius for the root; deeper levels shrink toward this. */
  rootRadius?: number;
  leafRadius?: number;
  /** Horizontal room reserved to the right of a node for its label. */
  labelWidth?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  // Wide, on purpose. Eleven children around one ring is crowded at anything
  // tighter, and crowded labels are worse than having to pan.
  ringGap: 250,
  rootRadius: 30,
  leafRadius: 15,
  labelWidth: 170,
};

/** Angle the first branch sits at: straight up, so the tree reads top-down. */
const START_ANGLE = -Math.PI / 2;

function countLeaves(node: OrgTreeNode): number {
  const kids = node.children ?? [];
  if (kids.length === 0) return 1;
  return kids.reduce((sum, k) => sum + countLeaves(k), 0);
}

function countSubtree(node: OrgTreeNode): number {
  const kids = node.children ?? [];
  return 1 + kids.reduce((sum, k) => sum + countSubtree(k), 0);
}

export function computeRadialLayout(
  tree: OrgTreeNode[],
  options: LayoutOptions = {},
): RadialLayout {
  const { ringGap, rootRadius, labelWidth } = { ...DEFAULTS, ...options };

  const nodes: RadialNode[] = [];
  const edges: RadialEdge[] = [];

  // Every root shares the centre. Real data has exactly one, but a list is the
  // honest input type and quietly dropping extras would hide a data problem.
  const centerX = 0;
  const centerY = 0;
  let maxRadius = rootRadius;

  const place = (
    node: OrgTreeNode,
    parentId: string | null,
    depth: number,
    startAngle: number,
    endAngle: number,
  ) => {
    const kids = node.children ?? [];
    const span = endAngle - startAngle;
    // A node sits on the bisector of its own wedge, which is what stops a
    // parent's edge from entering at an arbitrary point on its circle.
    const angle = kids.length === 0 ? startAngle + span / 2 : startAngle + span / 2;
    const radius = depth * ringGap;

    const placed: RadialNode = {
      id: node.id,
      name: node.name,
      code: node.code,
      kind: node.kind,
      parentId,
      depth,
      angle,
      radius,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      leafCount: countLeaves(node),
      subtreeSize: countSubtree(node) - 1,
    };
    nodes.push(placed);
    maxRadius = Math.max(maxRadius, radius + rootRadius);

    if (kids.length === 0) return;

    const totalLeaves = placed.leafCount;
    let cursor = startAngle;
    for (const child of kids) {
      const childLeaves = countLeaves(child);
      const childSpan = (childSpanFor(childLeaves, totalLeaves)) * span;
      const childStart = cursor;
      const childEnd = cursor + childSpan;
      edges.push({ fromId: node.id, toId: child.id });
      place(child, node.id, depth + 1, childStart, childEnd);
      cursor = childEnd;
    }
  };

  const childSpanFor = (childLeaves: number, totalLeaves: number) =>
    totalLeaves === 0 ? 1 : childLeaves / totalLeaves;

  // Split the full circle between the roots, then lay each one out.
  const totalRootsLeaves = tree.reduce((sum, t) => sum + countLeaves(t), 0) || 1;
  let cursor = START_ANGLE;
  const full = Math.PI * 2;
  for (const root of tree) {
    const span = (countLeaves(root) / totalRootsLeaves) * full;
    place(root, null, 0, cursor, cursor + span);
    cursor += span;
  }

  // Shift so the whole thing sits in the first quadrant with room for labels.
  const width = maxRadius * 2 + labelWidth;
  const height = maxRadius * 2 + labelWidth;
  for (const n of nodes) {
    n.x += maxRadius;
    n.y += maxRadius;
  }

  return {
    nodes,
    edges,
    width,
    height,
    centerX: maxRadius,
    centerY: maxRadius,
    maxRadius,
  };
}

/** Node radius shrinks with depth, but never below the leaf size. */
export function nodeRadius(node: RadialNode, rootRadius: number, leafRadius: number): number {
  const falloff = Math.max(0.55, 1 - node.depth * 0.18);
  // A node carrying a lot of the organization reads as more significant, so it
  // gets a little more presence without letting the root vanish among leaves.
  const weight = 1 + Math.min(node.leafCount, 12) / 40;
  return Math.max(leafRadius, rootRadius * falloff * weight);
}