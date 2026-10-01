import type { Request, Response } from "express";

import { accountService, loadActor } from "@/services/account.service";
import {
  changeRoleSchema,
  createAccountSchema,
  updateAccountSchema,
} from "@/schemas/account.schema";
import { AppError } from "@/middleware/errorHandler";
import type { UserRole } from "@/generated/prisma/client";

/**
 * The caller's account is never taken from the request. It comes from the
 * verified JWT, so a body field cannot claim to be somebody else.
 */
function actorFrom(req: Request) {
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId || !role) throw new AppError("Not authenticated.", 401);
  return loadActor(userId, role as UserRole);
}

export const accountController = {
  async list(req: Request, res: Response) {
    const includeInactive = req.query.includeInactive !== "false";
    res.json(await accountService.list(includeInactive));
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    res.json(await accountService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    const data = createAccountSchema.parse(req.body);
    res.status(201).json(await accountService.create((await actorFrom(req)), data));
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateAccountSchema.parse(req.body);
    res.json(await accountService.update((await actorFrom(req)), req.params.id, data));
  },

  async changeRole(req: Request<{ id: string }>, res: Response) {
    const data = changeRoleSchema.parse(req.body);
    res.json(await accountService.changeRole((await actorFrom(req)), req.params.id, data));
  },

  async deactivate(req: Request<{ id: string }>, res: Response) {
    res.json(await accountService.deactivate((await actorFrom(req)), req.params.id));
  },

  async reactivate(req: Request<{ id: string }>, res: Response) {
    res.json(await accountService.reactivate((await actorFrom(req)), req.params.id));
  },
};