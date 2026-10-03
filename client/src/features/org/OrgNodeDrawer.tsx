import { CalendarDays, FolderKanban, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNodeOverview } from "@/features/org/hooks";
import { ACCESS_LEVEL_LABELS } from "@/lib/permissions";
import type { OrgPerson } from "@/features/org/hooks";
import type { OrgNodeKind } from "@/types";

const KIND_LABEL: Record<OrgNodeKind, string> = {
  DEPARTMENT: "Department",
  OFFICE: "Office",
  SUB_UNIT: "Sub-unit",
};

function Person({ person }: { person: OrgPerson }) {
  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <span>
        {person.firstName} {person.lastName}
      </span>
      {person.position && (
        <span className="truncate text-xs text-muted-foreground">{person.position}</span>
      )}
      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
        {ACCESS_LEVEL_LABELS[person.accessLevel] ?? person.accessLevel}
      </Badge>
    </li>
  );
}

/**
 * What one node shows when it is opened.
 *
 * The panel states plainly when it has nothing to show and why, rather than
 * rendering an empty shell. An employee opening an office outside their own
 * subtree should be told "you can see this office exists" -- not shown a blank
 * panel that looks broken.
 */
export function OrgNodeDrawer({ officeId }: { officeId: string | null }) {
  const { data, isLoading, isError } = useNodeOverview(officeId);

  if (!officeId) return null;

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">Could not load this office.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{data.name}</h2>
          <Badge variant="secondary" className="text-[10px]">
            {KIND_LABEL[data.kind]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.code}
          {data.parentName && ` · under ${data.parentName}`}
        </p>
        {data.description && (
          <p className="mt-2 text-sm text-muted-foreground">{data.description}</p>
        )}
      </div>

      {data.detailLevel === "NAMES" ? (
        <p className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
          This office sits outside your part of the organization, so you can see
          where it is but not who works there or what it is working on.
        </p>
      ) : (
        <>
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Head
            </h3>
            {data.head ? (
              <ul className="mt-1">
                <Person person={data.head} />
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No one is assigned to head this node.</p>
            )}
          </section>

          {data.managers && data.managers.length > 0 && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Heads beneath
              </h3>
              <ul className="mt-1 flex flex-col">
                {data.managers.map((m) => (
                  <Person key={m.id} person={m} />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="size-3" />
              People ({data.employeeCount ?? 0})
            </h3>
            {data.employees && data.employees.length > 0 ? (
              <ul className="mt-1 flex flex-col divide-y divide-border/50">
                {data.employees.map((e) => (
                  <Person key={e.id} person={e} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No one is attached to this node directly.
              </p>
            )}
          </section>

          {/* Work is absent entirely for the IT admin, not hidden by the client:
              the server does not send it. See orgNodeDetailLevel. */}
          {data.plans && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FolderKanban className="size-3" />
                Plans
              </h3>
              {data.plans.length > 0 ? (
                <ul className="mt-1 flex flex-col divide-y divide-border/50">
                  {data.plans.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.assignedCount} assigned
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {p.status.replace(/_/g, " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No plans cover this office or anything beneath it.
                </p>
              )}
            </section>
          )}

          {data.scorecard && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="size-3" />
                Latest scorecard
              </h3>
              <div className="mt-1 flex flex-col gap-1 text-sm">
                <p className="text-muted-foreground">{data.scorecard.period.label}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {data.scorecard.officeRating ?? data.scorecard.status}
                  </Badge>
                  {data.scorecard.totalScore !== null && (
                    <span className="tabular-nums text-muted-foreground">
                      {data.scorecard.totalScore} / {data.scorecard.totalWeight}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function OrgNodeDrawerSkeleton() {
  return <Button className="sr-only">Loading office</Button>;
}