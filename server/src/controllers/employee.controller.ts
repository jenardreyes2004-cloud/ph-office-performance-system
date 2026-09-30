import type { Request, Response } from "express";

import { resolveActor } from "@/lib/scope";
import { employeeService } from "@/services/employee.service";
import { createEmployeeSchema, updateEmployeeSchema } from "@/schemas/employee.schema";

export const employeeController = {
  async list(req: Request, res: Response) {
    const officeId = typeof req.query.officeId === "string" ? req.query.officeId : undefined;
    const includeInactive = req.query.includeInactive === "true";
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const employees = await employeeService.list(scope, officeId, includeInactive);
    res.json(employees);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const employee = await employeeService.getById(scope, req.params.id);
    res.json(employee);
  },

  async create(req: Request, res: Response) {
    const data = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(data);
    res.status(201).json(employee);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateEmployeeSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const employee = await employeeService.update(scope, req.params.id, data);
    res.json(employee);
  },

  async deactivate(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const employee = await employeeService.deactivate(scope, req.params.id);
    res.json(employee);
  },

  async reactivate(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const employee = await employeeService.reactivate(scope, req.params.id);
    res.json(employee);
  },
};
