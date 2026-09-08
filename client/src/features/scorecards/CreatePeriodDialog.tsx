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
import { useCreateScorecardPeriod } from "@/features/scorecards/hooks";

export function CreatePeriodDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const createPeriod = useCreateScorecardPeriod();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createPeriod.mutateAsync({ label, startDate, endDate });
      setLabel("");
      setStartDate("");
      setEndDate("");
      setOpen(false);
    } catch {
      // error surfaced via createPeriod.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New Period</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Scorecard Period</DialogTitle>
          <DialogDescription>
            e.g. "January 2026 to December 2026"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-label">Label</Label>
            <Input
              id="period-label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-start">Start Date</Label>
            <Input
              id="period-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-end">End Date</Label>
            <Input
              id="period-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {createPeriod.isError && (
            <p className="text-sm text-destructive">
              {(createPeriod.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to create period."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createPeriod.isPending}>
              {createPeriod.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
