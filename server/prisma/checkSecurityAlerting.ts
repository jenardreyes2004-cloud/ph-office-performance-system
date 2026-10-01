import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  scanForSecurityEvents,
  SECURITY_THRESHOLDS,
} from "../src/services/securityAlert.service";

/**
 * Proves the security scan fires on an attack and stays quiet otherwise.
 *
 * The failure mode that matters most here is the false negative: an alerting
 * job that never fires looks identical to a system under attack. The second
 * most important is the false positive, because a rule that cries wolf on
 * ordinary mistyped passwords gets switched off.
 *
 * Seeds synthetic login_failure events, asserts, and removes everything it
 * created — including any notifications the scan legitimately generates.
 *
 * Run: npx tsx prisma/checkSecurityAlerting.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MARKER_EMAIL = "victim@check.local";
const MARKER_IP = "203.0.113.7";

const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

/**
 * Writes a login_failure exactly as middleware/systemLog.ts would, so the
 * scan is exercised against the real shape rather than a convenient one.
 */
async function seedFailure(email: string, ip: string, minutesOld: number): Promise<string> {
  const row = await prisma.systemLog.create({
    data: {
      level: "WARN",
      category: "auth",
      message: "login_failure",
      ip,
      method: "POST",
      path: "/api/auth/login",
      status: 401,
      createdAt: minutesAgo(minutesOld),
      context: { email, reason: "bad password" },
    },
    select: { id: true },
  });
  return row.id;
}

async function itAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "IT_ADMIN", isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** Notifications created by this run, so they can be identified for cleanup. */
let notificationFloor = new Map<string, Date>();

async function snapshotNotifications(adminIds: string[]) {
  for (const id of adminIds) {
    notificationFloor.set(id, new Date());
  }
}

async function notificationsFor(adminIds: string[]) {
  const out: { id: string; message: string }[] = [];
  for (const id of adminIds) {
    const since = notificationFloor.get(id) ?? new Date(0);
    const rows = await prisma.notification.findMany({
      where: { recipientId: id, createdAt: { gte: since } },
      select: { id: true, message: true },
    });
    out.push(...rows.map((r) => ({ id: r.id, message: r.message })));
  }
  return out;
}

const seededLogIds: string[] = [];

/** Bounds every side effect this run produces, so cleanup cannot reach older
 *  rows that legitimately belong to the running system. */
const runStartedAt = new Date(Date.now() - 5000);

