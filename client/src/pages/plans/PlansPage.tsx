import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePlanDialog } from "@/features/plans/CreatePlanDialog";
import { PlanStatusBadge } from "@/features/plans/StatusBadge";
import { usePlans } from "@/features/plans/hooks";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PlansPage() {
  const { data: plans, isLoading, isError } = usePlans();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage organizational plans, office assignments, and employee tasks.
          </p>
        </div>
        <CreatePlanDialog />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load plans. Is the backend running?
            </p>
          )}
          {plans && plans.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No plans yet. Create the first one above.
            </p>
          )}
          {plans && plans.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Offices</TableHead>
                  <TableHead>Assignments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <Link to={`/plans/${plan.id}`} className="hover:underline">
                        {plan.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatDate(plan.periodStart)} – {formatDate(plan.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <PlanStatusBadge status={plan.status} />
                    </TableCell>
                    <TableCell>{plan._count?.planOffices ?? 0}</TableCell>
                    <TableCell>{plan._count?.planAssignments ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
