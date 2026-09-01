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
import { useOffices } from "@/features/offices/hooks";
import { useAddPlanOffice } from "@/features/plans/hooks";
import type { PlanOffice } from "@/features/plans/types";

export function AddOfficeDialog({
  planId,
  alreadyAssigned,
}: {
  planId: string;
  alreadyAssigned: PlanOffice[];
}) {
  const [open, setOpen] = useState(false);
  const [officeId, setOfficeId] = useState("");
  const [target, setTarget] = useState("");
  const { data: offices } = useOffices();
  const addOffice = useAddPlanOffice(planId);

  const assignedIds = new Set(alreadyAssigned.map((po) => po.officeId));
  const availableOffices = offices?.filter((o) => !o.archivedAt && !assignedIds.has(o.id)) ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!officeId) return;
    try {
      await addOffice.mutateAsync({ officeId, target: target || undefined });
      setOfficeId("");
      setTarget("");
      setOpen(false);
    } catch {
      // error surfaced via addOffice.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Assign office
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign office to plan</DialogTitle>
          <DialogDescription>
            Only offices assigned to this plan can have employees assigned to it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an office" />
              </SelectTrigger>
              <SelectContent>
                {availableOffices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name} ({office.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableOffices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                All available offices are already assigned to this plan.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="office-target">Target (optional)</Label>
            <Input
              id="office-target"
              placeholder="e.g. 95% claims processed within SLA"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          {addOffice.isError && (
            <p className="text-sm text-destructive">
              {(addOffice.error as { response?: { data?: { error?: string } } })?.response?.data
                ?.error ?? "Failed to assign office."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={addOffice.isPending || !officeId}>
              {addOffice.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
