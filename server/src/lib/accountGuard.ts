import type { AccessLevel, OrgNodeKind, UserRole } from "@/generated/prisma/client";

import { AppError } from "@/middleware/errorHandler";

/**
 * Guards changes to an account's authority.
 *
 * The problem this exists for is self-promotion: a user who can reach an
 * account-write endpoint may be tempted to grant themselves more authority,
 * directly or by proxy. Every rule here is written so that a caller cannot
 * end up with more power than the request legitimately gave them.
 *
 * Two design decisions worth stating, because both are easy to get wrong:
 *
 * 1. **Authority is measured by conferred access level, not by role name.**
 *    A role can confer a level (`headedOfficeId` decides the six levels) or a
 *    systems function (`IT_ADMIN`). Comparing roles directly would rank
 *    "OFFICE_ADMIN" against "IT_ADMIN" by string order, which means nothing.
 *
 * 2. **The systems function is guarded separately, because the level
 *    comparison cannot see it.** `resolveAccess` deliberately gives an IT
 *    admin the EMPLOYEE level: it holds no plan authority. So promoting
 *    someone to IT_ADMIN does not raise their level, and a level check alone
 *    would let an office head appoint one. That is not harmless -- an IT
 *    admin reads the whole employee roster, because account administration
 *    is a system-wide function. So IT_ADMIN is handled by its own rule rather
 *    than by the level ladder.
 *
 * Policy, per the hierarchy rules already agreed: the super admin is the only
 * one who may grant authority. That is what "super-admin approval required"
 * means here in an enforceable form -- there is no second actor to satisfy an
 * approval request, so the rule is simply that only MAIN_ADMIN may hand out
 * authority. If a request/approve workflow is wanted later, this module is the
 * single place that decision would be added.
 */

export type GuardCode =
  | "OK"
  | "SELF_EDIT"
  | "NEEDS_SUPER_ADMIN"
  | "HEADSHIP_IS_RESTRUCTURE"
  | "PEER_OR_ABOVE"
  | "LAST_SUPER_ADMIN"
  | "INACTIVE_CANNOT_HOLD_AUTHORITY";

export interface GuardResult {
  allowed: boolean;
  code: GuardCode;
  /** Operator-facing explanation. Returned even when allowed, for audit logs. */
  reason: string;
}

export interface AccountActor {
  userId: string;
  isSuperAdmin: boolean;
  isItAdmin: boolean;
  level: AccessLevel;
}

export interface AccountTarget {
  userId: string;
  role: UserRole;
  isActive: boolean;
  /** The node this person heads, which is what sets their level. */
  headedOfficeId: string | null;
  headedOfficeKind: OrgNodeKind | null;
}

export interface ProposedChange {
  role?: UserRole;
  isActive?: boolean;
  headedOfficeId?: string | null;
  headedOfficeKind?: OrgNodeKind | null;
}

/** State the guard needs from the database, passed in so it stays pure. */
export interface GuardContext {
  /** How many active MAIN_ADMIN accounts exist, including the target. */
  activeMainAdminCount: number;
}

const ALLOW: GuardResult = { allowed: true, code: "OK", reason: "Permitted." };

/** Mirrors the level ladder in `lib/access.ts`. Kept in step by tests. */
/**
 * Levels a standing account can hold, lowest to highest.
 *
 * TEAM_LEAD is deliberately absent. It is not a standing at all: it is scoped
 * to one project and lives in `ProjectTeam.leadEmployeeId`, read per project.
 * It remains in the Prisma enum as a vestigial value that nothing produces,
 * so ranking it here would reintroduce exactly the confusion the six-level
 * model was built to remove.
 */
type StandingLevel = Exclude<AccessLevel, "TEAM_LEAD">;

const LEVEL_RANK: Record<StandingLevel, number> = {
  HIERARCHY_HEAD: 6,
  DEPARTMENT_HEAD: 5,
  OFFICE_HEAD: 4,
  SUB_UNIT_HEAD: 3,
  EMPLOYEE: 1,
};

/** Ranking with a defensive floor, so a stray TEAM_LEAD cannot inflate anyone. */
function rank(level: AccessLevel): number {
  if (level === "TEAM_LEAD") return 0;
  return LEVEL_RANK[level];
}

