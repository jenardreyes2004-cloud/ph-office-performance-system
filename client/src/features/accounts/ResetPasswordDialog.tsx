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
import { refusalMessage, useUpdateAccount } from "@/features/accounts/hooks";
import type { Account } from "@/features/accounts/hooks";

/**
 * Sets a new temporary password for an account.
 *
 * There is no password-reset-by-email in this system, so the reset value has to
 * reach the person by hand. The dialog says that outright rather than implying
 * an email was sent, because an admin who assumes it was will tell the user to
 * check their inbox and leave them stuck.
 *
 * The new password is typed and confirmed, and the field is write-only — there
 * is nothing to display and no value stored anywhere after submit.
 */
export function ResetPasswordDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const update = useUpdateAccount();

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    try {
      await update.mutateAsync({ id: account.id, password });
      setPassword("");
      setConfirm("");
      setOpen(false);
    } catch {
      // Surfaced below.
    }
  }

  const problem = refusalMessage(update.error) ?? (mismatch ? "The two passwords do not match." : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          update.reset();
          setPassword("");
          setConfirm("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Sets a new temporary password for {account.name}. Nothing is
              emailed — pass it to them over a channel you trust, and ask them to
              change it after signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`pw-${account.id}`}>New temporary password</Label>
              <Input
                id={`pw-${account.id}`}
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                At least 10 characters, including a letter and a number.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`pw2-${account.id}`}>Confirm</Label>
              <Input
                id={`pw2-${account.id}`}
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
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
            <Button type="submit" disabled={update.isPending || mismatch || password.length === 0}>
              {update.isPending ? "Saving…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}