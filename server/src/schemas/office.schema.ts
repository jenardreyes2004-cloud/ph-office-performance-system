import { z } from "zod";

export const createOfficeSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(50),
  description: z.string().max(1000).optional(),
});

export const updateOfficeSchema = createOfficeSchema.partial();

export type CreateOfficeInput = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>;
