import { Router } from "express";

import { planController } from "@/controllers/plan.controller";
// Auth/role middleware isn't built yet — these routes are open for now.
// TODO once auth exists: requireAuth, requireRole(["MAIN_ADMIN", "OFFICE_ADMIN"]) on write routes.

export const planRouter = Router();

planRouter.get("/", planController.list);
planRouter.get("/:id", planController.getById);
planRouter.post("/", planController.create);
planRouter.patch("/:id", planController.update);
planRouter.post("/:id/archive", planController.archive);

planRouter.post("/:id/offices", planController.addOffice);
planRouter.delete("/:id/offices/:officeId", planController.removeOffice);

planRouter.post("/:id/assignments", planController.assignEmployee);
planRouter.patch("/:id/assignments/:employeeId", planController.updateAssignment);
planRouter.delete("/:id/assignments/:employeeId", planController.removeAssignment);
