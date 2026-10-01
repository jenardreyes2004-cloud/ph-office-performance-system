import { prisma } from "@/prisma/client";
import { systemLogService } from "@/services/systemLog.service";

/**
 * Retention for the operational log.
 *
 * system_logs has no natural upper bound and nothing was pruning it, so it
 * grows without limit on a system that logs every request. 90 days is a
 * common window and comfortably covers "what happened when the user reported
 * a problem last month".
 *
 * The audit log is deliberately NOT pruned here. It is a governance record,
 * and how long it must be kept is a policy question for the organisation, not
 * a technical one.
 */

const RETENTION_DAYS = 90;
const INTERVAL_MS = 60 * 60 * 1000; // hourly
const BATCH_SIZE = 5_000; // delete in chunks, not one enormous statement

let timer: NodeJS.Timeout | null = null;

function cutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Deletes in batches so a large backlog does not produce one transaction large
 * enough to stall the database.
 *
 * `batchSize` is injectable so the chunking behaviour can be proven without
 * inserting 5000 rows into a development database.
 */
export async function pruneSystemLogs(
  days = RETENTION_DAYS,
  batchSize = BATCH_SIZE,
): Promise<number> {
  if (batchSize < 1) throw new Error("batchSize must be at least 1");

  // Guards a genuine footgun rather than a hypothetical one: a window of 0
  // days puts the cutoff at "now", so every row in the table matches and the
  // whole operational history is deleted in one pass. Losing recent history is
  // exactly what retention exists to prevent, so this has to be asked for
  // explicitly rather than reached by a miscalculation.
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("Retention window must be at least 1 day");
  }

  const before = cutoff(days);
  let removed = 0;

  for (;;) {
    const batch = await prisma.systemLog.findMany({
      where: { createdAt: { lt: before } },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: { id: true },
    });

    if (batch.length === 0) break;

    const result = await prisma.systemLog.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });

    removed += result.count;

    // A short batch means the previous pass drained the backlog.
    if (batch.length < batchSize) break;
  }

  if (removed > 0) {
    systemLogService.writeDetached({
      level: "INFO",
      category: "maintenance",
      message: `Pruned ${removed} system log entries older than ${days} days`,
      context: { removed, retentionDays: days, batchSize },
    });
  }

  return removed;
}

/**
 * Starts the hourly prune. Safe to call once at boot; a second call is a
 * no-op rather than a second timer.
 */
export function startSystemLogRetention(days = RETENTION_DAYS): void {
  if (timer) return;

  // Deliberately deferred past startup so a large first prune never delays the
  // process becoming ready to serve.
  setTimeout(() => {
    void (async () => {
      try {
        await pruneSystemLogs(days);
      } catch (err) {
        systemLogService.writeDetached({
          level: "WARN",
          category: "maintenance",
          message: "System log prune failed",
          context: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    })();
  }, 30_000).unref();

  timer = setInterval(() => {
    void (async () => {
      try {
        await pruneSystemLogs(days);
      } catch {
        // Swallowed deliberately: a failed prune must never take the interval
        // down, or retention silently stops for the rest of the process's life.
      }
    })();
  }, INTERVAL_MS);

  timer.unref();
}

export function stopSystemLogRetention(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export const SYSTEM_LOG_RETENTION_DAYS = RETENTION_DAYS;
