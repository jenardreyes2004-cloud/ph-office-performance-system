import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermission } from "@/features/auth/usePermission";
import { CreateOfficeDialog } from "@/features/offices/CreateOfficeDialog";
import { useArchiveOffice, useOfficeTree, useOffices } from "@/features/offices/hooks";
import type { OfficeNode } from "@/features/offices/types";
import type { OrgNodeKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<OrgNodeKind, string> = {
  DEPARTMENT: "Department",
  OFFICE: "Office",
  SUB_UNIT: "Sub-unit",
};

const KIND_BADGE: Record<OrgNodeKind, "default" | "secondary" | "outline"> = {
  DEPARTMENT: "default",
  OFFICE: "secondary",
  SUB_UNIT: "outline",
};

/**
 * The organizational hierarchy and nothing else.
 *
 * This is the STRUCTURE spine. It deliberately shows no projects, no scores
 * and no progress — only the shape of the organization and its headcount.
 * Mixing work data into this view is what previously made "Offices"
 * ambiguous: a reader could not tell whether they were looking at the org
 * chart or at a list of things to do.
 */
function Branch({
  node,
  depth,
  expanded,
  onToggle,
  matches,
}: {
  node: OfficeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  matches: Set<string> | null;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  // While searching, a node is shown if it matches or if it leads to a match.
  const selfMatches = matches === null || matches.has(node.id);
  if (matches !== null && !selfMatches && node.children.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 border-b border-border/40 last:border-b-0",
        matches !== null && matches.has(node.id) && "bg-primary/5"
      )}
      style={{ paddingLeft: `${depth * 18 + 8}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}

      <span className="text-sm font-medium">{node.name}</span>
      <span className="text-xs text-muted-foreground font-mono">{node.code}</span>

      <Badge variant={KIND_BADGE[node.kind]} className="text-[10px]">
        {KIND_LABEL[node.kind]}
      </Badge>

      {node.isScored && (
        <Badge variant="outline" className="text-[10px]">
          Scored
        </Badge>
      )}

      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
        {node.totalEmployeeCount} staff
      </span>
    </div>
  );
}

function renderChildren(
  node: OfficeNode,
  depth: number,
  expanded: Set<string>,
  onToggle: (id: string) => void,
  matches: Set<string> | null,
) {
  if (!expanded.has(node.id)) return null;
  return node.children.map((child) => (
    <Branch
      key={child.id}
      node={child}
      depth={depth + 1}
      expanded={expanded}
      onToggle={onToggle}
      matches={matches}
    />
  ));
}

export function OrganizationPage() {
  const { data, isLoading, isError } = useOfficeTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // Expand the top level once the query lands, so the structure is visible
  // without any clicking. The useState initializer runs before the data
  // arrives, so this cannot be done there.
  const rootKey = (data ?? []).map((o) => o.id).join(",");
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (data && data.length > 0 && seededFor !== rootKey) {
    setSeededFor(rootKey);
    setExpanded(new Set(data.map((o) => o.id)));
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Ids matching the search, plus every ancestor leading to one. */
  function computeMatches(nodes: OfficeNode[], term: string): Set<string> | null {
    if (!term.trim()) return null;
    const needle = term.toLowerCase();
    const result = new Set<string>();

    const walk = (node: OfficeNode, ancestors: string[]): boolean => {
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

  const matches = computeMatches(data ?? [], query);
  // While searching, force everything open so hits deep in the tree are visible.
  const effectiveExpanded = matches ? new Set<string>([...expanded, ...matches]) : expanded;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading the structure…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Failed to load the organization structure.
          </p>
        </CardContent>
      </Card>
    );
  }

  const nodes = data ?? [];
  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No offices in the structure yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organization</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            The shape of the organization: departments, the offices under them,
            and their sub-units. This is structure only — projects and progress
            live under Work.
          </p>
        </div>
        <div className="relative w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a unit…"
            className="pl-8"
            aria-label="Search the organization"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="default" className="text-[10px]">Department</Badge>
        <Badge variant="secondary" className="text-[10px]">Office</Badge>
        <Badge variant="outline" className="text-[10px]">Sub-unit</Badge>
        <Badge variant="outline" className="text-[10px]">Scored — runs a Balanced Scorecard</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          {nodes.map((root) => (
            <div key={root.id}>
              <Branch
                node={root}
                depth={0}
                expanded={effectiveExpanded}
                onToggle={toggle}
                matches={matches}
              />
              {renderChildren(root, 0, effectiveExpanded, toggle, matches)}
            </div>
          ))}
          {matches && matches.size === 0 && (
            <p className="text-sm text-muted-foreground pt-4">
              Nothing matches “{query}”.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Looking for something to do?{" "}
        <Link to="/projects" className="underline">
          Projects
        </Link>{" "}
        and{" "}
        <Link to="/my-work" className="underline">
          My Work
        </Link>{" "}
        cover assignments and targets.
      </p>

      {/* Admin actions live on the same page as the tree, so structure is never
          split across two screens. A reader looking at the org chart is
          looking at the thing they can also edit. */}
      <OrganizationAdminSection />
    </div>
  );
}

/** Flat directory plus the create/archive controls. Super admin only. */
function OrganizationAdminSection() {
  const { can } = usePermission();
  const { data: offices, isLoading } = useOffices();
  const archiveOffice = useArchiveOffice();
  const [showDirectory, setShowDirectory] = useState(false);

  const canManage = can("offices.manage");
  if (!canManage) return null;

  const KIND_LABEL: Record<OrgNodeKind, string> = {
    DEPARTMENT: "Department",
    OFFICE: "Office",
    SUB_UNIT: "Sub-unit",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Manage the structure</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDirectory((v) => !v)}
            >
              {showDirectory ? "Hide directory" : "Show flat directory"}
            </Button>
            <CreateOfficeDialog />
          </div>
        </div>
        <CardDescription>
          Create departments, offices and sub-units; re-parent them from the
          dialog. Archiving a unit with active sub-units is refused by the
          server.
        </CardDescription>
      </CardHeader>

      {showDirectory && (
        <CardContent className="pt-0">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {offices && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell className="font-medium">{office.name}</TableCell>
                    <TableCell className="font-mono text-xs">{office.code}</TableCell>
                    <TableCell>
                      {office.kind && (
                        <Badge variant="outline" className="text-[10px]">
                          {KIND_LABEL[office.kind]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {office.parent?.name ?? "— top level —"}
                    </TableCell>
                    <TableCell>{office._count?.employees ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={archiveOffice.isPending}
                        onClick={() => archiveOffice.mutate(office.id)}
                      >
                        Archive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
