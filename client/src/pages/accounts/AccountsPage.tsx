import { useState } from "react";

import { KeyRound, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateAccountDialog } from "@/features/accounts/CreateAccountDialog";
import { refusalMessage, useAccounts, useSetActive } from "@/features/accounts/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { ACCESS_LEVEL_LABELS, can } from "@/lib/permissions";
import type { AccessLevel } from "@/types";

/**
 * Accounts, for the two roles that hold the systems function.
 *
 * Shows the *level* an account confers next to its role name, because the role
 * alone is misleading: an Office Administrator and a Department Head share the
 * same role and very different authority. That was the exact confusion the
 * hierarchy model was built to remove, so the page should not reintroduce it.
 */
export function AccountsPage() {
  const { user } = useAuth();
  const [showInactive, setShowInactive] = useState(true);
  const { data: accounts, isLoading, isError } = useAccounts(showInactive);
  const setActive = useSetActive();

  const canManage = can(user?.role, "accounts.manage");

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading accounts…</p>;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Could not load accounts.</p>
        </CardContent>
      </Card>
    );
  }

  const active = accounts?.filter((a) => a.isActive) ?? [];
  const disabled = accounts?.filter((a) => !a.isActive) ?? [];
  const lastAdmin =
    active.filter((a) => a.role === "MAIN_ADMIN").length === 1 ? active.find((a) => a.role === "MAIN_ADMIN") : null;

  // The server enforces all of this; hiding the controls is a courtesy so the
  // UI does not offer an action that is guaranteed to be refused.
  const canToggle = (account: { id: string; level: AccessLevel; isSuperAdmin: boolean }) => {
    if (!canManage) return false;
    if (account.id === user?.id) return false;
    if (user?.role !== "MAIN_ADMIN" && (account.isSuperAdmin || account.level !== "EMPLOYEE")) {
      return false;
    }
    return true;
  };

  const refusal = refusalMessage(setActive.error);

  const rows = showInactive ? accounts ?? [] : active;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active
            {disabled.length > 0 && `, ${disabled.length} disabled`}. An account is a
            login; the person behind it is an employee record.
          </p>
        </div>
        {canManage && <CreateAccountDialog />}
      </div>

      {/* Why the controls are missing, rather than leaving blank cells. */}
      {!canManage && (
        <p className="text-sm text-muted-foreground">
          You can view accounts but not change them. That is the hierarchy head's
          and the IT administrator's function.
        </p>
      )}
      {canManage && user?.role !== "MAIN_ADMIN" && (
        <div className="flex items-start gap-2 rounded-md border border-border/60 p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            As IT administrator you manage logins, not headships. You can issue
            and disable accounts that hold no authority. Changing a role or
            touching anyone who heads an office is the hierarchy head's call.
          </p>
        </div>
      )}
      {lastAdmin && canManage && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-sm">
            {lastAdmin.name} is the only active hierarchy head. Their account
            cannot be disabled until another is appointed — otherwise nobody
            would be left able to undo it.
          </p>
        </div>
      )}

      {refusal && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
          {refusal}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">All accounts</CardTitle>
              <CardDescription>
                Authority shown is the level each account confers, which is not
                the same thing as its role.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? "Hide disabled" : "Show disabled"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((account) => {
                const toggleable = canToggle(account);
                const isSelf = account.id === user?.id;
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{account.email}</TableCell>
                    <TableCell className="text-xs">{account.role.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant={account.isSuperAdmin ? "default" : "outline"}>
                        {ACCESS_LEVEL_LABELS[account.level]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.headedOfficeName ?? account.officeName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "secondary" : "outline"}>
                        {account.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {toggleable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setActive.isPending}
                          onClick={() =>
                            setActive.mutate({
                              id: account.id,
                              isActive: !account.isActive,
                            })
                          }
                        >
                          {account.isActive ? "Disable" : "Re-enable"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {isSelf ? "Your own account" : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <KeyRound className="size-3" />
        Passwords are never shown or sent to the browser. Every change here is
        recorded in the audit log.
      </p>
    </div>
  );
}