import { z } from "zod";

const PLAN_STATUSES = ["DRAFT", "ACTIVE", "ONGOING", "COMPLETED", "DELAYED", "ARCHIVED"] as const;
const ASSIGNMENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED",
  "CANCELLED",
] as const;

export const createPlanSchema = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    status: z.enum(PLAN_STATUSES).optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "periodEnd must be on or after periodStart",
    path: ["periodEnd"],
  });

// .partial() can't follow .refine(), so the update schema is defined
// separately and re-checks the date ordering only when both dates are present.
export const updatePlanSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    status: z.enum(PLAN_STATUSES).optional(),
  })
  .refine(
    (data) => !data.periodStart || !data.periodEnd || data.periodEnd >= data.periodStart,
    { message: "periodEnd must be on or after periodStart", path: ["periodEnd"] },
  );

export const addPlanOfficeSchema = z.object({
  officeId: z.string().min(1, "Office is required"),
  target: z.string().max(500).optional(),
});

export const assignEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  responsibility: z.string().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  progressPct: z.coerce.number().min(0).max(100).optional(),
});

export const updateAssignmentSchema = z.object({
  responsibility: z.string().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  progressPct: z.coerce.number().min(0).max(100).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type AddPlanOfficeInput = z.infer<typeof addPlanOfficeSchema>;
export type AssignEmployeeInput = z.infer<typeof assignEmployeeSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
