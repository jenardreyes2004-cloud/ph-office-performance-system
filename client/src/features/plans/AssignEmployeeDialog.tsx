import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEmployees } from "@/features/employees/hooks";
import { useAssignEmployee } from "@/features/plans/hooks";
import type { PlanAssignment, PlanOffice } from "@/features/plans/types";

export function AssignEmployeeDialog({
  planId,
  planOffices,
  alreadyAssigned,
}: {
  planId: string;
  planOffices: PlanOffice[];
  alreadyAssigned: PlanAssignment[];
}) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [dueDate, setDueDate] = useState("");
  const { data: employees } = useEmployees();
  const assignEmployee = useAssignEmployee(planId);

  const eligibleOfficeIds = new Set(planOffices.map((po) => po.officeId));
  const assignedEmployeeIds = new Set(alreadyAssigned.map((a) => a.employeeId));
  const availableEmployees =
    employees?.filter(
      (e) => e.isActive && eligibleOfficeIds.has(e.officeId) && !assignedEmployeeIds.has(e.id),
    ) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    try {
      await assignEmployee.mutateAsync({
        employeeId,
        responsibility: responsibility || undefined,
        dueDate: dueDate || undefined,
      });
      setEmployeeId("");
      setResponsibility("");
      setDueDate("");
      setOpen(false);
    } catch {
      // error surfaced via assignEmployee.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={planOffices.length === 0}>
          Assign employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign employee to plan</DialogTitle>
          <DialogDescription>
            Only employees from offices already assigned to this plan can be selected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                    {employee.office ? ` — ${employee.office.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableEmployees.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No eligible employees. Assign an office to this plan first, or all employees from
                assigned offices are already on this plan.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-responsibility">Responsibility (optional)</Label>
            <Textarea
              id="assignment-responsibility"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-due">Due date (optional)</Label>
            <Input
              id="assignment-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {assignEmployee.isError && (
            <p className="text-sm text-destructive">
              {(assignEmployee.error as { response?: { data?: { error?: string } } })?.response
                ?.data?.error ?? "Failed to assign employee."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={assignEmployee.isPending || !employeeId}>
              {assignEmployee.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
