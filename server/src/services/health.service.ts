import { prisma } from "@/prisma/client";
import { systemLogService } from "@/services/systemLog.service";

/**
 * Health reporting for the IT admin.
 *
 * Two levels, deliberately:
 *
 *   /health           — a cheap liveness check. Answers "is this process
 *                       serving?" and nothing else. No database round trip, so
 *                       it stays fast and cannot be slowed down by the very
 *                       outage it is meant to detect.
 *   /health/detailed  — the diagnostic view: database latency, migration state,
 *                       row counts, process stats. Authenticated, IT admin
 *                       only.
 *
 * A health check that always returns 200 is worse than none, because it
 * teaches monitoring that the endpoint is not worth watching.
 */

const STARTED_AT = Date.now();

async function checkDatabase() {
  const startedAt = process.hrtime.bigint();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    return { ok: true as const, latencyMs: Math.round(latencyMs * 100) / 100 };
  } catch (err) {
    return {
      ok: false as const,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Reads _prisma_migrations directly rather than shelling out to
 * `prisma migrate status`, which is not available at runtime and would not
 * work from the compiled dist/ output.
 *
 * Reports what has been *applied*. Detecting migrations that exist on disk but
 * have not been applied needs filesystem access, which does not survive
 * compilation — so that half is deliberately not claimed here.
 */
async function checkMigrations() {
  try {
    const rows = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 5
    `;

    const failures = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `;

    const failed = Number(failures[0]?.count ?? 0);

    return {
      ok: failed === 0,
      failed,
      latest: rows
        .filter((r) => r.finished_at)
        .map((r) => ({ name: r.migration_name, appliedAt: r.finished_at })),
    };
  } catch (err) {
    // A missing migrations table is not itself an outage — the database is
    // reachable, which is the question being asked here.
    return {
      ok: true,
      failed: 0,
      latest: [],
      note:
        err instanceof Error
          ? "migration history unavailable"
          : "migration history unavailable",
    };
  }
}

/** Row counts, so an empty table can be told apart from a broken query. */
async function tableCounts() {
  const [offices, employees, users, plans, scorecards, notifications] =
    await Promise.all([
      prisma.office.count(),
      prisma.employee.count(),
      prisma.user.count(),
      prisma.plan.count(),
      prisma.officeScorecard.count(),
      prisma.notification.count(),
    ]);
  return { offices, employees, users, plans, scorecards, notifications };
}

export const healthService = {
  /** Cheap liveness. No database access. */
  liveness() {
    return {
      status: "ok" as const,
      service: "office-performance-system-api",
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Readiness. A failure here returns 503, because a process that cannot reach
   * its database cannot do useful work and should be taken out of rotation.
   */
  async readiness() {
    const database = await checkDatabase();
    const migrations = database.ok ? await checkMigrations() : null;

    const healthy = database.ok && (migrations?.ok ?? true);

    if (!healthy) {
      systemLogService.writeDetached({
        level: "ERROR",
        category: "health",
        message: database.ok
          ? "readiness check failed: migration history shows failures"
          : `readiness check failed: ${database.error}`,
        status: 503,
      });
    }

    return {
      healthy,
      payload: {
        status: healthy ? ("ok" as const) : ("degraded" as const),
        service: "office-performance-system-api",
        database: database.ok
          ? ({ connected: true, latencyMs: database.latencyMs } as const)
          : ({ connected: false, error: database.error } as const),
        migrations,
        timestamp: new Date().toISOString(),
      },
    };
  },

  /** The IT admin diagnostic view. */
  async detailed() {
    const [database, migrations, counts] = await Promise.all([
      checkDatabase(),
      checkMigrations(),
      databaseSafeCounts(),
    ]);

    const memory = process.memoryUsage();

    return {
      status: database.ok && migrations.ok ? ("ok" as const) : ("degraded" as const),
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      timestamp: new Date().toISOString(),
      database,
      migrations,
      counts,
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
      },
    };
  },
};

/** Counts must not fail the whole health report if one table is unreachable. */
async function databaseSafeCounts() {
  try {
    return await tableCounts();
  } catch {
    return null;
  }
}
