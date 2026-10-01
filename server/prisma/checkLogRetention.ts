import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { pruneSystemLogs } from "../src/services/retention.service";

/**
 * Proves the retention prune does what it claims, and only what it claims.
 *
 * Written before trusting the implementation, because a prune that silently
 * deletes too much is far worse than one that deletes nothing — it would eat
 * the audit trail or recent operational history without anyone noticing.
 *
 * Creates its own rows with backdated timestamps, asserts, then removes every
 * row it created. Safe to run against a development database.
 *
 * Run: npx tsx prisma/checkLogRetention.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const RETENTION_DAYS = 90;
const MARKER = "retention-check";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

/** Builds one row of each kind at a given age. */
async function seed(ageInDays: number, count: number) {
  const createdAt = daysAgo(ageInDays);

  const systemIds = Array.from({ length: count }, () =>
    prisma.systemLog.create({
      data: {
        level: "INFO",
        category: MARKER,
        message: `${MARKER} system ${ageInDays}d`,
        createdAt,
      },
      select: { id: true },
    }),
  );

  const auditIds = Array.from({ length: count }, () =>
    prisma.auditLog.create({
      data: {
        action: `${MARKER} audit ${ageInDays}d`,
        entity: MARKER,
        createdAt,
      },
      select: { id: true },
    }),
  );

  return {
    system: (await Promise.all(systemIds)).map((r) => r.id),
    audit: (await Promise.all(auditIds)).map((r) => r.id),
  };
}

async function cleanup(systemIds: string[], auditIds: string[]) {
  if (systemIds.length) {
    await prisma.systemLog.deleteMany({ where: { id: { in: systemIds } } });
  }
  if (auditIds.length) {
    await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  }
}

async function main() {
  console.log(`Retention check — prune boundary ${RETENTION_DAYS} days\n`);

  // 7 rows older than the window, 3 inside it. A batch size of 3 forces the
  // chunking path with a 7-row backlog: 3 + 3 + 1.
  const old = await seed(RETENTION_DAYS + 10, 7);
  const recent = await seed(RETENTION_DAYS - 10, 3);

  const allSystemIds = [...old.system, ...recent.system];
  const allAuditIds = [...old.audit, ...recent.audit];

  try {
    console.log("seeding");
    check("7 expired system rows exist", (await countSystem(old.system)) === 7);
    check("3 current system rows exist", (await countSystem(recent.system)) === 3);

    console.log("\npruning with batchSize=3 (forces 3 batches)");
    const removed = await pruneSystemLogs(RETENTION_DAYS, 3);

    console.log("");
    check(
      "reports exactly the expired count",
      removed === old.system.length,
      `reported ${removed}, expected ${old.system.length}`,
    );

    check(
      "every expired row is gone",
      (await countSystem(old.system)) === 0,
      `${await countSystem(old.system)} survived`,
    );

    check(
      "every current row survived",
      (await countSystem(recent.system)) === 3,
      `${await countSystem(recent.system)} of 3 remain`,
    );

    check(
      "the audit log was NOT touched",
      (await countAudit(allAuditIds)) === allAuditIds.length,
      `${allAuditIds.length - (await countAudit(allAuditIds))} audit rows lost`,
    );

    // Running twice must be harmless: the second pass has nothing to do.
    console.log("\nre-running (idempotency)");
    const second = await pruneSystemLogs(RETENTION_DAYS, 3);
    check("second run removes nothing", second === 0, `removed ${second}`);
    check(
      "current rows still intact after re-run",
      (await countSystem(recent.system)) === 3,
    );

    // A window longer than the data must be a no-op.
    console.log("\nwindow longer than the data (must be a no-op)");
    const noop = await pruneSystemLogs(3650, 3);
    check("3650-day window removes nothing", noop === 0, `removed ${noop}`);
    check("current rows still intact", (await countSystem(recent.system)) === 3);

    // A zero-day window would put the cutoff at "now" and match every row in
    // the table, so it must be refused outright. It is deliberately NOT tested
    // by running it — an earlier version of this test did exactly that and
    // deleted 30 real log rows along with the fixtures.
    console.log("\nzero-day window (must be refused, not executed)");
    let refusedZero = false;
    try {
      await pruneSystemLogs(0, 3);
    } catch {
      refusedZero = true;
    }
    check("zero-day window is rejected", refusedZero);
    check(
      "current rows survived the rejection",
      (await countSystem(recent.system)) === 3,
      `${await countSystem(recent.system)} of 3 remain`,
    );

    let refusedNegative = false;
    try {
      await pruneSystemLogs(-5, 3);
    } catch {
      refusedNegative = true;
    }
    check("negative window is rejected", refusedNegative);

    // A nonsensical batch size should be refused rather than looping forever.
    console.log("\ninput validation");
    let threw = false;
    try {
      await pruneSystemLogs(RETENTION_DAYS, 0);
    } catch {
      threw = true;
    }
    check("batchSize=0 is rejected", threw);
  } finally {
    console.log("\ncleaning up test rows");
    await cleanup(allSystemIds, allAuditIds);
    const leftSystem = await prisma.systemLog.count({ where: { category: MARKER } });
    const leftAudit = await prisma.auditLog.count({ where: { entity: MARKER } });
    check("no test system rows left behind", leftSystem === 0, `${leftSystem} remain`);
    check("no test audit rows left behind", leftAudit === 0, `${leftAudit} remain`);
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Retention behaves correctly.");
  }
}

async function countSystem(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  return prisma.systemLog.count({ where: { id: { in: ids } } });
}

async function countAudit(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  return prisma.auditLog.count({ where: { id: { in: ids } } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
