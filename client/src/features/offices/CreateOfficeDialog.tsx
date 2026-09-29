import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxLabel } from "@/components/ui/checkbox";
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
import { useCreateOffice, useOffices } from "@/features/offices/hooks";

export function CreateOfficeDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [isHeadOffice, setIsHeadOffice] = useState(false);

  const { data: offices } = useOffices();
  const createOffice = useCreateOffice();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createOffice.mutateAsync({
        name,
        code,
        description: description || undefined,
        // An untouched <Select> reports "", which means "top of the tree".
        parentId: parentId || null,
        isHeadOffice,
      });
      setName("");
      setCode("");
      setDescription("");
      setParentId("");
      setIsHeadOffice(false);
      setOpen(false);
    } catch {
      // error surfaced via createOffice.error below
    }
  }

  // Sorted by name, with the code alongside so the two-letter abbreviations in
  // the org chart (MSD, HCDMD, FMS…) are unambiguous when picking a parent.
  const parentOptions = (offices ?? [])
    .filter((o) => !o.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Office</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Office</DialogTitle>
          <DialogDescription>
            Add an office or sub-unit. Leave the parent empty to place it at
            the top of the hierarchy. The code must be unique (e.g. "FMS").
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="office-name">Name</Label>
            <Input
              id="office-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="office-code">Code</Label>
            <Input
              id="office-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="office-parent">Reports to</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="office-parent">
                <SelectValue placeholder="No parent (top of hierarchy)" />
              </SelectTrigger>
              <SelectContent>
                {parentOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="office-description">Description (optional)</Label>
            <Input
              id="office-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="office-head"
              checked={isHeadOffice}
              onChange={(e) => setIsHeadOffice(e.target.checked)}
            />
            <CheckboxLabel htmlFor="office-head">
              This office runs its own Balanced Scorecard
            </CheckboxLabel>
          </div>
          {createOffice.isError && (
            <p className="text-sm text-destructive">
              {(createOffice.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to create office."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createOffice.isPending}>
              {createOffice.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
