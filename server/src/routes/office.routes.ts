import { Router } from "express";

import { officeController } from "@/controllers/office.controller";
// Auth/role middleware isn't built yet — these routes are open for now.
// TODO once auth exists: requireAuth, requireRole(["MAIN_ADMIN"]) on write routes.

export const officeRouter = Router();

officeRouter.get("/", officeController.list);
officeRouter.get("/:id", officeController.getById);
officeRouter.post("/", officeController.create);
officeRouter.patch("/:id", officeController.update);
officeRouter.post("/:id/archive", officeController.archive);
officeRouter.post("/:id/unarchive", officeController.unarchive);
