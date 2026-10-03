import type { Request, Response } from "express";

import { officeService } from "@/services/office.service";
import { orgTreeRootIds, resolveActor } from "@/lib/scope";
import { createOfficeSchema, updateOfficeSchema } from "@/schemas/office.schema";

export const officeController = {
  async list(req: Request, res: Response) {
    const includeArchived = req.query.includeArchived === "true";
    const offices = await officeService.list(includeArchived);
    res.json(offices);
  },

  // Full hierarchy, optionally annotated with scorecards for one period:
  // GET /api/offices/tree?periodId=<uuid>
  //
  // Rooted at what the caller runs: a node head sees their branch and nothing
  // else, an employee sees only their own office, and the super admin sees the
  // whole organization. The chart being reachable by everyone is not the same
  // as everyone seeing every branch.
  async tree(req: Request, res: Response) {
    const periodId = typeof req.query.periodId === "string" ? req.query.periodId : undefined;
    const scope = await resolveActor(req.user!.userId, req.user!.role);
    const tree = await officeService.tree(periodId, orgTreeRootIds(scope));
    res.json(tree);
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
