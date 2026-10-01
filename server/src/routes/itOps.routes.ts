import { Router } from "express";

import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";
import { healthService } from "@/services/health.service";
import { prisma } from "@/prisma/client";
import { scanNow, SECURITY_THRESHOLDS } from "@/services/securityAlert.service";

export const itOpsRouter = Router();

itOpsRouter.use(authenticate);

/**
 * Everything on this router is the IT admin's window on the running system.
 * The super admin can read it too — there is no argument for withholding
 * operational health from the top of the hierarchy — but an office head or an
 * employee gets 403 on all of it.
 */
itOpsRouter.use(requireRole("IT_ADMIN", "MAIN_ADMIN"));

/** The IT dashboard's single call: everything the overview needs at once. */
itOpsRouter.get("/overview", async (_req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since1h = new Date(Date.now() - 60 * 60 * 1000);

  const [
    health,
    logCounts,
    recentCritical,
    failedLogins,
    topIps,
    slowest,
    accounts,
    inactiveAccounts,
  ] = await Promise.all([
    healthService.detailed(),

    prisma.systemLog.groupBy({
      by: ["level"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),

    prisma.systemLog.count({
      where: { level: { in: ["ERROR", "CRITICAL"] }, createdAt: { gte: since24h } },
    }),

    prisma.systemLog.count({
      where: { category: "auth", level: "WARN", message: "login_failure", createdAt: { gte: since24h } },
    }),

    prisma.systemLog.groupBy({
      by: ["ip"],
      where: {
        level: "WARN",
        message: "login_failure",
        ip: { not: null },
        createdAt: { gte: since24h },
      },
      _count: { _all: true },
      orderBy: { _count: { ip: "desc" } },
      take: 5,
    }),

    prisma.systemLog.findMany({
      where: { durationMs: { gte: 2000 }, createdAt: { gte: since24h } },
      orderBy: { durationMs: "desc" },
      take: 5,
      select: { method: true, path: true, durationMs: true, createdAt: true },
    }),

    // Account counts. Until account management exists these are the closest
    // thing to a "who is using the system" view.
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),

    prisma.user.count({ where: { isActive: false } }),
  ]);

  const counts: Record<string, number> = {
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    CRITICAL: 0,
  };
  for (const row of logCounts) counts[row.level] = row._count._all;

  const byRole: Record<string, number> = {};
  for (const row of accounts) byRole[row.role] = row._count._all;

  const errorTotal = counts.ERROR + counts.CRITICAL;
  const totalLogged = Object.values(counts).reduce((a, b) => a + b, 0);

  res.json({
    status: health.status,
    database: health.database,
    migrations: health.migrations,
    process: health.process,
    uptimeSeconds: health.uptimeSeconds,

    log: {
      windowHours: 24,
      counts,
      totalLogged,
      errorTotal,
      // A percentage is more useful than a raw count when deciding whether
      // anything is wrong.
      errorRatePct: totalLogged === 0 ? 0 : Math.round((errorTotal / totalLogged) * 1000) / 10,
      errorsAndCritical24h: recentCritical,
    },

    security: {
      failedLogins24h: failedLogins,
      topFailingIps: topIps.map((r) => ({ ip: r.ip, attempts: r._count._all })),
      thresholds: SECURITY_THRESHOLDS,
      lastHour: await prisma.systemLog.count({
        where: { category: "auth", level: "WARN", message: "login_failure", createdAt: { gte: since1h } },
      }),
    },

    accounts: {
      byRole,
      total: Object.values(byRole).reduce((a, b) => a + b, 0),
      deactivated: inactiveAccounts,
    },

    slowRequests: slowest,
  });
});

/** On-demand security scan, for the dashboard's "Scan now" button. */
itOpsRouter.post("/security/scan", async (_req, res) => {
  const result = await scanNow();
  res.json(result);
});

export const itOpsRouterPublic = itOpsRouter;
