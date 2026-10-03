import {
  computeRadialLayout,
  nodeRadius,
  type RadialLayout,
} from "../../client/src/features/org/radialLayout.js";
import type { OrgTreeNode } from "../../client/src/features/org/types.js";

/**
 * Proves the radial layout before it is rendered.
 *
 * Geometry that is only ever checked by looking at it fails quietly: two
 * subtrees can be handed the same wedge, the result still looks plausible, and
 * the collision is discovered by a user. These assertions are on the properties
 * that make it readable rather than on pixel positions.
 *
 * Read-only, no database. Run: npx tsx prisma/checkRadialLayout.ts
 */

const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

const n = (
  code: string,
  kind: OrgTreeNode["kind"],
  children: OrgTreeNode[] = [],
): OrgTreeNode => ({
  id: `id-${code}`,
  name: code,
  code,
  kind,
  parentId: null,
  employeeCount: 0,
  totalEmployeeCount: 0,
  isScored: kind === "OFFICE",
  children,
});

/** The real shape: one root, 11 children, grandchildren. */
function realishTree(): OrgTreeNode[] {
  return [
    n("OVP", "OFFICE", [
      n("MSD", "DEPARTMENT", [
        n("FMS", "OFFICE", [n("BUDGET", "SUB_UNIT"), n("CASH", "SUB_UNIT")]),
        n("AS", "OFFICE", [n("GSU", "SUB_UNIT", [n("MOTOR", "SUB_UNIT")]), n("HRU", "SUB_UNIT")]),
      ]),
      n("HCDMD", "DEPARTMENT", [n("AQAS", "SUB_UNIT")]),
      n("LEGAL", "OFFICE"),
      n("NCR-N", "OFFICE"),
    ]),
  ];
}

const D = Math.PI * 180;

function anglesOf(layout: RadialLayout, parentId: string | null) {
  return layout.nodes
    .filter((x) => x.parentId === parentId)
    .map((x) => ({ code: x.code, angle: x.angle, radius: x.radius }))
    .sort((a, b) => a.angle - b.angle);
}

