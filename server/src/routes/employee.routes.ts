import { Router } from "express";

import { employeeController } from "@/controllers/employee.controller";
// TODO once auth exists: requireAuth, requireRole(["MAIN_ADMIN", "IT_ADMIN"]) on write routes.

export const employeeRouter = Router();

employeeRouter.get("/", employeeController.list);
employeeRouter.get("/:id", employeeController.getById);
employeeRouter.post("/", employeeController.create);
employeeRouter.patch("/:id", employeeController.update);
employeeRouter.post("/:id/deactivate", employeeController.deactivate);
employeeRouter.post("/:id/reactivate", employeeController.reactivate);
