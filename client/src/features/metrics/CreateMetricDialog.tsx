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
import { useCreateMetric } from "@/features/metrics/hooks";

export function CreateMetricDialog({ remainingWeight }: { remainingWeight: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [weightPct, setWeightPct] = useState("");
  const createMetric = useCreateMetric();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createMetric.mutateAsync({
        name,
        description: description || undefined,
        unit: unit || undefined,
        weightPct: Number(weightPct) || 0,
      });
      setName("");
      setDescription("");
      setUnit("");
      setWeightPct("");
      setOpen(false);
    } catch {
      // error surfaced via createMetric.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Metric</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Performance Metric</DialogTitle>
          <DialogDescription>
            Active metric weights must not exceed 100% in total.{" "}
            {remainingWeight.toFixed(2)}% is currently available.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metric-name">Name</Label>
            <Input
              id="metric-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metric-description">Description (optional)</Label>
            <Textarea
              id="metric-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metric-unit">Unit (optional)</Label>
              <Input
                id="metric-unit"
                placeholder="%, count, score(1-5)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="metric-weight">Weight (%)</Label>
              <Input
                id="metric-weight"
                type="number"
                min={0}
                max={100}
                step="0.01"
                required
                value={weightPct}
                onChange={(e) => setWeightPct(e.target.value)}
              />
            </div>
          </div>
          {createMetric.isError && (
            <p className="text-sm text-destructive">
              {(createMetric.error as { response?: { data?: { error?: string } } })?.response
                ?.data?.error ?? "Failed to create metric."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createMetric.isPending}>
              {createMetric.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
