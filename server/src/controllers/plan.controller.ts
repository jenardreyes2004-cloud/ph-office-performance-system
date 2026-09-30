import type { Request, Response } from "express";

import { resolveActor } from "@/lib/scope";
import { planService } from "@/services/plan.service";
import {
  addPlanOfficeSchema,
  assignEmployeeSchema,
  createPlanSchema,
  updateAssignmentSchema,
  updatePlanSchema,
} from "@/schemas/plan.schema";

export const planController = {
  async list(req: Request, res: Response) {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const plans = await planService.list(scope, status);
    res.json(plans);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const plan = await planService.getById(scope, req.params.id);
    res.json(plan);
  },

  async create(req: Request, res: Response) {
    const data = createPlanSchema.parse(req.body);
    const plan = await planService.create(data);
    res.status(201).json(plan);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updatePlanSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const plan = await planService.update(scope, req.params.id, data);
    res.json(plan);
  },

  async archive(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const plan = await planService.archive(scope, req.params.id);
    res.json(plan);
  },

  async addOffice(req: Request<{ id: string }>, res: Response) {
    const data = addPlanOfficeSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const planOffice = await planService.addOffice(scope, req.params.id, data);
    res.status(201).json(planOffice);
  },

  async removeOffice(req: Request<{ id: string; officeId: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    await planService.removeOffice(scope, req.params.id, req.params.officeId);
    res.status(204).send();
  },

  async assignEmployee(req: Request<{ id: string }>, res: Response) {
    const data = assignEmployeeSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const assignment = await planService.assignEmployee(scope, req.params.id, data);
    res.status(201).json(assignment);
  },

  async updateAssignment(req: Request<{ id: string; employeeId: string }>, res: Response) {
    const data = updateAssignmentSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const assignment = await planService.updateAssignment(
      scope,
      req.params.id,
      req.params.employeeId,
      data,
    );
    res.json(assignment);
  },

  async removeAssignment(req: Request<{ id: string; employeeId: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    await planService.removeAssignment(scope, req.params.id, req.params.employeeId);
    res.status(204).send();
  },
};
