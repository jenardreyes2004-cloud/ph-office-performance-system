import { Router } from "express";

import { notificationController } from "@/controllers/notification.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

// Every user can only ever see and manage their own notifications.
notificationRouter.get("/", notificationController.listMine);
notificationRouter.post("/mark-all-read", notificationController.markAllRead);
notificationRouter.patch("/:id/read", notificationController.markRead);

// Recipient picker for the admin send form. Declared before "/:id/read" so
// the literal is not captured as an id.
notificationRouter.get(
  "/recipients",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN", "IT_ADMIN"),
  notificationController.listRecipients,
);

// Only admins can manually push a notification to someone
// (e.g. pinging an office admin about a delayed update).
notificationRouter.post(
  "/",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN", "IT_ADMIN"),
  notificationController.create,
);
