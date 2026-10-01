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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { refusalMessage, useChangeRole } from "@/features/accounts/hooks";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Account } from "@/features/accounts/hooks";
import type { UserRole } from "@/types";

const ROLES: UserRole[] = ["EMPLOYEE", "OFFICE_ADMIN", "IT_ADMIN", "MAIN_ADMIN"];

/**
 * Changes an account's role.
 *
 * Super admin only, which the caller has already established by rendering the
 * trigger. The dialog says so plainly rather than letting someone discover it
 * by being refused.
 */
export function ChangeRoleDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(account.role);
  const changeRole = useChangeRole();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await changeRole.mutateAsync({ id: account.id, role });
      setOpen(false);
    } catch {
      // Surfaced below.
    }
  }

  const problem = refusalMessage(changeRole.error);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          changeRole.reset();
          setRole(account.role);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {account.name} currently holds {ROLE_LABELS[account.role]}. Role is
              not the same as authority — a person's level comes from which
              office they head, which is set in the organization structure.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor={`role-${account.id}`}>New role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id={`role-${account.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {problem && (
            <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
              {problem}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={changeRole.isPending || role === account.role}>
              {changeRole.isPending ? "Saving…" : "Change role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}