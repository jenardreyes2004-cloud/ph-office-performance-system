import { z } from "zod";

const notificationType = z.enum([
  "PLAN_ASSIGNED",
  "UPDATE_OVERDUE",
  "UPDATE_REMINDER_SENT",
  "REPORT_FLAGGED",
  "METRIC_UPDATED",
  "PERFORMANCE_RECORDED",
]);

export const createNotificationSchema = z.object({
  recipientId: z.string().uuid(),
  type: notificationType,
  message: z.string().min(1).max(1000),
  relatedOfficeId: z.string().uuid().optional(),
  relatedPlanId: z.string().uuid().optional(),
  relatedReportId: z.string().uuid().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
