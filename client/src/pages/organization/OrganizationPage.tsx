import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrgChart } from "@/features/org/OrgChart";
import { OrgNodeDrawer } from "@/features/org/OrgNodeDrawer";
import { OrgSearch } from "@/features/org/OrgSearch";
import { useOrgTree, type OrgTreeNode } from "@/features/org/hooks";

/**
 * The organization structure.
 *
 * A chart rather than a table, because the thing people are looking for is
 * "where does this sit under", and a table answers that by counting rows.
 *
 * There is no separate People page any more: this is where the roster lives.
 * The IT administrator manages accounts and people as a systems function, and
 * they manage them from here.
 *
 * Every account type sees the chart. What a node *contains* depends on the
 * caller's authority, and that is resolved on the server -- see
 * orgNodeDetailLevel. The client does not filter anything itself, because
 * anything it filtered could also be leaked by not filtering it.
 */
export function OrganizationPage() {
  const { data: tree, isLoading, isError } = useOrgTree();
  const [selected, setSelected] = useState<OrgTreeNode | null>(null);
  // The graph wants the full page width until someone actually opens a node.
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading the organization…</p>;
  }

  if (isError || !tree) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Organization</h1>
        <p className="text-sm text-destructive">Could not load the organization.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Organization</h1>
          <p className="text-sm text-muted-foreground">
            Select an office to see who heads it, who works there, and what it is
            working on. You can see every office; detail follows your own part of
            the structure.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label={drawerOpen ? "Hide office detail" : "Show office detail"}
        >
          {drawerOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
          {drawerOpen ? "Hide detail" : "Show detail"}
        </Button>
      </div>

      <div
          className={
            drawerOpen
              ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]"
              : "grid grid-cols-1 gap-6"
          }
        >
        <div className="flex flex-col gap-4">
          <div className="max-w-sm">
            <OrgSearch
              nodes={tree}
              onPick={(node: OrgTreeNode) => {
                setSelected(node);
                setDrawerOpen(true);
              }}
            />
          </div>

                      <OrgChart
              tree={tree}
              selectedId={selected?.id ?? null}
              onSelect={(node) => {
                setSelected(node);
                setDrawerOpen(true);
              }}
            />
        </div>

        {drawerOpen && (
          <aside
            aria-label="Office detail"
            className="rounded-lg border border-border lg:sticky lg:top-4 lg:self-start"
          >
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Office detail
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    Clear
                  </Button>
                </div>
                <div className="max-h-[70vh] overflow-auto">
                  <OrgNodeDrawer officeId={selected.id} />
                </div>
              </>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Choose an office from the chart to see who heads it and what it is
                working on.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}