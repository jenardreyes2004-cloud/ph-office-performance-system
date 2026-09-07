import { Router } from "express";

import { employeeController } from "@/controllers/employee.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const employeeRouter = Router();

// All employee routes require authentication.
employeeRouter.use(authenticate);

// Authenticated users can view employees.
employeeRouter.get("/", employeeController.list);

employeeRouter.get("/:id", employeeController.getById);

// Only MAIN_ADMIN and IT_ADMIN can modify employees.
employeeRouter.post(
  "/",
  requireRole("MAIN_ADMIN", "IT_ADMIN"),
  employeeController.create,
);

employeeRouter.patch(
  "/:id",
  requireRole("MAIN_ADMIN", "IT_ADMIN"),
  employeeController.update,
);

employeeRouter.post(
  "/:id/deactivate",
  requireRole("MAIN_ADMIN", "IT_ADMIN"),
  employeeController.deactivate,
);

employeeRouter.post(
  "/:id/reactivate",
  requireRole("MAIN_ADMIN", "IT_ADMIN"),
  employeeController.reactivate,
);
