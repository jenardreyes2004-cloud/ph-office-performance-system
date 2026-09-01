import type { Request, Response } from "express";

import { employeeService } from "@/services/employee.service";
import { createEmployeeSchema, updateEmployeeSchema } from "@/schemas/employee.schema";

export const employeeController = {
  async list(req: Request, res: Response) {
    const officeId = typeof req.query.officeId === "string" ? req.query.officeId : undefined;
    const includeInactive = req.query.includeInactive === "true";
    const employees = await employeeService.list(officeId, includeInactive);
    res.json(employees);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const employee = await employeeService.getById(req.params.id);
    res.json(employee);
  },

  async create(req: Request, res: Response) {
    const data = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(data);
    res.status(201).json(employee);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.update(req.params.id, data);
    res.json(employee);
  },

  async deactivate(req: Request<{ id: string }>, res: Response) {
    const employee = await employeeService.deactivate(req.params.id);
    res.json(employee);
  },

  async reactivate(req: Request<{ id: string }>, res: Response) {
    const employee = await employeeService.reactivate(req.params.id);
    res.json(employee);
  },
};
