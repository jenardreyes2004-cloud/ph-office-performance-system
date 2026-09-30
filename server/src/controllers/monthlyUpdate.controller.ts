import type { Request, Response } from "express";

import { resolveActor } from "@/lib/scope";
import { monthlyUpdateService } from "@/services/monthlyUpdate.service";
import {
  createMonthlyUpdateSchema,
  updateMonthlyUpdateSchema,
} from "@/schemas/monthlyUpdate.schema";

export const monthlyUpdateController = {
  async list(req: Request, res: Response) {
    const officeId = typeof req.query.officeId === "string" ? req.query.officeId : undefined;
    const planId = typeof req.query.planId === "string" ? req.query.planId : undefined;

    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const updates = await monthlyUpdateService.list(scope, { officeId, planId });

    res.json(updates);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const update = await monthlyUpdateService.getById(scope, req.params.id);

    res.json(update);
  },

  async create(req: Request, res: Response) {
    const data = createMonthlyUpdateSchema.parse(req.body);

    // submittedByUserId comes from the authenticated user, never the request body.
    const submittedByUserId = req.user!.userId;

    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const update = await monthlyUpdateService.create(scope, data, submittedByUserId);

    res.status(201).json(update);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateMonthlyUpdateSchema.parse(req.body);

    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const update = await monthlyUpdateService.update(scope, req.params.id, data);

    res.json(update);
  },
};