/**
 * The access level an account is conferred by a given role and headship.
 *
 * Exported so the check suite can compare it against `resolveAccess`, which
 * derives the same thing from the database. The two must agree or the guard
 * starts ranking the wrong accounts.
 */
export function conferredLevel(role: UserRole, headedOfficeKind: OrgNodeKind | null): AccessLevel {
  if (role === "MAIN_ADMIN") return "HIERARCHY_HEAD";
  // An IT admin is a systems function, deliberately outside the tree, so it
  // confers no level. See the note at the top of this file.
  if (role === "IT_ADMIN") return "EMPLOYEE";
  switch (headedOfficeKind) {
    case "DEPARTMENT":
      return "DEPARTMENT_HEAD";
    case "OFFICE":
      return "OFFICE_HEAD";
    case "SUB_UNIT":
      return "SUB_UNIT_HEAD";
    default:
      return "EMPLOYEE";
  }
}

/**
 * May `actor` apply `change` to `target`?
 *
 * Rules are evaluated most-specific first and each returns the reason it
 * refused, so a refusal tells the caller *which* rule stopped them rather
 * than a bare 403.
 */
export function evaluateAccountChange(
  actor: AccountActor,
  target: AccountTarget,
  change: ProposedChange,
  ctx: GuardContext,
): GuardResult {
  // 1. Nobody edits their own account. This is the rule the whole module
  //    exists for, and it is also the cheapest: it cannot be defeated by
  //    any combination of fields, because it does not look at the fields.
  if (actor.userId === target.userId) {
    return {
      allowed: false,
      code: "SELF_EDIT",
      reason: "You cannot change your own account. Ask the hierarchy head.",
    };
  }

  const nextRole = change.role ?? target.role;
  const nextActive = change.isActive ?? target.isActive;
  const nextHeadedId = change.headedOfficeId !== undefined ? change.headedOfficeId : target.headedOfficeId;
  const nextHeadedKind =
    change.headedOfficeKind !== undefined ? change.headedOfficeKind : target.headedOfficeKind;

  // 2. A deactivated account holds no authority, so it must not be granted
  //    any while deactivated. Otherwise "deactivate, then promote" is a
  //    one-request escalation path for whoever can deactivate.
  if (!nextActive) {
    const wasActive = target.isActive;
    const gainsAuthority =
      nextRole !== target.role || nextHeadedId !== target.headedOfficeId;
    if (!wasActive && gainsAuthority) {
      return {
        allowed: false,
        code: "INACTIVE_CANNOT_HOLD_AUTHORITY",
        reason: "A deactivated account cannot be given authority while deactivated. Reactivate it first.",
      };
    }
  }

  // 3. Appointing or revoking the systems function is the super admin's call.
  //    Not reachable from the level ladder -- see the header note.
  if (nextRole !== target.role) {
    const touchesItAdmin = nextRole === "IT_ADMIN" || target.role === "IT_ADMIN";
    if (touchesItAdmin && !actor.isSuperAdmin) {
      return {
        allowed: false,
        code: "NEEDS_SUPER_ADMIN",
        reason: "Only the hierarchy head may grant or revoke the IT administrator role.",
      };
    }
  }

  // 4. Any elevation of access level requires the super admin.
  const before = rank(conferredLevel(target.role, target.headedOfficeKind));
  const after = rank(conferredLevel(nextRole, nextHeadedKind));
  if (after > before && !actor.isSuperAdmin) {
    return {
      allowed: false,
      code: "NEEDS_SUPER_ADMIN",
      reason: "Only the hierarchy head may raise someone's access level.",
    };
  }

  // 5. Changing who heads a node is a restructure, and the hierarchy rules
  //    reserve restructuring to the super admin. Checked separately from the
  //    level ladder because *removing* a headship lowers the level while still
  //    being a structural change -- and because a super admin reassigning a
  //    headship inside their own authority should not need a second approval.
  const headshipChanged = nextHeadedId !== target.headedOfficeId;
  if (headshipChanged && !actor.isSuperAdmin) {
    return {
      allowed: false,
      code: "HEADSHIP_IS_RESTRUCTURE",
      reason: "Only the hierarchy head may assign or change a headship.",
    };
  }

  // 6. The IT admin is a systems function, not a standing, so the ladder
  //    cannot rank it. It may manage the credentials of people who hold no
  //    organizational authority -- that is its job -- and nothing else.
  //
  //    Without this branch the general rule below would refuse it entirely,
  //    since an IT admin resolves to EMPLOYEE level and every target ranks at
  //    least as high. The boundary is drawn at headship: locking the account of
  //    an office head would be a lever over the hierarchy, which is exactly
  //    what the systems role must not have.
  if (actor.isItAdmin && !actor.isSuperAdmin) {
    if (before > LEVEL_RANK.EMPLOYEE) {
      return {
        allowed: false,
        code: "PEER_OR_ABOVE",
        reason: "The IT administrator role manages logins, not headships. Ask the hierarchy head.",
      };
    }
    return { ...ALLOW, reason: "Systems function: manages credentials of an account holding no authority." };
  }

  // 7. A caller may not edit an account at or above their own standing. This
  //    is what stops an office head demoting a department head, or an IT
  //    admin disabling a super admin.
  if (!actor.isSuperAdmin && before >= rank(actor.level)) {
    return {
      allowed: false,
      code: "PEER_OR_ABOVE",
      reason: "You cannot change an account that holds equal or higher standing than your own.",
    };
  }

  // 8. The last active super admin cannot be demoted or deactivated, by
  //    anyone. Without this the system has an unrecoverable lockout state:
  //    nobody left who could undo it.
  const losesSuperAdmin =
    target.role === "MAIN_ADMIN" && target.isActive &&
    (nextRole !== "MAIN_ADMIN" || !nextActive);
  if (losesSuperAdmin && ctx.activeMainAdminCount <= 1) {
    return {
      allowed: false,
      code: "LAST_SUPER_ADMIN",
      reason: "This is the last active hierarchy head. Appoint another before changing this account.",
    };
  }

  return ALLOW;
}

