import { Router } from "express";

import { planController } from "@/controllers/plan.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const planRouter = Router();

// All plan routes require authentication.
planRouter.use(authenticate);

// Authenticated users can view plans.
planRouter.get("/", planController.list);

planRouter.get("/:id", planController.getById);

// Only MAIN_ADMIN and OFFICE_ADMIN can modify plans.
planRouter.post(
  "/",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.create,
);

planRouter.patch(
  "/:id",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.update,
);

planRouter.post(
  "/:id/archive",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.archive,
);

planRouter.post(
  "/:id/offices",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.addOffice,
);

planRouter.delete(
  "/:id/offices/:officeId",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.removeOffice,
);

planRouter.post(
  "/:id/assignments",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.assignEmployee,
);

planRouter.patch(
  "/:id/assignments/:employeeId",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.updateAssignment,
);

planRouter.delete(
  "/:id/assignments/:employeeId",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  planController.removeAssignment,
);
