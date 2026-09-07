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
import { Textarea } from "@/components/ui/textarea";

import { useEmployees } from "@/features/employees/hooks";
import { useMetrics } from "@/features/metrics/hooks";
import { useCreatePerformanceRecord } from "@/features/performanceRecords/hooks";

export function CreatePerformanceRecordDialog() {
  const [open, setOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [metricId, setMetricId] = useState("");
  const [score, setScore] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { data: metrics, isLoading: metricsLoading } = useMetrics();

  const createRecord = useCreatePerformanceRecord();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      await createRecord.mutateAsync({
        employeeId,
        metricId,
        score: Number(score),
        periodStart,
        periodEnd,
        notes: notes || undefined,
      });

      setEmployeeId("");
      setMetricId("");
      setScore("");
      setPeriodStart("");
      setPeriodEnd("");
      setNotes("");
      setOpen(false);
    } catch {
      // Error is displayed below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Performance Record</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Performance Record</DialogTitle>

          <DialogDescription>
            Record an employee's performance score for a specific period.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-employee">Employee</Label>

            <select
              id="record-employee"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                {employeesLoading ? "Loading employees…" : "Select employee"}
              </option>

              {employees
                ?.filter((employee) => employee.isActive)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-metric">Metric</Label>

            <select
              id="record-metric"
              required
              value={metricId}
              onChange={(e) => setMetricId(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                {metricsLoading ? "Loading metrics…" : "Select metric"}
              </option>

              {metrics?.metrics
                .filter((metric) => !metric.archivedAt)
                .map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-score">Score</Label>

            <Input
              id="record-score"
              type="number"
              step="0.01"
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-period-start">Period Start</Label>

              <Input
                id="record-period-start"
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-period-end">Period End</Label>

              <Input
                id="record-period-end"
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-notes">Notes (optional)</Label>

            <Textarea
              id="record-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {createRecord.isError && (
            <p className="text-sm text-destructive">
              {(
                createRecord.error as {
                  response?: { data?: { error?: string } };
                }
              )?.response?.data?.error ??
                "Failed to create performance record."}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={createRecord.isPending}>
              {createRecord.isPending ? "Saving…" : "Save Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
