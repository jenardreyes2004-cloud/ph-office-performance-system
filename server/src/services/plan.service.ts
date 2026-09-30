import type { PlanStatus } from "@/generated/prisma/client";

import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { canAccessPlan, planWhere, type ActorScope } from "@/lib/scope";
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
};

export const planService = {
  async list(scope: ActorScope, status?: string) {
    return prisma.plan.findMany({
      where: { ...planWhere(scope), ...(status ? { status: status as PlanStatus } : {}) },
      orderBy: { periodStart: "desc" },
      include: planListInclude,
    });
  },

  // 404 for "not yours" rather than 403, so a caller cannot probe for the
  // existence of plans they are not allowed to see.
  async getById(scope: ActorScope, id: string) {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: planDetailInclude,
    });
    if (!plan) throw new AppError("Plan not found", 404);
    if (!(await canAccessPlan(scope, id))) throw new AppError("Plan not found", 404);
    return plan;
  },

  async create(data: CreatePlanInput) {
    return prisma.plan.create({ data });
  },

  async update(scope: ActorScope, id: string, data: UpdatePlanInput) {
    await this.getById(scope, id);
    return prisma.plan.update({ where: { id }, data });
  },

  async archive(scope: ActorScope, id: string) {
    await this.getById(scope, id);
    return prisma.plan.update({ where: { id }, data: { status: "ARCHIVED" } });
  },

  // --- Office assignment (PlanOffice) ---

  async addOffice(scope: ActorScope, planId: string, data: AddPlanOfficeInput) {
    await this.getById(scope, planId);

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

  async removeOffice(scope: ActorScope, planId: string, officeId: string) {
    await this.getById(scope, planId);
    const existing = await prisma.planOffice.findUnique({
      where: { planId_officeId: { planId, officeId } },
    });
    if (!existing) throw new AppError("This office is not assigned to the plan", 404);
    await prisma.planOffice.delete({ where: { id: existing.id } });
  },

  // --- Employee assignment (PlanAssignment) ---

  async assignEmployee(scope: ActorScope, planId: string, data: AssignEmployeeInput) {
    await this.getById(scope, planId);

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

  async updateAssignment(
    scope: ActorScope,
    planId: string,
    employeeId: string,
    data: UpdateAssignmentInput,
  ) {
    await this.getById(scope, planId);
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

  async removeAssignment(scope: ActorScope, planId: string, employeeId: string) {
    await this.getById(scope, planId);
    const existing = await prisma.planAssignment.findUnique({
      where: { planId_employeeId: { planId, employeeId } },
    });
    if (!existing) throw new AppError("Assignment not found", 404);
    await prisma.planAssignment.delete({ where: { id: existing.id } });
  },
};