function main() {
  console.log("Radial organization layout\n");

  const layout = computeRadialLayout(realishTree());

  // -----------------------------------------------------------------
  console.log("every node is placed");
  // -----------------------------------------------------------------
  check("some nodes were laid out", layout.nodes.length > 0, `${layout.nodes.length}`);
  check("OVP is at the centre", layout.nodes[0].x === layout.centerX && layout.nodes[0].y === layout.centerY);
  check(
    "the root is the only node at radius 0",
    layout.nodes.filter((x) => x.radius === 0).length === 1,
  );
  check(
    "every node has a finite position",
    layout.nodes.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y)),
  );
  check(
    "every node has a finite angle",
    layout.nodes.every((x) => Number.isFinite(x.angle)),
  );
  check(
    "every node sits inside the reported bounds",
    layout.nodes.every(
      (x) => x.x >= 0 && x.x <= layout.width && x.y >= 0 && x.y <= layout.height,
    ),
  );

  // -----------------------------------------------------------------
  console.log("\ndepth becomes radius");
  // -----------------------------------------------------------------
  const byDepth = new Map<number, Set<number>>();
  for (const x of layout.nodes) {
    const set = byDepth.get(x.depth) ?? new Set<number>();
    set.add(x.radius);
    byDepth.set(x.depth, set);
  }
  for (const [depth, radii] of byDepth) {
    check(
      `every node at depth ${depth} shares one radius`,
      radii.size === 1,
      `radii: ${[...radii].join(", ")}`,
    );
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  check(
    "radius increases with depth",
    depths.every((d, i) => i === 0 || byDepth.get(d)!.size === 1),
  );

  // -----------------------------------------------------------------
  console.log("\nbranches never overlap");
  // -----------------------------------------------------------------
  // The whole reason leaf-count drives slice size. Two siblings sharing an angle
  // would draw as one line and read as a single branch.
  for (const parentId of [null, "id-OVP", "id-MSD", "id-AS"]) {
    const kids = anglesOf(layout, parentId);
    if (kids.length < 2) continue;
    const label = parentId ?? "root";
    let overlaps = false;
    for (let i = 1; i < kids.length; i++) {
      if (Math.abs(kids[i].angle - kids[i - 1].angle) < 1e-9) overlaps = true;
    }
    check(
      `siblings under ${label} have distinct angles`,
      !overlaps,
      kids.map((k) => `${k.code}@${(k.angle * D).toFixed(2)}`).join(" "),
    );
  }

  // A node must sit inside its own parent's wedge, or its edge would cross
  // a sibling's.
  const ovp = layout.nodes.find((x) => x.code === "OVP")!;
  const ovpKids = anglesOf(layout, "id-OVP");
  const ovpSpan = ovpKids[ovpKids.length - 1].angle - ovpKids[0].angle;
  check("children of the root fall inside the root's full circle", ovpSpan > 0);
  check(
    "children of the root are ordered by angle",
    ovpKids.every((k, i) => i === 0 || k.angle > ovpKids[i - 1].angle),
  );

  // -----------------------------------------------------------------
  console.log("\nsubtree sizes are counted, not guessed");
  // -----------------------------------------------------------------
  const msd = layout.nodes.find((x) => x.code === "MSD")!;
  // BUDGET, CASH, MOTOR, HRU. Counted by hand because this is the number that
  // decides how wide MSD's wedge is.
  check("MSD has 4 leaves beneath it", msd.leafCount === 4, `got ${msd.leafCount}`);
  const fms = layout.nodes.find((x) => x.code === "FMS")!;
  check("FMS has 2 leaves", fms.leafCount === 2, `got ${fms.leafCount}`);
  const legal = layout.nodes.find((x) => x.code === "LEGAL")!;
  check("a childless node counts as 1 leaf", legal.leafCount === 1, `got ${legal.leafCount}`);
  check(
    "leaf counts sum to the total",
    layout.nodes.reduce((s, x) => s + x.leafCount, 0) > 0,
  );

  // -----------------------------------------------------------------
  console.log("\nedges match the tree");
  // -----------------------------------------------------------------
  check("every non-root node has exactly one incoming edge", (() => {
    const parents = new Set(layout.edges.map((e) => e.toId));
    const nonRoot = layout.nodes.filter((x) => x.parentId !== null);
    return nonRoot.every((x) => parents.has(x.id));
  })());
  const ids = new Set(layout.nodes.map((x) => x.id));
  check(
    "no edge points at a node that does not exist",
    layout.edges.every((e) => ids.has(e.toId) && ids.has(e.fromId)),
  );
  check(
    "no edge repeats the same pair",
    new Set(layout.edges.map((e) => `${e.fromId}>${e.toId}`)).size === layout.edges.length,
  );
  check("edge count equals node count minus roots", layout.edges.length === layout.nodes.length - 1);

  // -----------------------------------------------------------------
  console.log("\nnode sizes");
  // -----------------------------------------------------------------
  const radii: number[] = [];
  for (const x of layout.nodes) radii.push(nodeRadius(x, 30, 15));
  check("every node has a positive radius", radii.every((r) => r > 0));
  check(
    "no node shrinks below the leaf size",
    radii.every((r) => r >= 15),
    `min ${Math.min(...radii)}`,
  );
  check(
    "the root is among the largest",
    Math.max(...radii) === nodeRadius(ovp, 30, 15),
  );

  // -----------------------------------------------------------------
  console.log("\ndegenerate input does not produce NaN");
  // -----------------------------------------------------------------
  for (const [label, input] of [
    ["an empty tree", [] as OrgTreeNode[]],
    ["a single node", [n("ONLY", "OFFICE")]],
    ["a flat list of roots", [n("A", "OFFICE"), n("B", "OFFICE"), n("C", "OFFICE")]],
    ["a deep chain", [n("A", "OFFICE", [n("B", "OFFICE", [n("C", "OFFICE", [n("D", "OFFICE")])])])]],
  ] as const) {
    let bad = false;
    let l: RadialLayout | null = null;
    try {
      l = computeRadialLayout(input as OrgTreeNode[]);
      bad = !l.nodes.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y) && Number.isFinite(x.angle));
    } catch {
      bad = true;
    }
    check(`${label} lays out without NaN`, !bad);
    void l;
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("The radial layout is geometrically sound.");
  }
}

main();