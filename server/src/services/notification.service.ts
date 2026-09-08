import { prisma } from "@/prisma/client";

import { AppError } from "@/middleware/errorHandler";

import type { CreateNotificationInput } from "@/schemas/notification.schema";

export const notificationService = {
  // A user only ever sees their own notifications.
  async listForUser(recipientId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: {
        recipientId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  },

  async create(data: CreateNotificationInput, senderId?: string) {
    const recipient = await prisma.user.findUnique({ where: { id: data.recipientId } });

    if (!recipient || !recipient.isActive) {
      throw new AppError("Recipient not found", 404);
    }

    if (data.relatedOfficeId) {
      const office = await prisma.office.findUnique({ where: { id: data.relatedOfficeId } });
      if (!office) throw new AppError("Related office not found", 404);
    }

    if (data.relatedPlanId) {
      const plan = await prisma.plan.findUnique({ where: { id: data.relatedPlanId } });
      if (!plan) throw new AppError("Related plan not found", 404);
    }

    if (data.relatedReportId) {
      const report = await prisma.report.findUnique({ where: { id: data.relatedReportId } });
      if (!report) throw new AppError("Related report not found", 404);
    }

    return prisma.notification.create({
      data: { ...data, senderId },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  },

  // Marks one notification read, scoped to its owner — a user can never
  // mark (or even discover the existence of) someone else's notification.
  async markRead(id: string, recipientId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.recipientId !== recipientId) {
      throw new AppError("Notification not found", 404);
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markAllRead(recipientId: string) {
    const { count } = await prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true },
    });

    return { updated: count };
  },
};
