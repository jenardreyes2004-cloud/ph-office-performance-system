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
import { useCreateEmployee } from "@/features/employees/hooks";
import { useOffices } from "@/features/offices/hooks";

export function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [officeId, setOfficeId] = useState<string>("");
  const { data: offices } = useOffices();
  const createEmployee = useCreateEmployee();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!officeId) return;
    try {
      await createEmployee.mutateAsync({
        firstName,
        lastName,
        position: position || undefined,
        officeId,
      });
      setFirstName("");
      setLastName("");
      setPosition("");
      setOfficeId("");
      setOpen(false);
    } catch {
      // error surfaced via createEmployee.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>Add a new employee to an office.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-first-name">First name</Label>
              <Input
                id="emp-first-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-last-name">Last name</Label>
              <Input
                id="emp-last-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-position">Position (optional)</Label>
            <Input
              id="emp-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an office" />
              </SelectTrigger>
              <SelectContent>
                {offices?.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name} ({office.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {offices && offices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No offices yet — create one first on the Offices page.
              </p>
            )}
          </div>
          {createEmployee.isError && (
            <p className="text-sm text-destructive">
              {(createEmployee.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to create employee."}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createEmployee.isPending || !officeId}>
              {createEmployee.isPending ? "Adding…" : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
