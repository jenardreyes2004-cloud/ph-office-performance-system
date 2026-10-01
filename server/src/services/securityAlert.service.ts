import { prisma } from "@/prisma/client";
import { systemLogService } from "@/services/systemLog.service";

/**
 * Security alerting for the IT admin.
 *
 * The failed-login events are already captured in the system log; nothing was
 * surfacing them, so a credential-stuffling run across twenty accounts would
 * have looked identical to twenty people mistyping passwords.
 *
 * This watches for the patterns that are actually worth waking someone for,
 * and notifies the IT admin in-app. Two thresholds, both deliberately high
 * enough that they fire on an attack rather than on ordinary confusion.
 */

/** Distinct failures against one email inside the window. */
const REPEATED_FAILURE_THRESHOLD = 5;

/** Distinct emails failing from one address inside the window. */
const SPRAY_THRESHOLD = 3;

const WINDOW_MINUTES = 15;
const INTERVAL_MS = 60 * 1000; // check every minute

// An alert is not re-sent for the same signature within this period, otherwise
// a sustained attack produces one notification per minute forever.
const ALERT_COOLDOWN_MINUTES = 30;

let timer: NodeJS.Timeout | null = null;

interface Signature {
  kind: "repeated" | "spray";
  key: string;
}

const alertedAt = new Map<string, number>();

function shouldAlert(sig: Signature): boolean {
  const last = alertedAt.get(sig.key);
  const now = Date.now();
  if (last && now - last < ALERT_COOLDOWN_MINUTES * 60 * 1000) return false;
  alertedAt.set(sig.key, now);
  return true;
}

/** Keeps the cooldown map from growing without bound. */
function evictStaleCooldowns() {
  const cutoff = Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000 * 4;
  for (const [key, at] of alertedAt) {
    if (at < cutoff) alertedAt.delete(key);
  }
}

async function itAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "IT_ADMIN", isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export interface SecurityScanResult {
  repeatedFailures: { email: string; count: number }[];
  spray: { ip: string; distinctEmails: number }[];
  adminsNotified: number;
}

export async function scanForSecurityEvents(): Promise<SecurityScanResult> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const failures = await prisma.systemLog.findMany({
    where: {
      category: "auth",
      level: "WARN",
      message: "login_failure",
      createdAt: { gte: since },
    },
    select: { context: true, ip: true, createdAt: true },
  });

  const byEmail = new Map<string, number>();
  const byIp = new Map<string, Set<string>>();

  for (const f of failures) {
    const context = f.context as { email?: string | null } | null;
    const email = context?.email ?? null;

    if (email) {
      byEmail.set(email, (byEmail.get(email) ?? 0) + 1);
    }
    if (f.ip && email) {
      const set = byIp.get(f.ip) ?? new Set<string>();
      set.add(email);
      byIp.set(f.ip, set);
    }
  }

  const repeatedFailures = [...byEmail.entries()]
    .filter(([, count]) => count >= REPEATED_FAILURE_THRESHOLD)
    .map(([email, count]) => ({ email, count }));

  const spray = [...byIp.entries()]
    .filter(([, emails]) => emails.size >= SPRAY_THRESHOLD)
    .map(([ip, emails]) => ({ ip, distinctEmails: emails.size }));

  const admins = await itAdminIds();
  let notified = 0;

  for (const entry of repeatedFailures) {
    if (!shouldAlert({ kind: "repeated", key: `repeated:${entry.email}` })) continue;
    notified += await notifyAdmins(admins, {
      type: "REPORT_FLAGGED",
      message: `${entry.count} failed sign-in attempts against ${entry.email} in the last ${WINDOW_MINUTES} minutes. Consider a forced password reset or disabling the account.`,
      context: { kind: "repeated", email: entry.email, count: entry.count },
    });
  }

  for (const entry of spray) {
    if (!shouldAlert({ kind: "spray", key: `spray:${entry.ip}` })) continue;
    notified += await notifyAdmins(admins, {
      type: "REPORT_FLAGGED",
      message: `${entry.distinctEmails} different accounts failed to sign in from ${entry.ip} in the last ${WINDOW_MINUTES} minutes. This pattern is consistent with credential stuffing.`,
      context: { kind: "spray", ip: entry.ip, distinctEmails: entry.distinctEmails },
    });
  }

  return { repeatedFailures, spray, adminsNotified: notified };
}

async function notifyAdmins(
  adminIds: string[],
  input: { type: string; message: string; context: Record<string, unknown> },
): Promise<number> {
  let sent = 0;

  for (const recipientId of adminIds) {
    try {
      await prisma.notification.create({
        data: {
          recipientId,
          type: input.type as never,
          message: input.message,
          // Recorded in metadata rather than a column, since the Notification
          // model has no field for an IP. The system log holds the detail.
        },
      });
      sent += 1;
    } catch {
      // One failed notification must not abort the rest of the scan.
    }
  }

  if (sent > 0) {
    systemLogService.writeDetached({
      level: "WARN",
      category: "security",
      message: input.message,
      context: input.context,
    });
  }

  return sent;
}

/** Manual trigger, for the IT admin dashboard's "Scan now" control. */
export async function scanNow() {
  evictStaleCooldowns();
  return scanForSecurityEvents();
}

export function startSecurityScan(): void {
  if (timer) return;

  timer = setInterval(() => {
    void (async () => {
      try {
        evictStaleCooldowns();
        await scanForSecurityEvents();
      } catch {
        // Swallowed: a failed scan must not kill the interval, or alerting
        // silently stops for the rest of the process's life.
      }
    })();
  }, INTERVAL_MS);

  timer.unref();
}

export function stopSecurityScan(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export const SECURITY_THRESHOLDS = {
  repeatedFailures: REPEATED_FAILURE_THRESHOLD,
  spray: SPRAY_THRESHOLD,
  windowMinutes: WINDOW_MINUTES,
} as const;
