import { z } from "zod";

export const createMetricSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional(),
  unit: z.string().max(30).optional(),
  weightPct: z.coerce.number().min(0).max(100),
});

export const updateMetricSchema = createMetricSchema.partial();

export type CreateMetricInput = z.infer<typeof createMetricSchema>;
export type UpdateMetricInput = z.infer<typeof updateMetricSchema>;
