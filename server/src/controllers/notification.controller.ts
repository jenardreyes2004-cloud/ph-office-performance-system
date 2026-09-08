import type { Request, Response } from "express";

import { notificationService } from "@/services/notification.service";
import { createNotificationSchema } from "@/schemas/notification.schema";

export const notificationController = {
  // Always the current user's own notifications — there is no
  // "view someone else's notifications" endpoint, by design.
  async listMine(req: Request, res: Response) {
    const unreadOnly = req.query.unreadOnly === "true";
    const notifications = await notificationService.listForUser(req.user!.userId, unreadOnly);

    res.json(notifications);
  },

  async create(req: Request, res: Response) {
    const data = createNotificationSchema.parse(req.body);
    const senderId = req.user!.userId;

    const notification = await notificationService.create(data, senderId);

    res.status(201).json(notification);
  },

  async markRead(req: Request<{ id: string }>, res: Response) {
    const notification = await notificationService.markRead(req.params.id, req.user!.userId);

    res.json(notification);
  },

  async markAllRead(req: Request, res: Response) {
    const result = await notificationService.markAllRead(req.user!.userId);

    res.json(result);
  },
};
