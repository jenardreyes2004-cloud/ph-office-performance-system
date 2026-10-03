import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { flattenTree } from "@/features/org/hooks";
import type { OrgTreeNode } from "@/features/org/types";

export function OrgSearch({
  nodes,
  onPick,
}: {
  nodes: OrgTreeNode[];
  onPick: (node: OrgTreeNode) => void;
}) {
  const [term, setTerm] = useState("");

  const flat = useMemo(() => flattenTree(nodes), [nodes]);

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    return flat.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.code.toLowerCase().includes(q) ||
        n.kind.toLowerCase().includes(q),
    );
  }, [flat, term]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Find an office…"
          className="pl-8"
          aria-label="Find an office"
        />
        {term && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setTerm("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <ul className="flex max-h-56 flex-col overflow-auto rounded-md border border-border">
          {matches.slice(0, 12).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onPick(n)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{n.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {n.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term.trim().length >= 2 && matches.length === 0 && (
        <p className="text-sm text-muted-foreground">No office matches “{term}”.</p>
      )}
    </div>
  );
}
