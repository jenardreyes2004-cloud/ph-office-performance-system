import bcrypt from "bcryptjs";

import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { resolveAccess } from "@/lib/access";
import {
  AccountGuardError,
  assertAccountChange,
  evaluateAccountCreation,
  type AccountActor,
  type AccountTarget,
} from "@/lib/accountGuard";
import type {
  CreateAccountInput,
  ChangeRoleInput,
  SetActiveInput,
  UpdateAccountInput,
} from "@/schemas/account.schema";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Account management: logins, roles, and activation.
 *
 * Every mutation routes through `lib/accountGuard`. That module decides who
 * may change authority; this one decides how, and makes sure no write path
 * exists that skips the check.
 *
 * Two invariants held throughout:
 *
 * 1. `passwordHash` is never selected into a return value. It is excluded
 *    explicitly rather than by remembering to strip it, because a `select`
 *    that forgets is the kind of bug that reaches production unnoticed.
 *
 * 2. Role, activation and headship changes each have their own endpoint
 *    rather than sharing one "update". They are the operations the guard
 *    exists to police, and one endpoint carrying all of them is exactly the
 *    place a caller would reach for to get more power.
 */

/** The only fields any account read may return. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const BCRYPT_ROUNDS = 10;

async function activeMainAdminCount(): Promise<number> {
  return prisma.user.count({ where: { role: "MAIN_ADMIN", isActive: true } });
}

/** Builds the guard's view of an account from the row, including its headship. */
async function loadTarget(userId: string): Promise<AccountTarget> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      employee: {
        select: { headedOffice: { select: { id: true, kind: true } } },
      },
    },
  });

  if (!user) throw new AppError("Account not found.", 404);

  return {
    userId: user.id,
    role: user.role,
    isActive: user.isActive,
    headedOfficeId: user.employee?.headedOffice?.id ?? null,
    headedOfficeKind: user.employee?.headedOffice?.kind ?? null,
  };
}

/** Resolves the caller's standing, so the guard compares real levels. */
async function loadActor(userId: string, role: UserRole): Promise<AccountActor> {
  const access = await resolveAccess(userId, role);
  return {
    userId,
    isSuperAdmin: access.isSuperAdmin,
    isItAdmin: access.isItAdmin,
    level: access.level,
  };
}

export const accountService = {
  /**
   * Accounts, annotated with the level each one actually confers.
   *
   * The level is joined in rather than left for the client to derive, because
   * a client deriving it would have to duplicate the ladder -- and a duplicated
   * ladder is how a UI ends up telling an IT admin they are an Office Admin.
   */
  async list(includeInactive = true) {
    const users = await prisma.user.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: {
        ...PUBLIC_FIELDS,
        employee: {
          select: {
            id: true,
            accessLevel: true,
            headedOfficeId: true,
            headedOffice: { select: { id: true, name: true, kind: true } },
            office: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { email: "asc" }],
    });

    const access = await Promise.all(users.map((u) => resolveAccess(u.id, u.role)));

    return users.map((u, i) => ({
      ...u,
      // Never serialised: u.passwordHash is not in PUBLIC_FIELDS.
      level: access[i].level,
      isSuperAdmin: access[i].isSuperAdmin,
      headedOfficeName: u.employee?.headedOffice?.name ?? null,
      officeName: u.employee?.office?.name ?? null,
    }));
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { ...PUBLIC_FIELDS, employee: { select: { id: true } } },
    });
    if (!user) throw new AppError("Account not found.", 404);
    const access = await resolveAccess(user.id, user.role);
    return { ...user, level: access.level };
  },

  async create(actor: AccountActor, input: CreateAccountInput) {
    const role: UserRole = input.role ?? "EMPLOYEE";

    const creation = evaluateAccountCreation(actor, { role });
    if (!creation.allowed) throw new AccountGuardError(creation);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(`An account already exists for ${input.email}.`, 409);
    }

    return prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        role,
        isActive: input.isActive ?? true,
      },
      select: PUBLIC_FIELDS,
    });
  },

  /** Name, email and password only. Authority changes are separate endpoints. */
  async update(actor: AccountActor, id: string, input: UpdateAccountInput) {
    // Guarded even though these fields carry no authority: an IT admin must
    // still not be able to edit a department head's account at all, and this
    // is the only place that can enforce it for a password reset.
    assertAccountChange(actor, await loadTarget(id), {}, { activeMainAdminCount: await activeMainAdminCount() });

    if (input.email) {
      const clash = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (clash && clash.id !== id) {
        throw new AppError(`An account already exists for ${input.email}.`, 409);
      }
    }

    return prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.password !== undefined
          ? { passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS) }
          : {}),
      },
      select: PUBLIC_FIELDS,
    });
  },

  async changeRole(actor: AccountActor, id: string, input: ChangeRoleInput) {
    const target = await loadTarget(id);
    assertAccountChange(actor, target, { role: input.role }, {
      activeMainAdminCount: await activeMainAdminCount(),
    });

    return prisma.user.update({
      where: { id },
      data: { role: input.role },
      select: PUBLIC_FIELDS,
    });
  },

  async setActive(actor: AccountActor, id: string, input: SetActiveInput) {
    const target = await loadTarget(id);
    assertAccountChange(actor, target, { isActive: input.isActive }, {
      activeMainAdminCount: await activeMainAdminCount(),
    });

    return prisma.user.update({
      where: { id },
      data: { isActive: input.isActive },
      select: PUBLIC_FIELDS,
    });
  },

  /**
   * Deactivating revokes access at the next request rather than invalidating a
   * live session immediately. A JWT is self-contained, so the only way to kill
   * one early is a server-side denylist -- which is a real decision (storage,
   * expiry, growth) and not one to smuggle in with account management. Worth
   * doing deliberately if instant revocation is required.
   */
  async deactivate(actor: AccountActor, id: string) {
    return this.setActive(actor, id, { isActive: false });
  },

  async reactivate(actor: AccountActor, id: string) {
    return this.setActive(actor, id, { isActive: true });
  },
};

export { loadActor };
export type { AccountActor };