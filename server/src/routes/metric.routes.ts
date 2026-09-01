import { Router } from "express";

import { metricController } from "@/controllers/metric.controller";
// Auth/role middleware isn't built yet — these routes are open for now.
// TODO once auth exists: requireAuth, requireRole(["MAIN_ADMIN"]) on write routes.

export const metricRouter = Router();

metricRouter.get("/", metricController.list);
metricRouter.get("/:id", metricController.getById);
metricRouter.post("/", metricController.create);
metricRouter.patch("/:id", metricController.update);
metricRouter.post("/:id/archive", metricController.archive);
metricRouter.post("/:id/unarchive", metricController.unarchive);
