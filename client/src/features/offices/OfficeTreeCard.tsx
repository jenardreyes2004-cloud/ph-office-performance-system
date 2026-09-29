import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useOfficeTree } from "@/features/offices/hooks";
import type { OfficeNode } from "@/features/offices/types";

function OfficeRow({
  node,
  depth,
  onToggle,
  expanded,
}: {
  node: OfficeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-b-0"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          >
            {isOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <span className="text-sm font-medium">{node.name}</span>
        <span className="text-xs text-muted-foreground">{node.code}</span>

        {node.isHeadOffice && (
          <Badge variant="secondary" className="text-[10px]">
            Scored
          </Badge>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {node.totalEmployeeCount} employee{node.totalEmployeeCount === 1 ? "" : "s"}
        </span>
      </div>

      {isOpen &&
        node.children.map((child) => (
          <OfficeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export function OfficeTreeCard() {
  const { data, isLoading, isError } = useOfficeTree();

  // Collapsed by default. useState's initializer only runs on the first
  // render, and at that point `data` is still undefined (the query is in
  // flight) — expanding the roots from an empty array here would leave the
  // tree collapsed forever.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Once the data lands, open the top level so the structure is visible
  // without any clicking. Keyed on the root ids so this re-runs if the tree
  // changes, and only ever adds to the set, so a manual collapse sticks.
  const rootKey = (data ?? []).map((o) => o.id).join(",");
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (seededFor.current === rootKey) return;
    seededFor.current = rootKey;
    setExpanded(new Set(data.map((o) => o.id)));
  }, [data, rootKey]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading structure…</p>
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

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No offices yet. Create the first one above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <p
          className={cn(
            "mb-3 text-xs uppercase tracking-wide text-muted-foreground",
          )}
        >
          Organization structure
        </p>
        {data.map((root) => (
          <OfficeRow
            key={root.id}
            node={root}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </CardContent>
    </Card>
  );
}