/**
 * May `actor` create an account with this shape? Used by account creation, so
 * the same rules apply before the row exists rather than only after.
 */
export function evaluateAccountCreation(
  actor: AccountActor,
  proposed: { role: UserRole; headedOfficeKind?: OrgNodeKind | null },
): GuardResult {
  if (proposed.role === "MAIN_ADMIN" && !actor.isSuperAdmin) {
    return {
      allowed: false,
      code: "NEEDS_SUPER_ADMIN",
      reason: "Only the hierarchy head may create another hierarchy head.",
    };
  }
  if (proposed.role === "IT_ADMIN" && !actor.isSuperAdmin) {
    return {
      allowed: false,
      code: "NEEDS_SUPER_ADMIN",
      reason: "Only the hierarchy head may create an IT administrator.",
    };
  }
  if (proposed.headedOfficeKind && !actor.isSuperAdmin) {
    return {
      allowed: false,
      code: "HEADSHIP_IS_RESTRUCTURE",
      reason: "Only the hierarchy head may create an account that heads a node.",
    };
  }
  return ALLOW;
}

/** Convenience for routes: throws unless permitted. */
export function assertAccountChange(
  actor: AccountActor,
  target: AccountTarget,
  change: ProposedChange,
  ctx: GuardContext,
): void {
  const result = evaluateAccountChange(actor, target, change, ctx);
  if (!result.allowed) {
    throw new AccountGuardError(result);
  }
}

/**
 * Thrown when a change is refused. Carries the code as well as the message, so
 * a client can distinguish "you cannot edit yourself" from "that would remove
 * the last hierarchy head" without parsing English.
 *
 * Extends AppError so the existing error handler renders it as a 403 with the
 * reason. When this was a bare Error the guard still refused correctly, but
 * every refusal surfaced as a 500 -- indistinguishable from a crash, which
 * would have trained everyone to ignore it.
 */
export class AccountGuardError extends AppError {
  code: GuardCode;

  constructor(result: GuardResult) {
    super(result.reason, 403);
    this.code = result.code;
    Object.setPrototypeOf(this, AccountGuardError.prototype);
  }
}