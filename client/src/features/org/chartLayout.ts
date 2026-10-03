import type { OrgNodeKind, OrgTreeNode } from "./types";

/**
 * Top-down org-chart layout: circles in rows, joined by orthogonal elbows.
 *
 * Pure geometry, separate from rendering, so it can be checked without looking
 * at it. An org chart fails in ways that are easy to miss by eye: two siblings
 * whose centres land on the same x, a connector that crosses a node, a subtree
 * that overlaps its neighbour.
 *
 * The horizontal rule is the classic one -- every leaf claims a slot, left to
 * right, and a parent sits above the midpoint of its children. That is what
 * makes a parent visibly "above" its own branch rather than over one of them,
 * and it is why the subtree count, not the child count, decides spacing.
 *
 * Connectors are strictly horizontal and vertical. The earlier radial version
 * drew straight lines between circle centres, which is why a branch read as a
 * web rather than a hierarchy: the eye follows an elbow instantly and a
 * diagonal not at all.
 */

export interface ChartNode {
  id: string;
  name: string;
  code: string;
  kind: OrgNodeKind;
  parentId: string | null;
  depth: number;
  x: number;
  y: number;
  radius: number;
  leafCount: number;
  subtreeSize: number;
}

export interface ChartLayout {
  nodes: ChartNode[];
  /** SVG path data for each connector, already in elbow form. */
  connectors: string[];
  width: number;
  height: number;
  maxDepth: number;
}

export interface ChartOptions {
  /** Horizontal room one leaf needs. */
  columnGap?: number;
  /** Vertical distance between rows. */
  rowGap?: number;
  nodeRadius?: number;
  /** Space under a node for its two lines of label. */
  labelHeight?: number;
  sidePadding?: number;
}

const DEFAULTS: Required<ChartOptions> = {
  columnGap: 190,
  rowGap: 165,
  nodeRadius: 26,
  labelHeight: 46,
  sidePadding: 120,
};

export function computeChartLayout(
  tree: OrgTreeNode[],
  options: ChartOptions = {},
): ChartLayout {
  const { columnGap, rowGap, nodeRadius, labelHeight, sidePadding } = {
    ...DEFAULTS,
    ...options,
  };

  const nodes: ChartNode[] = [];
  const connectors: string[] = [];
  let slot = 0;

  const measure = (node: OrgTreeNode): { leaves: number; size: number } => {
    const kids = node.children ?? [];
    if (kids.length === 0) return { leaves: 1, size: 1 };
    let leaves = 0;
    let size = 1;
    for (const k of kids) {
      const m = measure(k);
      leaves += m.leaves;
      size += m.size;
    }
    return { leaves, size };
  };

  const place = (
    node: OrgTreeNode,
    parentId: string | null,
    depth: number,
  ): ChartNode => {
    const kids = node.children ?? [];
    const m = measure(node);

    // Children first, then this node's own x. A parent sits above the midpoint
    // of its children, so its position cannot be known until they are placed --
    // reading the accumulator before recursing made every parent's x NaN.
    const xs: number[] = [];
    const y = depth * rowGap;

    if (kids.length > 0) {
      for (const k of kids) xs.push(place(k, node.id, depth + 1).x);
    }

    let x: number;
    if (kids.length === 0) {
      x = slot * columnGap;
      slot += 1;
    } else {
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }

    // The root reads as heavier, and each level steps down slightly, so depth
    // is legible from size alone.
    const radius = Math.max(16, nodeRadius - depth * 2);

    const placed: ChartNode = {
      id: node.id,
      name: node.name,
      code: node.code,
      kind: node.kind,
      parentId,
      depth,
      x,
      y,
      radius,
      leafCount: m.leaves,
      subtreeSize: m.size - 1,
    };
    nodes.push(placed);

    // Elbow: down out of the parent, across to the child's column, then down
    // into it. The horizontal run sits midway between the rows so it clears
    // both circles and never crosses a sibling's node.
    for (const cx of xs) {
      const fromY = y + radius;
      const toY = depth * rowGap + rowGap - (nodeRadius - (depth + 1) * 2);
      const midY = (fromY + toY) / 2;
      connectors.push(`M ${x} ${fromY} L ${x} ${midY} L ${cx} ${midY} L ${cx} ${toY}`);
    }
    return placed;
  };

  // Roots share row 0. One root in practice; a list is the honest input type.
  for (const root of tree) place(root, null, 0);

  const maxDepth = nodes.reduce((d, n) => Math.max(d, n.depth), 0);

  // Shift so nothing is negative, then size the canvas to the labels too --
  // a chart clipped at the last row looks broken even though the geometry is
  // correct.
  const minX = nodes.reduce((m, n) => Math.min(m, n.x - n.radius), Infinity);
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.radius), -Infinity);
  const shift = sidePadding - minX;

  for (const n of nodes) n.x += shift;

  // Rewriting the connectors keeps them in step with the shift.
  const shiftedConnectors = connectors.map((d) =>
    d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_all, x: string, y: string) =>
      `${Number(x) + shift} ${y}`,
    ),
  );

  const width = maxX - minX + shift + sidePadding;
  // Top padding so the root circle is not flush against the frame, and so the
  // scroll-to-centre has somewhere to land it.
  const height = maxDepth * rowGap + nodeRadius * 2 + labelHeight + 80;

  return { nodes, connectors: shiftedConnectors, width, height, maxDepth };
}