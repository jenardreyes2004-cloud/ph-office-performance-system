import "dotenv/config";

/**
 * Exercises the Organization page's search logic against the real tree served
 * by GET /api/offices/tree.
 *
 * The point of the search is that a hit deep in the tree also reveals the path
 * to it — a user searching for "Comptrollership" must see it, and must be able
 * to see which office it belongs to, without expanding anything by hand.
 * Filtering everything else out is the other half of the job.
 */

const API = process.env.DATABASE_URL ? "http://localhost:4000/api" : "http://localhost:4000/api";

interface Node {
  id: string;
  name: string;
  code: string;
  children: Node[];
}

async function main() {
  // The tree is behind authenticate, so log in first and keep the cookie.
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "main.admin@test.local", password: "Test@1234" }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() ?? []).join("; ");

  const res = await fetch(`${API}/offices/tree`, { headers: { cookie } });
  if (!res.ok) throw new Error(`tree fetch failed: ${res.status}`);
  const tree = (await res.json()) as Node[];

  // Identical to computeMatches() in OrganizationPage.tsx.
  function computeMatches(nodes: Node[], term: string): Set<string> | null {
    if (!term.trim()) return null;
    const needle = term.toLowerCase();
    const result = new Set<string>();

    const walk = (node: Node, ancestors: string[]): boolean => {
      const hit =
        node.name.toLowerCase().includes(needle) ||
        node.code.toLowerCase().includes(needle);
      if (hit) {
        for (const id of [...ancestors, node.id]) result.add(id);
        return true;
      }
      return node.children.some((c) => walk(c, [...ancestors, node.id]));
    };

    nodes.forEach((n) => walk(n, []));
    return result;
  }

  const find = (nodes: Node[], code: string): Node | null => {
    for (const n of nodes) {
      if (n.code === code) return n;
      const hit = find(n.children, code);
      if (hit) return hit;
    }
    return null;
  };

  const failures: string[] = [];
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` — ${detail}`}`);
    if (!ok) failures.push(label);
  };

  const cases = [
    { term: "comptrollership", target: "COMPTROLLERSHIP", path: ["OVP", "MSD", "FMS"] },
    { term: "motorpool", target: "MOTORPOOL", path: ["OVP", "MSD", "AS", "GSU"] },
    { term: "legal", target: "LEGAL", path: ["OVP"] },
    { term: "ncr-n", target: "NCR-N", path: ["OVP"] },
    { term: "fund management", target: "FMS", path: ["OVP", "MSD"] },
  ];

  for (const c of cases) {
    const matches = computeMatches(tree, c.term);
    const target = find(tree, c.target);
    if (!target) {
      check(`${c.term}: target ${c.target} exists`, false, "not in tree");
      continue;
    }

    check(`${c.term}: matches the target`, matches?.has(target.id) === true);
    for (const ancestorCode of c.path) {
      const a = find(tree, ancestorCode);
      check(
        `${c.term}: reveals ancestor ${ancestorCode}`,
        !!a && matches?.has(a.id) === true,
        "ancestor hidden, so the hit is unreachable",
      );
    }
  }

  // A term that cannot match anything must return an empty set, which the
  // page renders as "Nothing matches".
  const noHits = computeMatches(tree, "zzzzzz");
  check("nonsense term returns no matches", noHits !== null && noHits.size === 0);

  // An empty term must disable filtering entirely rather than matching nothing.
  const noTerm = computeMatches(tree, "   ");
  check("blank term disables filtering", noTerm === null);

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Organization search logic verified against the live tree.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
