import { Router } from "express";

import { metricController } from "@/controllers/metric.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const metricRouter = Router();

// All metric routes require authentication.
metricRouter.use(authenticate);

// Authenticated users can view metrics.
metricRouter.get("/", metricController.list);

metricRouter.get("/:id", metricController.getById);

// Only MAIN_ADMIN can modify performance metrics.
metricRouter.post("/", requireRole("MAIN_ADMIN"), metricController.create);

metricRouter.patch("/:id", requireRole("MAIN_ADMIN"), metricController.update);

metricRouter.post(
  "/:id/archive",
  requireRole("MAIN_ADMIN"),
  metricController.archive,
);

metricRouter.post(
  "/:id/unarchive",
  requireRole("MAIN_ADMIN"),
  metricController.unarchive,
);
