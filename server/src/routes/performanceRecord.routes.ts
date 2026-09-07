import { Router } from "express";

import { performanceRecordController } from "@/controllers/performanceRecord.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const performanceRecordRouter = Router();

// All performance record routes require authentication.
performanceRecordRouter.use(authenticate);

// Authenticated users can view performance records.
performanceRecordRouter.get("/", performanceRecordController.list);

performanceRecordRouter.get("/:id", performanceRecordController.getById);

// For the baseline system, MAIN_ADMIN can create/update performance records.
performanceRecordRouter.post(
  "/",
  requireRole("MAIN_ADMIN"),
  performanceRecordController.create,
);

performanceRecordRouter.patch(
  "/:id",
  requireRole("MAIN_ADMIN"),
  performanceRecordController.update,
);
