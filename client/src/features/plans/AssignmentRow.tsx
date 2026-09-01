import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { useRemoveAssignment, useUpdateAssignment } from "@/features/plans/hooks";
import type { PlanAssignment } from "@/features/plans/types";
import type { AssignmentStatus } from "@/types";

const ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED",
  "CANCELLED",
];

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function AssignmentRow({ planId, assignment }: { planId: string; assignment: PlanAssignment }) {
  const [progressInput, setProgressInput] = useState(String(assignment.progressPct));
  const updateAssignment = useUpdateAssignment(planId);
  const removeAssignment = useRemoveAssignment(planId);

  function commitProgress() {
    const value = Math.max(0, Math.min(100, Number(progressInput) || 0));
    if (value !== Number(assignment.progressPct)) {
      updateAssignment.mutate({ employeeId: assignment.employeeId, progressPct: value });
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {assignment.employee.firstName} {assignment.employee.lastName}
      </TableCell>
      <TableCell className="max-w-xs truncate">{assignment.responsibility ?? "—"}</TableCell>
      <TableCell>
        {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell>
        <Select
          value={assignment.status}
          onValueChange={(status) =>
            updateAssignment.mutate({
              employeeId: assignment.employeeId,
              status: status as AssignmentStatus,
            })
          }
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {toLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-16"
            type="number"
            min={0}
            max={100}
            value={progressInput}
            onChange={(e) => setProgressInput(e.target.value)}
            onBlur={commitProgress}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          disabled={removeAssignment.isPending}
          onClick={() => removeAssignment.mutate(assignment.employeeId)}
        >
          Remove
        </Button>
      </TableCell>
    </TableRow>
  );
}
