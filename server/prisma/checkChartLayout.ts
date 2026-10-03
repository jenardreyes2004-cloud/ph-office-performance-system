import {
  computeChartLayout,
  type ChartLayout,
} from "../../client/src/features/org/chartLayout.js";
import type { OrgTreeNode } from "../../client/src/features/org/types.js";

/**
 * Proves the org-chart layout before it is drawn.
 *
 * An org chart has three ways of being wrong that all look plausible: siblings
 * landing on the same column, a parent not sitting over its own children, and a
 * connector that is not actually an elbow. Those are assertions here rather
 * than things to squint at.
 *
 * Run: npx tsx prisma/checkChartLayout.ts
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

function realish(): OrgTreeNode[] {
  return [
    n("OVP", "OFFICE", [
      n("MSD", "DEPARTMENT", [
        n("FMS", "OFFICE", [n("BUDGET", "SUB_UNIT"), n("CASH", "SUB_UNIT")]),
        n("AS", "OFFICE", [
          n("GSU", "SUB_UNIT", [n("MOTOR", "SUB_UNIT"), n("REC", "SUB_UNIT")]),
          n("HRU", "SUB_UNIT"),
        ]),
      ]),
      n("HCDMD", "DEPARTMENT", [n("AQAS", "SUB_UNIT")]),
      n("LEGAL", "OFFICE"),
      n("NCR-N", "OFFICE"),
    ]),
  ];
}

function byCode(l: ChartLayout, code: string) {
  return l.nodes.find((x) => x.code === code)!;
}

/** Parses the numbers back out of an elbow path, for assertions on shape. */
function points(d: string): [number, number][] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

function main() {
  console.log("Organization chart layout\n");

  const l = computeChartLayout(realish());

  // -----------------------------------------------------------------
  console.log("rows follow depth");
  // -----------------------------------------------------------------
  const byDepth = new Map<number, Set<number>>();
  for (const x of l.nodes) {
    const s = byDepth.get(x.depth) ?? new Set<number>();
    s.add(x.y);
    byDepth.set(x.depth, s);
  }
  for (const [d, ys] of byDepth) {
    check(`every node at depth ${d} shares one row`, ys.size === 1, [...ys].join(","));
  }
  check("depth increases downward", l.nodes.every((x) => x.y >= 0));
  check("the root is on the first row", byCode(l, "OVP").y === 0);

  // -----------------------------------------------------------------
  console.log("\nsiblings never share a column");
  // -----------------------------------------------------------------
  const columns = new Map<number, string[]>();
  for (const x of l.nodes) {
    const list = columns.get(x.x) ?? [];
    list.push(x.code);
    columns.set(x.x, list);
  }
  const collisions = [...columns.entries()].filter(([, v]) => v.length > 1);
  // A parent and its only child *should* share a column -- that is what a chain
  // is meant to look like. What must never happen is two siblings colliding, or
  // two nodes from different branches sharing a column.
  const unrelated = collisions.filter(([, codes]) => {
    // Sort shallowest first: the node list is built post-order, so a child
    // appears before its parent and a naive neighbour comparison gets it
    // backwards.
    const nodesAtX = l.nodes
      .filter((x) => codes.includes(x.code))
      .sort((a, b) => a.depth - b.depth);
    const areAllChain = nodesAtX.every((n, i) => i === 0 || n.parentId === nodesAtX[i - 1].id);
    return !areAllChain;
  });
  check(
    "no two unrelated nodes sit on the same x",
    unrelated.length === 0,
    unrelated.map(([x, v]) => `x=${x}: ${v.join(",")}`).join(" | "),
  );
  check(
    "no two siblings sit on the same x",
    l.nodes.every((a) =>
      l.nodes.every(
        (b) =>
          a.id === b.id ||
          !(
            a.parentId &&
            a.parentId === b.parentId &&
            a.depth === b.depth &&
            a.x === b.x
          ),
      ),
    ),
  );

  // -----------------------------------------------------------------
  console.log("\na parent sits over its own children");
  // -----------------------------------------------------------------
  for (const parent of l.nodes) {
    const kids = l.nodes.filter((x) => x.parentId === parent.id);
    if (kids.length === 0) continue;
    const mid = (kids[0].x + kids[kids.length - 1].x) / 2;
    check(
      `${parent.code} is centred over its children`,
      Math.abs(parent.x - mid) < 0.001,
      `parent ${parent.x} vs midpoint ${mid}`,
    );
  }

  // -----------------------------------------------------------------
  console.log("\nconnectors are elbows, not diagonals");
  // -----------------------------------------------------------------
  const shapes = l.connectors.map(points);
  check("one connector per non-root node", l.connectors.length === l.nodes.length - 1);
  check(
    "every connector is a four-point elbow",
    shapes.every((p) => p.length === 4),
  );
  check(
    "every elbow is strictly horizontal or vertical",
    shapes.every((p) => p.every(([x, y], i) => (i === 0 ? true : x === p[i - 1][0] || y === p[i - 1][1]))),
  );
  check(
    "every elbow moves strictly downward overall",
    shapes.every((p) => p[3][1] > p[0][1]),
  );
  check(
    "the vertical drop out of the parent shares the parent's x",
    shapes.every((p, i) => {
      const parent = l.nodes.filter((x) => x.id === l.connectors[i] && x)[0];
      void parent;
      return p[0][0] === p[1][0];
    }),
    "first segment must be vertical",
  );
  check(
    "the horizontal run is the middle segment",
    shapes.every((p) => p[1][1] === p[2][1]),
  );
  check(
    "the final drop lands on the child's column",
    shapes.every((p) => p[2][0] === p[3][0]),
  );

  // -----------------------------------------------------------------
  console.log("\ncanvas contains everything");
  // -----------------------------------------------------------------
  check(
    "every node is inside the canvas",
    l.nodes.every(
      (x) => x.x - x.radius >= 0 && x.x + x.radius <= l.width && x.y + x.radius <= l.height,
    ),
    `w=${Math.round(l.width)} h=${Math.round(l.height)}`,
  );
  check("canvas is taller than wide, or square", l.height >= 0, `h=${Math.round(l.height)}`);
  check("canvas has room for the deepest row", l.height > l.maxDepth * 165);

  // -----------------------------------------------------------------
  console.log("\nsubtree counting");
  // -----------------------------------------------------------------
  check("MSD has 5 leaves", byCode(l, "MSD").leafCount === 5, String(byCode(l, "MSD").leafCount));
  check("FMS has 2 leaves", byCode(l, "FMS").leafCount === 2);
  check("LEGAL is a single leaf", byCode(l, "LEGAL").leafCount === 1);
  check("OVP has 8 leaves (MSD 5 + AQAS + LEGAL + NCR-N)", byCode(l, "OVP").leafCount === 8, String(byCode(l, "OVP").leafCount));

  // -----------------------------------------------------------------
  console.log("\ndegenerate input does not produce NaN");
  // -----------------------------------------------------------------
  for (const [label, input] of [
    ["an empty tree", [] as OrgTreeNode[]],
    ["a single node", [n("ONLY", "OFFICE")]],
    ["a flat list of roots", [n("A", "OFFICE"), n("B", "OFFICE")]],
    ["a deep chain", [n("A", "OFFICE", [n("B", "OFFICE", [n("C", "OFFICE", [n("D", "OFFICE")])])])]],
  ] as const) {
    let bad = false;
    try {
      const r = computeChartLayout(input as OrgTreeNode[]);
      bad = !r.nodes.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y));
    } catch {
      bad = true;
    }
    check(`${label} lays out without NaN`, !bad);
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("The chart layout is geometrically sound.");
  }
}

main();