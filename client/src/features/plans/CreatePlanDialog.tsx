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
import { useCreatePlan } from "@/features/plans/hooks";

export function CreatePlanDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const createPlan = useCreatePlan();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createPlan.mutateAsync({
        title,
        description: description || undefined,
        periodStart,
        periodEnd,
      });
      setTitle("");
      setDescription("");
      setPeriodStart("");
      setPeriodEnd("");
      setOpen(false);
    } catch {
      // error surfaced via createPlan.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Plan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Plan</DialogTitle>
          <DialogDescription>
            Set up a new plan. You can assign offices, metrics, and employees after creating it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-title">Title</Label>
            <Input
              id="plan-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-description">Description (optional)</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-start">Period start</Label>
              <Input
                id="plan-start"
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-end">Period end</Label>
              <Input
                id="plan-end"
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          {createPlan.isError && (
            <p className="text-sm text-destructive">
              {(createPlan.error as { response?: { data?: { error?: string } } })?.response?.data
                ?.error ?? "Failed to create plan."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createPlan.isPending}>
              {createPlan.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
