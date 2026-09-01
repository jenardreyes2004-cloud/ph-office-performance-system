import type { PlanStatus } from "@prisma/client";

import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type {
  AddPlanOfficeInput,
  AssignEmployeeInput,
  CreatePlanInput,
  UpdateAssignmentInput,
  UpdatePlanInput,
} from "@/schemas/plan.schema";

const planListInclude = {
  _count: { select: { planOffices: true, planAssignments: true } },
} as const;

const planDetailInclude = {
  planOffices: {
    include: { office: { select: { id: true, name: true, code: true, archivedAt: true } } },
  },
  planAssignments: {
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, officeId: true, isActive: true },
      },
    },
    orderBy: [{ createdAt: "asc" as const }],
  },
} as const;

export const planService = {
  async list(status?: string) {
    return prisma.plan.findMany({
      where: status ? { status: status as PlanStatus } : {},
      orderBy: { periodStart: "desc" },
      include: planListInclude,
    });
  },

  async getById(id: string) {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: planDetailInclude,
    });
    if (!plan) throw new AppError("Plan not found", 404);
    return plan;
  },

  async create(data: CreatePlanInput) {
    return prisma.plan.create({ data });
  },

  async update(id: string, data: UpdatePlanInput) {
    await this.getById(id); // 404s if missing
    return prisma.plan.update({ where: { id }, data });
  },

  async archive(id: string) {
    await this.getById(id);
    return prisma.plan.update({ where: { id }, data: { status: "ARCHIVED" } });
  },

  // --- Office assignment (PlanOffice) ---

  async addOffice(planId: string, data: AddPlanOfficeInput) {
    await this.getById(planId);

    const office = await prisma.office.findUnique({ where: { id: data.officeId } });
    if (!office) throw new AppError("Office not found", 404);
    if (office.archivedAt) throw new AppError("Cannot assign an archived office to a plan", 400);

    const existing = await prisma.planOffice.findUnique({
      where: { planId_officeId: { planId, officeId: data.officeId } },
    });
    if (existing) throw new AppError("This office is already assigned to the plan", 409);

    return prisma.planOffice.create({
      data: { planId, officeId: data.officeId, target: data.target },
      include: { office: { select: { id: true, name: true, code: true } } },
    });
  },

  async removeOffice(planId: string, officeId: string) {
    await this.getById(planId);
    const existing = await prisma.planOffice.findUnique({
      where: { planId_officeId: { planId, officeId } },
    });
    if (!existing) throw new AppError("This office is not assigned to the plan", 404);
    await prisma.planOffice.delete({ where: { id: existing.id } });
  },

  // --- Employee assignment (PlanAssignment) ---

  async assignEmployee(planId: string, data: AssignEmployeeInput) {
    await this.getById(planId);

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError("Employee not found", 404);
    if (!employee.isActive) throw new AppError("Cannot assign an inactive employee", 400);

    const officeOnPlan = await prisma.planOffice.findUnique({
      where: { planId_officeId: { planId, officeId: employee.officeId } },
    });
    if (!officeOnPlan) {
      throw new AppError("The employee's office must be assigned to the plan first", 400);
    }

    const existing = await prisma.planAssignment.findUnique({
      where: { planId_employeeId: { planId, employeeId: data.employeeId } },
    });
    if (existing) throw new AppError("This employee is already assigned to the plan", 409);

    return prisma.planAssignment.create({
      data: {
        planId,
        employeeId: data.employeeId,
        responsibility: data.responsibility,
        dueDate: data.dueDate,
        status: data.status,
        progressPct: data.progressPct,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, officeId: true } },
      },
    });
  },

  async updateAssignment(planId: string, employeeId: string, data: UpdateAssignmentInput) {
    const existing = await prisma.planAssignment.findUnique({
      where: { planId_employeeId: { planId, employeeId } },
    });
    if (!existing) throw new AppError("Assignment not found", 404);

    return prisma.planAssignment.update({
      where: { id: existing.id },
      data,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, officeId: true } },
      },
    });
  },

  async removeAssignment(planId: string, employeeId: string) {
    const existing = await prisma.planAssignment.findUnique({
      where: { planId_employeeId: { planId, employeeId } },
    });
    if (!existing) throw new AppError("Assignment not found", 404);
    await prisma.planAssignment.delete({ where: { id: existing.id } });
  },
};
