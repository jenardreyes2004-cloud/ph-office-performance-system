import type { Request, Response } from "express";

import { metricService } from "@/services/metric.service";
import { createMetricSchema, updateMetricSchema } from "@/schemas/metric.schema";

export const metricController = {
  async list(req: Request, res: Response) {
    const includeArchived = req.query.includeArchived === "true";
    const result = await metricService.list(includeArchived);
    res.json(result);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const metric = await metricService.getById(req.params.id);
    res.json(metric);
  },

  async create(req: Request, res: Response) {
    const data = createMetricSchema.parse(req.body);
    const metric = await metricService.create(data);
    res.status(201).json(metric);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateMetricSchema.parse(req.body);
    const metric = await metricService.update(req.params.id, data);
    res.json(metric);
  },

  async archive(req: Request<{ id: string }>, res: Response) {
    const metric = await metricService.archive(req.params.id);
    res.json(metric);
  },

  async unarchive(req: Request<{ id: string }>, res: Response) {
    const metric = await metricService.unarchive(req.params.id);
    res.json(metric);
  },
};
