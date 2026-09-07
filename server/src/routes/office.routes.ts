import { Router } from "express";

import { officeController } from "@/controllers/office.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const officeRouter = Router();

// All office routes require authentication.
officeRouter.use(authenticate);

// Anyone authenticated can view offices.
officeRouter.get("/", officeController.list);

officeRouter.get("/:id", officeController.getById);

// Only MAIN_ADMIN can modify offices.
officeRouter.post("/", requireRole("MAIN_ADMIN"), officeController.create);

officeRouter.patch("/:id", requireRole("MAIN_ADMIN"), officeController.update);

officeRouter.post(
  "/:id/archive",
  requireRole("MAIN_ADMIN"),
  officeController.archive,
);

officeRouter.post(
  "/:id/unarchive",
  requireRole("MAIN_ADMIN"),
  officeController.unarchive,
);
