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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOffices } from "@/features/offices/hooks";
import { useCreateMonthlyUpdate } from "@/features/monthlyUpdates/hooks";

/** First day of the current month, as YYYY-MM-01, for a sensible default. */
function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthEnd() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function CreateMonthlyUpdateDialog({ defaultOfficeId }: { defaultOfficeId?: string }) {
  const [open, setOpen] = useState(false);
  const [officeId, setOfficeId] = useState(defaultOfficeId ?? "");
  const [monthStart, setMonthStart] = useState(currentMonthStart());
  const [monthEnd, setMonthEnd] = useState(currentMonthEnd());
  const [content, setContent] = useState("");

  const { data: offices } = useOffices();
  const createUpdate = useCreateMonthlyUpdate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createUpdate.mutateAsync({
        officeId,
        // The API takes full timestamps; a date input gives a bare date.
        monthStartDate: new Date(`${monthStart}T00:00:00`).toISOString(),
        monthEndDate: new Date(`${monthEnd}T23:59:59`).toISOString(),
        content,
      });
      setContent("");
      setOpen(false);
    } catch {
      // surfaced below
    }
  }

  const officeOptions = (offices ?? []).filter((o) => !o.archivedAt);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Monthly Update</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a monthly update</DialogTitle>
          <DialogDescription>
            One submission per office per reporting month. The server refuses a
            second one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mu-office">Office</Label>
            <Select value={officeId} onValueChange={setOfficeId} required>
              <SelectTrigger id="mu-office">
                <SelectValue placeholder="Select an office" />
              </SelectTrigger>
              <SelectContent>
                {officeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mu-start">Month start</Label>
              <Input
                id="mu-start"
                type="date"
                required
                value={monthStart}
                onChange={(e) => setMonthStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mu-end">Month end</Label>
              <Input
                id="mu-end"
                type="date"
                required
                value={monthEnd}
                onChange={(e) => setMonthEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mu-content">Progress narrative</Label>
            <Textarea
              id="mu-content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What was accomplished, what slipped, and what happens next month."
            />
          </div>

          {createUpdate.isError && (
            <p className="text-sm text-destructive">
              {(createUpdate.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to submit the update."}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={createUpdate.isPending}>
              {createUpdate.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
