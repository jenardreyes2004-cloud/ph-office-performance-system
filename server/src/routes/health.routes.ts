import { Router } from "express";

import { healthService } from "@/services/health.service";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const healthRouter = Router();

/**
 * Liveness. No database access, so it stays fast and keeps answering even
 * when the database is the thing that is down — otherwise a monitoring probe
 * would fail for the wrong reason and take a healthy process out of service.
 */
healthRouter.get("/", (_req, res) => {
  res.json(healthService.liveness());
});

/**
 * Readiness. This one does touch the database, and returns 503 when it cannot.
 * A check that always answers 200 teaches monitoring to ignore it.
 */
healthRouter.get("/ready", async (_req, res) => {
  const { healthy, payload } = await healthService.readiness();
  res.status(healthy ? 200 : 503).json(payload);
});

/** Full diagnostics: migration state, row counts, process stats. IT admin only. */
healthRouter.get(
  "/detailed",
  authenticate,
  requireRole("IT_ADMIN", "MAIN_ADMIN"),
  async (_req, res) => {
    const report = await healthService.detailed();
    res.status(report.status === "ok" ? 200 : 503).json(report);
  },
);
