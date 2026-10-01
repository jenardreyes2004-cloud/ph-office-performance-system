import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  evaluateAccountChange,
  evaluateAccountCreation,
  conferredLevel,
  type AccountActor,
  type AccountTarget,
} from "../src/lib/accountGuard.js";
import { resolveAccess } from "../src/lib/access.js";
import type { AccessLevel, OrgNodeKind, UserRole } from "../src/generated/prisma/client.js";

/**
 * Proves the self-promotion guard cannot be talked out of its job.
 *
 * The failure that matters here is silent: a guard that permits something it
 * should refuse produces a system that looks correctly governed right up
 * until someone uses it. So the emphasis is on refusals, and on the specific
 * escalation paths a reader might assume are covered but are not.
 *
 * Read-only against the database -- it creates nothing and so leaves nothing
 * to clean up.
 *
 * Run: npx tsx prisma/checkSelfPromotion.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

/** Assert a refusal, and that it was refused for the expected reason. */
function refuses(
  label: string,
  code: string,
  result: { allowed: boolean; code: string; reason: string },
) {
  check(label, !result.allowed, `allowed instead, reason: ${result.reason}`);
  if (!result.allowed) {
    check(
      `  ...refused as ${code}`,
      result.code === code,
      `got ${result.code} ("${result.reason}")`,
    );
  }
}

function permits(
  label: string,
  result: { allowed: boolean; code: string; reason: string },
) {
  check(label, result.allowed, `refused: ${result.code} ("${result.reason}")`);
}

const actor = (over: Partial<AccountActor> = {}): AccountActor => ({
  userId: "actor",
  isSuperAdmin: false,
  isItAdmin: false,
  level: "EMPLOYEE",
  ...over,
});

const target = (over: Partial<AccountTarget> = {}): AccountTarget => ({
  userId: "target",
  role: "EMPLOYEE",
  isActive: true,
  headedOfficeId: null,
  headedOfficeKind: null,
  ...over,
});

/** Two super admins exist, so neither is the last one. */
const ctx = { activeMainAdminCount: 2 };

