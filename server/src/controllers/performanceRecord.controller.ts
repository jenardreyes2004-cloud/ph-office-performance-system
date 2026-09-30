import type { Request, Response } from "express";

import { resolveActor } from "@/lib/scope";
import { performanceRecordService } from "@/services/performanceRecord.service";
import {
  createPerformanceRecordSchema,
  updatePerformanceRecordSchema,
} from "@/schemas/performanceRecord.schema";

export const performanceRecordController = {
  async list(req: Request, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const records = await performanceRecordService.list(scope);

    res.json(records);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const record = await performanceRecordService.getById(scope, req.params.id);

    res.json(record);
  },

  async create(req: Request, res: Response) {
    const data = createPerformanceRecordSchema.parse(req.body);

    // recordedById will come from the authenticated user.
    const recordedById = req.user!.userId;

    const record = await performanceRecordService.create(data, recordedById);

    res.status(201).json(record);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updatePerformanceRecordSchema.parse(req.body);
    const scope = await resolveActor(req.user!.userId, req.user!.role);

    const record = await performanceRecordService.update(scope, req.params.id, data);

    res.json(record);
  },
};
