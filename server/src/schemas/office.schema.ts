import { z } from "zod";

export const createOfficeSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(50),
  description: z.string().max(1000).optional(),
  // Null/absent puts the office at the top of the hierarchy. See
  // prisma/seedOrganizationStructure.ts for the real PhilHealth tree.
  parentId: z.string().uuid().nullable().optional(),
  // Only head offices (the OVP and the three NCR regionals) run a scorecard.
  isHeadOffice: z.boolean().optional(),
});

export const updateOfficeSchema = createOfficeSchema.partial();

export type CreateOfficeInput = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>;
