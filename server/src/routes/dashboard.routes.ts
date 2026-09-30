import { Router } from "express";

import { resolveActor } from "@/lib/scope";
import { dashboardService } from "@/services/dashboard.service";
import { authenticate } from "@/middleware/authMiddleware";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

// Scoped per role — see dashboard.service.ts. Every authenticated user has a
// dashboard, so there is no requireRole here.
dashboardRouter.get("/stats", async (req, res) => {
  const scope = await resolveActor(req.user!.userId, req.user!.role);
  const stats = await dashboardService.stats(scope);
  res.json(stats);
});