async function main() {
  const admins = await itAdminIds();
  console.log(
    `Security alerting check — ${SECURITY_THRESHOLDS.repeatedFailures} repeated failures or ` +
      `${SECURITY_THRESHOLDS.spray} distinct accounts from one IP, within ` +
      `${SECURITY_THRESHOLDS.windowMinutes} minutes\n`,
  );
  console.log(`IT admin accounts: ${admins.length}\n`);

  if (admins.length === 0) {
    console.error("No active IT_ADMIN account — cannot verify. Run npm run db:seed:levels.");
    process.exitCode = 1;
    return;
  }

  try {
    // --- Quiet baseline ---------------------------------------------------
    console.log("baseline (no suspicious events)");
    await snapshotNotifications(admins);
    const baseline = await scanForSecurityEvents();
    check(
      "a quiet window produces no alerts",
      baseline.repeatedFailures.length === 0 && baseline.spray.length === 0,
      `repeated=${baseline.repeatedFailures.length} spray=${baseline.spray.length}`,
    );
    check(
      "no notification is sent when nothing is wrong",
      (await notificationsFor(admins)).length === 0,
    );

    // --- Below threshold --------------------------------------------------
    console.log("\nbelow threshold (3 failures, 2 accounts from one IP)");
    for (let i = 0; i < 3; i++) {
      seededLogIds.push(await seedFailure(MARKER_EMAIL, MARKER_IP, i));
    }
    seededLogIds.push(await seedFailure("other@check.local", MARKER_IP, 0));

    const below = await scanForSecurityEvents();
    check(
      "3 repeats is under the threshold of 5",
      !below.repeatedFailures.some((r) => r.email === MARKER_EMAIL),
      `flagged: ${JSON.stringify(below.repeatedFailures)}`,
    );
    check(
      "2 distinct accounts from one IP is under the spray threshold of 3",
      !below.spray.some((s) => s.ip === MARKER_IP),
      `flagged: ${JSON.stringify(below.spray)}`,
    );

    // --- Repeated failures trip the rule ----------------------------------
    console.log("\nrepeated failures (5 against one account)");
    // Add two more so the total reaches the threshold.
    seededLogIds.push(await seedFailure(MARKER_EMAIL, MARKER_IP, 0));
    seededLogIds.push(await seedFailure(MARKER_EMAIL, MARKER_IP, 0));

    const repeated = await scanForSecurityEvents();
    const repeatedHit = repeated.repeatedFailures.find((r) => r.email === MARKER_EMAIL);
    check("5 failures against one account are flagged", !!repeatedHit);
    check("the count is reported", repeatedHit?.count === 5, `reported ${repeatedHit?.count}`);

    const afterRepeat = await notificationsFor(admins);
    check(
      "an IT admin is notified",
      afterRepeat.some((n) => n.message.includes(MARKER_EMAIL)),
      `notifications: ${JSON.stringify(afterRepeat.map((n) => n.message))}`,
    );
    check(
      "the alert names the account under attack",
      afterRepeat.some((n) => n.message.includes("failed sign-in attempts")),
    );

    // --- Spray trips the rule ---------------------------------------------
    console.log("\ncredential spray (3 accounts from one IP)");
    seededLogIds.push(await seedFailure("third@check.local", MARKER_IP, 0));
    // A distinct address, to prove the two rules are separate.
    seededLogIds.push(await seedFailure("lone@check.local", "198.51.100.9", 0));

    const sprayed = await scanForSecurityEvents();
    const sprayHit = sprayed.spray.find((s) => s.ip === MARKER_IP);
    check("3 accounts from one IP are flagged as spray", !!sprayHit);
    check(
      "the distinct-account count is reported",
      sprayHit?.distinctEmails === 3,
      `reported ${sprayHit?.distinctEmails}`,
    );

    const afterSpray = await notificationsFor(admins);
    check(
      "a separate spray alert is sent",
      afterSpray.some((n) => n.message.includes("credential stuffing")),
      `notifications: ${JSON.stringify(afterSpray.map((n) => n.message))}`,
    );
    check(
      "a lone failure from another IP does not trigger spray",
      !afterSpray.some((n) => n.message.includes("198.51.100.9")),
    );

    // --- Cooldown ----------------------------------------------------------
    console.log("\ncooldown (immediate re-scan must not re-alert)");
    const countBefore = (await notificationsFor(admins)).length;
    const again = await scanForSecurityEvents();
    const countAfter = (await notificationsFor(admins)).length;
    check(
      "a re-scan still detects the same conditions",
      again.repeatedFailures.some((r) => r.email === MARKER_EMAIL),
      "detection disappeared — the rule is not really running",
    );
    check(
      "but sends no duplicate notification",
      countAfter === countBefore,
      `${countBefore} notifications before, ${countAfter} after`,
    );

    // --- Window ------------------------------------------------------------
    console.log("\nwindow (failures outside it are ignored)");
    // Far older than the 15-minute window, and with distinct signatures so
    // the cooldown map does not mask the result.
    for (let i = 0; i < 9; i++) {
      seededLogIds.push(await seedFailure("stale@check.local", "192.0.2.55", 240 + i));
    }
    const stale = await scanForSecurityEvents();
    check(
      "failures older than the window are ignored",
      !stale.repeatedFailures.some((r) => r.email === "stale@check.local"),
      `flagged: ${JSON.stringify(stale.repeatedFailures)}`,
    );
  } finally {
    console.log("\ncleaning up");
    if (seededLogIds.length) {
      await prisma.systemLog.deleteMany({ where: { id: { in: seededLogIds } } });
    }
    // The scan writes its own 'security' log rows as a side effect of firing.
    // Those are not in seededLogIds, so an earlier version of this test left
    // them behind every run.
    const sideEffects = await prisma.systemLog.deleteMany({
      where: { category: "security", createdAt: { gte: runStartedAt } },
    });
    // Remove only what this run produced.
    for (const id of admins) {
      const since = notificationFloor.get(id) ?? new Date(0);
      await prisma.notification.deleteMany({
        where: { recipientId: id, createdAt: { gte: since } },
      });
    }
    const leftoverLogs = await prisma.systemLog.count({
      where: { id: { in: seededLogIds } },
    });
    check("no seeded log rows left behind", leftoverLogs === 0, `${leftoverLogs} remain`);

    const leftoverSecurity = await prisma.systemLog.count({
      where: { category: "security", createdAt: { gte: runStartedAt } },
    });
    check(
      "no scan side-effect rows left behind",
      leftoverSecurity === 0,
      `${leftoverSecurity} security rows remain`,
    );
    if (sideEffects.count > 0) {
      console.log(`        (removed ${sideEffects.count} scan side-effect row(s))`);
    }
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Security alerting behaves correctly.");
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
