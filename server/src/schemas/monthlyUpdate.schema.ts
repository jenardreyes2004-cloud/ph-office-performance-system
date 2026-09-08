import { z } from "zod";

export const createMonthlyUpdateSchema = z.object({
  officeId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  monthStartDate: z.coerce.date(),
  monthEndDate: z.coerce.date(),
  content: z.string().min(1).max(5000),
});

export const updateMonthlyUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  status: z.enum(["ON_TIME", "LATE", "MISSING"]).optional(),
});

export type CreateMonthlyUpdateInput = z.infer<typeof createMonthlyUpdateSchema>;
export type UpdateMonthlyUpdateInput = z.infer<typeof updateMonthlyUpdateSchema>;
