import type { Request, Response } from "express";

import { performanceRecordService } from "@/services/performanceRecord.service";
import {
  createPerformanceRecordSchema,
  updatePerformanceRecordSchema,
} from "@/schemas/performanceRecord.schema";

export const performanceRecordController = {
  async list(req: Request, res: Response) {
    const records = await performanceRecordService.list();

    res.json(records);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const record = await performanceRecordService.getById(req.params.id);

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

    const record = await performanceRecordService.update(req.params.id, data);

    res.json(record);
  },
};