async function main() {
  // ---------------------------------------------------------------------
  console.log("self-edit is refused, whoever is asking");
  // ---------------------------------------------------------------------
  for (const level of [
    "EMPLOYEE",
    "SUB_UNIT_HEAD",
    "OFFICE_HEAD",
    "DEPARTMENT_HEAD",
    "HIERARCHY_HEAD",
  ] as AccessLevel[]) {
    const a = actor({ userId: "same", level, isSuperAdmin: level === "HIERARCHY_HEAD" });
    const t = target({ userId: "same", role: "EMPLOYEE" });
    const r = evaluateAccountChange(a, t, { role: "EMPLOYEE" }, ctx);
    check(
      `a ${level} cannot edit their own account`,
      !r.allowed && r.code === "SELF_EDIT",
      `got ${r.code}`,
    );
  }

  // The escalation it actually stops.
  refuses(
    "an employee cannot make themselves MAIN_ADMIN",
    "SELF_EDIT",
    evaluateAccountChange(
      actor({ userId: "me" }),
      target({ userId: "me" }),
      { role: "MAIN_ADMIN" },
      ctx,
    ),
  );
  refuses(
    "a super admin cannot step themselves down to EMPLOYEE either",
    "SELF_EDIT",
    evaluateAccountChange(
      actor({ userId: "me", isSuperAdmin: true, level: "HIERARCHY_HEAD" }),
      target({ userId: "me", role: "MAIN_ADMIN" }),
      { role: "EMPLOYEE" },
      ctx,
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\nthe systems function is guarded by its own rule");
  // ---------------------------------------------------------------------
  // This is the case a level comparison misses. An IT admin deliberately
  // confers EMPLOYEE level, so promoting someone to IT_ADMIN does not raise
  // their level -- yet an IT admin reads the entire employee roster.
  refuses(
    "an office head cannot appoint an IT admin (level ladder cannot see this)",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(
      actor({ level: "OFFICE_HEAD" }),
      target(),
      { role: "IT_ADMIN" },
      ctx,
    ),
  );
  refuses(
    "a plain employee cannot make someone an IT admin",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(actor(), target(), { role: "IT_ADMIN" }, ctx),
  );
  refuses(
    "even the IT admin role cannot revoke IT admin",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(
      actor({ isItAdmin: true }),
      target({ role: "IT_ADMIN" }),
      { role: "EMPLOYEE" },
      ctx,
    ),
  );
  permits(
    "the super admin may appoint an IT admin",
    evaluateAccountChange(
      actor({ isSuperAdmin: true, level: "HIERARCHY_HEAD" }),
      target(),
      { role: "IT_ADMIN" },
      ctx,
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\nraising someone's level needs the super admin");
  // ---------------------------------------------------------------------
  refuses(
    "an office head cannot promote an employee to office head",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(
      actor({ level: "OFFICE_HEAD" }),
      target(),
      { headedOfficeId: "office-1", headedOfficeKind: "OFFICE" },
      ctx,
    ),
  );
  refuses(
    "an office head cannot promote an employee to department head",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(
      actor({ level: "OFFICE_HEAD" }),
      target(),
      { headedOfficeId: "dept-1", headedOfficeKind: "DEPARTMENT" },
      ctx,
    ),
  );
  refuses(
    "an employee cannot grant themselves a sub-unit headship by proxy",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountChange(
      actor(),
      target(),
      { headedOfficeId: "su-1", headedOfficeKind: "SUB_UNIT" },
      ctx,
    ),
  );
  permits(
    "the super admin may promote an employee to department head",
    evaluateAccountChange(
      actor({ isSuperAdmin: true, level: "HIERARCHY_HEAD" }),
      target(),
      { headedOfficeId: "dept-1", headedOfficeKind: "DEPARTMENT" },
      ctx,
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\nheadship changes are a restructure, in both directions");
  // ---------------------------------------------------------------------
  // Removing a headship lowers the level, so a level check alone would let
  // this through. It is still a structural change.
  refuses(
    "an office head cannot strip an existing headship (lowers level, still a restructure)",
    "HEADSHIP_IS_RESTRUCTURE",
    evaluateAccountChange(
      actor({ level: "DEPARTMENT_HEAD" }),
      target({
        role: "EMPLOYEE",
        headedOfficeId: "office-9",
        headedOfficeKind: "OFFICE",
      }),
      { headedOfficeId: null },
      ctx,
    ),
  );
  refuses(
    "an office head cannot move an existing head to a different node",
    "HEADSHIP_IS_RESTRUCTURE",
    evaluateAccountChange(
      actor({ level: "DEPARTMENT_HEAD" }),
      target({
        headedOfficeId: "office-9",
        headedOfficeKind: "OFFICE",
      }),
      { headedOfficeId: "office-10", headedOfficeKind: "OFFICE" },
      ctx,
    ),
  );
  permits(
    "the super admin may reassign a headship",
    evaluateAccountChange(
      actor({ isSuperAdmin: true, level: "HIERARCHY_HEAD" }),
      target({ headedOfficeId: "office-9", headedOfficeKind: "OFFICE" }),
      { headedOfficeId: "office-10", headedOfficeKind: "OFFICE" },
      ctx,
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\nno editing your equals or your betters");
  // ---------------------------------------------------------------------
  refuses(
    "an office head cannot edit a department head",
    "PEER_OR_ABOVE",
    evaluateAccountChange(
      actor({ level: "OFFICE_HEAD" }),
      target({
        headedOfficeId: "dept-1",
        headedOfficeKind: "DEPARTMENT",
      }),
      { isActive: false },
      ctx,
    ),
  );
  refuses(
    "a department head cannot edit another department head",
    "PEER_OR_ABOVE",
    evaluateAccountChange(
      actor({ level: "DEPARTMENT_HEAD" }),
      target({
        headedOfficeId: "dept-2",
        headedOfficeKind: "DEPARTMENT",
      }),
      { isActive: false },
      ctx,
    ),
  );
  refuses(
    "the IT admin cannot disable a super admin",
    "PEER_OR_ABOVE",
    evaluateAccountChange(
      actor({ isItAdmin: true, level: "EMPLOYEE" }),
      target({ role: "MAIN_ADMIN" }),
      { isActive: false },
      ctx,
    ),
  );
  permits(
    "an office head may still deactivate a plain employee in their office",
    evaluateAccountChange(actor({ level: "OFFICE_HEAD" }), target(), { isActive: false }, ctx),
  );
  permits(
    "the super admin may deactivate a department head",
    evaluateAccountChange(
      actor({ isSuperAdmin: true, level: "HIERARCHY_HEAD" }),
      target({ headedOfficeId: "dept-1", headedOfficeKind: "DEPARTMENT" }),
      { isActive: false },
      ctx,
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\nthe last super admin is protected from everyone");
  // ---------------------------------------------------------------------
  const soleSuperAdmin = target({ role: "MAIN_ADMIN", isActive: true });
  const asSuper = actor({ isSuperAdmin: true, level: "HIERARCHY_HEAD" });

  refuses(
    "the last super admin cannot be demoted by another super admin",
    "LAST_SUPER_ADMIN",
    evaluateAccountChange(
      asSuper,
      soleSuperAdmin,
      { role: "EMPLOYEE" },
      { activeMainAdminCount: 1 },
    ),
  );
  refuses(
    "the last super admin cannot be deactivated",
    "LAST_SUPER_ADMIN",
    evaluateAccountChange(
      asSuper,
      soleSuperAdmin,
      { isActive: false },
      { activeMainAdminCount: 1 },
    ),
  );
  permits(
    "a super admin may be demoted when a second one exists",
    evaluateAccountChange(asSuper, soleSuperAdmin, { role: "EMPLOYEE" }, ctx),
  );
  permits(
    "a super admin may deactivate another super admin when a second exists",
    evaluateAccountChange(asSuper, soleSuperAdmin, { isActive: false }, ctx),
  );
  permits(
    "a deactivated second super admin may be reactivated",
    evaluateAccountChange(
      asSuper,
      target({ role: "MAIN_ADMIN", isActive: false }),
      { isActive: true },
      { activeMainAdminCount: 2 },
    ),
  );

  // ---------------------------------------------------------------------
  console.log("\ndeactivate-then-promote is closed as a one-step path");
  // ---------------------------------------------------------------------
  refuses(
    "a deactivated account cannot be granted a headship while deactivated",
    "INACTIVE_CANNOT_HOLD_AUTHORITY",
    evaluateAccountChange(
      asSuper,
      target({ isActive: false }),
      { headedOfficeId: "dept-1", headedOfficeKind: "DEPARTMENT" },
      ctx,
    ),
  );
  permits(
    "the same grant is allowed once the account is reactivated",
    evaluateAccountChange(
      asSuper,
      target({ isActive: true }),
      { headedOfficeId: "dept-1", headedOfficeKind: "DEPARTMENT" },
      ctx,
    ),
  );
  permits(
    "reactivating on its own is not an authority grant",
    evaluateAccountChange(asSuper, target({ isActive: false }), { isActive: true }, ctx),
  );

  // ---------------------------------------------------------------------
  console.log("\naccount creation follows the same rules");
  // ---------------------------------------------------------------------
  refuses(
    "an office head cannot create another hierarchy head",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountCreation(actor({ level: "OFFICE_HEAD" }), { role: "MAIN_ADMIN" }),
  );
  refuses(
    "a plain employee cannot create an IT admin",
    "NEEDS_SUPER_ADMIN",
    evaluateAccountCreation(actor(), { role: "IT_ADMIN" }),
  );
  refuses(
    "a department head cannot create an account that heads a node",
    "HEADSHIP_IS_RESTRUCTURE",
    evaluateAccountCreation(actor({ level: "DEPARTMENT_HEAD" }), {
      role: "EMPLOYEE",
      headedOfficeKind: "OFFICE",
    }),
  );
  permits(
    "the super admin may create any of them",
    evaluateAccountCreation(asSuper, { role: "MAIN_ADMIN" }),
  );
  permits(
    "an office head may create an ordinary employee",
    evaluateAccountCreation(actor({ level: "OFFICE_HEAD" }), { role: "EMPLOYEE" }),
  );

  // ---------------------------------------------------------------------
  console.log("\nthe pure level ladder still matches the database-backed one");
  // ---------------------------------------------------------------------
  // accountGuard works on plain objects so it can be tested exhaustively, but
  // resolveAccess computes the real level from the database. If the two drift
  // apart, the guard starts ranking the wrong things. This walks every real
  // account and asserts they agree.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      employee: { select: { headedOffice: { select: { kind: true } } } },
    },
  });

  const ladder: { role: UserRole; kind: OrgNodeKind | null }[] = [
    { role: "MAIN_ADMIN", kind: null },
    { role: "IT_ADMIN", kind: null },
    { role: "EMPLOYEE", kind: "DEPARTMENT" },
    { role: "EMPLOYEE", kind: "OFFICE" },
    { role: "EMPLOYEE", kind: "SUB_UNIT" },
    { role: "EMPLOYEE", kind: null },
  ];

  let agreed = 0;
  for (const u of users) {
    const ctxReal = await resolveAccess(u.id, u.role);
    const realHeadedKind = u.employee?.headedOffice?.kind ?? null;
    const guardHeadedId = u.employee?.headedOffice ? "some-node" : null;

    // The guard's own function, not a copy of it. An earlier version of this
    // check re-derived the level inline, which would have passed even if
    // conferredLevel were completely wrong.
    const guardLevel = conferredLevel(u.role, realHeadedKind);

    if (guardLevel === ctxReal.level) {
      agreed++;
    } else {
      console.log(`        ${u.email}: guard=${guardLevel} access=${ctxReal.level}`);
    }
  }
  check(
    `all ${users.length} real accounts resolve to the same level in both implementations`,
    agreed === users.length,
    `${agreed}/${users.length} agreed`,
  );
  check("there were real accounts to compare", users.length > 0, `${users.length} found`);

  const realLevels = users.map((u) => resolveAccess(u.id, u.role));
  const resolved = await Promise.all(realLevels);
  const distinct = [...new Set(resolved.map((r) => r.level))];

  // The ladder must also *rank* the same way, not merely produce the same
  // strings. The proof: for each real account, an actor holding that same
  // level must be refused the "equal or higher" rule against them. If the
  // guard's ranking disagreed with the real level, this would pass an edit
  // that should have been refused.
  let orderingChecked = 0;
  let orderingAgreed = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const realLevel = resolved[i].level;
    const kind = u.employee?.headedOffice?.kind ?? null;

    // An actor at exactly the level this real account resolves to.
    const peer = actor({ level: realLevel });
    const t = target({
      userId: u.id,
      role: u.role,
      isActive: true,
      headedOfficeId: u.employee?.headedOffice ? "some-node" : null,
      headedOfficeKind: kind,
    });
    const r = evaluateAccountChange(peer, t, { isActive: false }, ctx);
    orderingChecked++;
    if (!r.allowed && r.code === "PEER_OR_ABOVE") {
      orderingAgreed++;
    } else {
      console.log(
        `        ${u.email} (${realLevel}): peer edit was ${r.allowed ? "allowed" : r.code}`,
      );
    }
  }
  check(
    `a peer of every real account (${orderingChecked}) is refused as PEER_OR_ABOVE`,
    orderingChecked === orderingAgreed,
    `${orderingAgreed}/${orderingChecked} refused`,
  );
  check(
    "the seeded accounts span more than one level",
    distinct.length > 1,
    `only ${distinct.length} -- an ordering check would be vacuous`,
  );

  // ---------------------------------------------------------------------
  console.log("\nno standing ever confers TEAM_LEAD");
  // ---------------------------------------------------------------------
  // Team lead is scoped to one project (ProjectTeam.leadEmployeeId), not a
  // standing. It survives in the Prisma enum but nothing may produce it, or
  // the six-level model quietly becomes seven.
  const allRoles: UserRole[] = ["MAIN_ADMIN", "OFFICE_ADMIN", "IT_ADMIN", "EMPLOYEE"];
  const allKinds: (OrgNodeKind | null)[] = ["DEPARTMENT", "OFFICE", "SUB_UNIT", null];
  const leaked: string[] = [];
  for (const role of allRoles) {
    for (const kind of allKinds) {
      if (conferredLevel(role, kind) === "TEAM_LEAD") {
        leaked.push(`${role}/${kind ?? "none"}`);
      }
    }
  }
  check(
    `none of the ${allRoles.length * allKinds.length} role/headship combinations confers TEAM_LEAD`,
    leaked.length === 0,
    `leaked: ${leaked.join(", ")}`,
  );

  // And a plain employee must not be able to edit anybody at all. Walked
  // against every real account, so it cannot be defeated by picking a target
  // that happens to sit below the actor.
  let empTargets = 0;
  let empEscapes = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const t = target({
      userId: u.id,
      role: u.role,
      isActive: true,
      headedOfficeId: u.employee?.headedOffice ? "some-node" : null,
      headedOfficeKind: u.employee?.headedOffice?.kind ?? null,
    });
    const r = evaluateAccountChange(actor({ level: "EMPLOYEE" }), t, { isActive: false }, ctx);
    empTargets++;
    if (r.allowed) {
      empEscapes++;
      console.log(`        plain employee was allowed to edit ${u.email} (${resolved[i].level})`);
    }
  }
  check(
    `a plain employee cannot edit any of the ${empTargets} real accounts`,
    empTargets > 0 && empEscapes === 0,
    `${empEscapes} account(s) were editable`,
  );

  // The guard must not simply be refusing everything: the legitimate path
  // has to stay open, or the system becomes unadministrable.
  check(
    "the legitimate path stays open (office head deactivates a plain employee)",
    evaluateAccountChange(
      actor({ level: "OFFICE_HEAD" }),
      target({ role: "EMPLOYEE" }),
      { isActive: false },
      ctx,
    ).allowed,
  );

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Self-promotion guard holds on every path tested.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });