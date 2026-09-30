import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ProgressBar";
import { usePermission } from "@/features/auth/usePermission";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { usePlans } from "@/features/plans/hooks";
import type { PlanAssignment } from "@/features/plans/types";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "DELAYED":
    case "CANCELLED":
      return "destructive" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    default:
      return "outline" as const;
  }
}

function dueLabel(due: string | null) {
  if (!due) return "No due date";
  const date = new Date(due);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

/**
 * The WORK spine, for one person.
 *
 * Everything here is "assigned to me" — the projects I am on, the tasks under
 * them, and the numbers I am expected to hit. It deliberately does not show the
 * organization's shape or anybody else's work; that lives under Structure and
 * Projects respectively.
 */
export function MyWorkPage() {
  const { data: plans, isLoading } = usePlans();
  const { data: stats } = useDashboardStats();
  const { can } = usePermission();

  // Plans are already scoped server-side to the caller's own assignments, so
  // this is not a client-side filter — the API never sent the rest.
  const assignments: (PlanAssignment & { planTitle: string })[] = (plans ?? []).flatMap(
    (plan) =>
      (plan as unknown as { planAssignments?: PlanAssignment[] }).planAssignments?.map(
        (a) => ({ ...a, planTitle: plan.title }),
      ) ?? [],
  );

  const inProgress = assignments.filter(
    (a) => a.status === "IN_PROGRESS" || a.status === "NOT_STARTED",
  ).length;
  const done = assignments.filter((a) => a.status === "COMPLETED").length;
  const overdue = assignments.filter(
    (a) => a.dueDate && new Date(a.dueDate).getTime() < Date.now() && a.status !== "COMPLETED",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">My Work</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everything assigned to you, and what you are expected to deliver.
          Org structure is under Organization; work created by your
          department is under Projects.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Assigned to me</CardDescription>
            <CardTitle className="text-2xl">{assignments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-2xl">{inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl">{done}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Overdue</CardDescription>
            <CardTitle className={cn("text-2xl", overdue > 0 && "text-destructive")}>
              {overdue}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My assignments</CardTitle>
          <CardDescription>
            {can("plans.manage")
              ? "Tasks under the projects you can reach."
              : "Tasks assigned to you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading your work…</p>
          )}
          {!isLoading && assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing is assigned to you yet.
            </p>
          )}

          {assignments.length > 0 && (
            <ul className="flex flex-col gap-3">
              {assignments.map((a) => {
                return (
                  <li
                    key={a.id}
                    className="rounded-md border border-border/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/projects/${a.planId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {a.planTitle}
                        </Link>
                        {a.responsibility && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.responsibility}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusTone(a.status)} className="text-[10px]">
                          {a.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {dueLabel(a.dueDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <ProgressBar
                        value={Number(a.progressPct)}
                        className="flex-1"
                      />
                      <span className="text-xs tabular-nums w-10 text-right">
                        {Number(a.progressPct)}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {stats && (
        <p className="text-xs text-muted-foreground">
          Quota targets are shown on{" "}
          {can("performance.view") ? (
            <Link to="/performance-scores" className="underline">
              Performance Scores
            </Link>
          ) : (
            "your dashboard"
          )}
          . Progress and team numbers are visible to your team lead and above.
        </p>
      )}
    </div>
  );
}
