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
import { useCreateOffice } from "@/features/offices/hooks";

export function CreateOfficeDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const createOffice = useCreateOffice();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createOffice.mutateAsync({
        name,
        code,
        description: description || undefined,
      });
      setName("");
      setCode("");
      setDescription("");
      setOpen(false);
    } catch {
      // error surfaced via createOffice.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Office</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Office</DialogTitle>
          <DialogDescription>
            Add a new office. The code must be unique (e.g. "LHIO-NCR-1").
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
            <Label htmlFor="office-description">Description (optional)</Label>
            <Input
              id="office-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
