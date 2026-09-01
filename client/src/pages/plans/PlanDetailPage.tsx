import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { AddOfficeDialog } from "@/features/plans/AddOfficeDialog";
import { AssignEmployeeDialog } from "@/features/plans/AssignEmployeeDialog";
import { AssignmentRow } from "@/features/plans/AssignmentRow";
import { useArchivePlan, usePlan, useRemovePlanOffice, useUpdatePlan } from "@/features/plans/hooks";
import type { PlanStatus } from "@/types";

const PLAN_STATUSES: PlanStatus[] = ["DRAFT", "ACTIVE", "ONGOING", "COMPLETED", "DELAYED", "ARCHIVED"];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PlanDetailPage() {
  const { id } = useParams();
  const { data: plan, isLoading, isError } = usePlan(id);
  const updatePlan = useUpdatePlan(id ?? "");
  const archivePlan = useArchivePlan();
  const removeOffice = useRemovePlanOffice(id ?? "");

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading plan…</p>;
  }

  if (isError || !plan) {
    return (
      <PlaceholderPage
        title="Plan not found"
        description="This plan doesn't exist or couldn't be loaded."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{plan.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(plan.periodStart)} – {formatDate(plan.periodEnd)}
          </p>
          {plan.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{plan.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={plan.status}
            onValueChange={(status) => updatePlan.mutate({ status: status as PlanStatus })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {plan.status !== "ARCHIVED" && (
            <Button
              variant="outline"
              size="sm"
              disabled={archivePlan.isPending}
              onClick={() => archivePlan.mutate(plan.id)}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Assigned offices</CardTitle>
          <AddOfficeDialog planId={plan.id} alreadyAssigned={plan.planOffices} />
        </CardHeader>
        <CardContent>
          {plan.planOffices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No offices assigned yet. Assign an office before adding employees.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.planOffices.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">
                      {po.office.name} ({po.office.code})
                    </TableCell>
                    <TableCell>{po.target ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removeOffice.isPending}
                        onClick={() => removeOffice.mutate(po.officeId)}
                      >
                        Unassign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Employee assignments</CardTitle>
          <AssignEmployeeDialog
            planId={plan.id}
            planOffices={plan.planOffices}
            alreadyAssigned={plan.planAssignments}
          />
        </CardHeader>
        <CardContent>
          {plan.planAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employees assigned yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Responsibility</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.planAssignments.map((assignment) => (
                  <AssignmentRow key={assignment.id} planId={plan.id} assignment={assignment} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
