import { Router } from "express";

import { monthlyUpdateController } from "@/controllers/monthlyUpdate.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const monthlyUpdateRouter = Router();

// All monthly update routes require authentication.
monthlyUpdateRouter.use(authenticate);

// Authenticated users can view monthly updates (optionally filtered by ?officeId= / ?planId=).
monthlyUpdateRouter.get("/", monthlyUpdateController.list);

monthlyUpdateRouter.get("/:id", monthlyUpdateController.getById);

// Only MAIN_ADMIN and OFFICE_ADMIN submit or amend monthly updates.
monthlyUpdateRouter.post(
  "/",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  monthlyUpdateController.create,
);

monthlyUpdateRouter.patch(
  "/:id",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  monthlyUpdateController.update,
);
