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
import { refusalMessage, useCreateAccount } from "@/features/accounts/hooks";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Issues a new login.
 *
 * The role selector is only rendered for the super admin, and always starts on
 * EMPLOYEE. Offering an IT admin a dropdown of every role would be a promise the
 * server refuses anyway -- the guard rejects all but EMPLOYEE -- and a control
 * that is 75% broken is worse than no control.
 */
export function CreateAccountDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const createAccount = useCreateAccount();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "MAIN_ADMIN";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createAccount.mutateAsync({
        name,
        email,
        password,
        ...(role !== "EMPLOYEE" ? { role: role as "MAIN_ADMIN" | "IT_ADMIN" | "OFFICE_ADMIN" } : {}),
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("EMPLOYEE");
      setOpen(false);
    } catch {
      // Surfaced below from the mutation's error.
    }
  }

  const problem = refusalMessage(createAccount.error);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) createAccount.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>New Account</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Issue a login</DialogTitle>
            <DialogDescription>
              Creates an account with a plain employee login. Role and headship
              are assigned separately, and only by the hierarchy head.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="acct-name">Name</Label>
              <Input
                id="acct-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acct-email">Email</Label>
              <Input
                id="acct-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acct-password">Temporary password</Label>
              <Input
                id="acct-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                At least 10 characters, including a letter and a number. Ask
                them to change it after their first sign-in.
              </p>
            </div>

            {isSuperAdmin && (
              <div className="grid gap-2">
                <Label htmlFor="acct-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="acct-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="OFFICE_ADMIN">Office Administrator</SelectItem>
                    <SelectItem value="IT_ADMIN">IT Administrator</SelectItem>
                    <SelectItem value="MAIN_ADMIN">Main Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only you can grant a role other than Employee. Headships are
                  assigned in the organization structure, not here.
                </p>
              </div>
            )}
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
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}