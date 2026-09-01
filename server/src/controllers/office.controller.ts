import type { Request, Response } from "express";

import { officeService } from "@/services/office.service";
import { createOfficeSchema, updateOfficeSchema } from "@/schemas/office.schema";

export const officeController = {
  async list(req: Request, res: Response) {
    const includeArchived = req.query.includeArchived === "true";
    const offices = await officeService.list(includeArchived);
    res.json(offices);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const office = await officeService.getById(req.params.id);
    res.json(office);
  },

  async create(req: Request, res: Response) {
    const data = createOfficeSchema.parse(req.body);
    const office = await officeService.create(data);
    res.status(201).json(office);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateOfficeSchema.parse(req.body);
    const office = await officeService.update(req.params.id, data);
    res.json(office);
  },

  async archive(req: Request<{ id: string }>, res: Response) {
    const office = await officeService.archive(req.params.id);
    res.json(office);
  },

  async unarchive(req: Request<{ id: string }>, res: Response) {
    const office = await officeService.unarchive(req.params.id);
    res.json(office);
  },
};
