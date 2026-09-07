import { z } from "zod";

export const createPerformanceRecordSchema = z.object({
  employeeId: z.string().uuid(),
  metricId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  score: z.coerce.number(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

export const updatePerformanceRecordSchema =
  createPerformanceRecordSchema.partial();

export type CreatePerformanceRecordInput = z.infer<
  typeof createPerformanceRecordSchema
>;

export type UpdatePerformanceRecordInput = z.infer<
  typeof updatePerformanceRecordSchema
>;
