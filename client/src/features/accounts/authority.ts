import type { AccessLevel, UserRole } from "@/types";

/**
 * What the current user may do to each account in the list.
 *
 * This mirrors the server's `lib/accountGuard` so the UI can hide actions that
 * would be refused. The server remains authoritative -- this exists so a user
 * is not handed a button that fails, not so the rule is enforced here.
 *
 * The mirror is deliberately pessimistic: when the two disagree, the safe
 * outcome is a hidden control rather than a confusing 403.
 */

export interface AccountLike {
  id: string;
  role: UserRole;
  level: AccessLevel;
  isSuperAdmin: boolean;
}

export interface ActorLike {
  id: string | undefined;
  role: UserRole | undefined;
}

export type AccountAction = "setActive" | "changeRole" | "resetPassword";

export function allowedActions(actor: ActorLike, account: AccountLike): AccountAction[] {
  // Nobody edits their own account, for any field. A password reset on your
  // own account is the usual way privilege escalation starts.
  if (!actor.id || actor.id === account.id) return [];

  const isSuper = actor.role === "MAIN_ADMIN";
  const isItAdmin = actor.role === "IT_ADMIN";
  if (!isSuper && !isItAdmin) return [];

  // The IT admin manages credentials, not authority. Anyone above plain
  // employee level holds organizational power, and locking their account would
  // be a lever over the hierarchy.
  if (!isSuper && (account.isSuperAdmin || account.level !== "EMPLOYEE")) return [];

  const actions: AccountAction[] = ["setActive", "resetPassword"];

  // Granting a role is granting authority, so it is the super admin's alone.
  if (isSuper) actions.push("changeRole");

  return actions;
}

/** Why a row has no controls, so the table can explain rather than show a dash. */
export function noActionReason(actor: ActorLike, account: AccountLike): string | null {
  if (!actor.id || actor.id === account.id) return "Your own account";
  if (actor.role !== "MAIN_ADMIN" && actor.role !== "IT_ADMIN") {
    return "Not your function";
  }
  if (actor.role !== "MAIN_ADMIN" && (account.isSuperAdmin || account.level !== "EMPLOYEE")) {
    return "Holds authority";
  }
  return null;
}