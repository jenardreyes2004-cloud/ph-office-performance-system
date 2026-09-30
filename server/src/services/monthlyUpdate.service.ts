import { prisma } from "@/prisma/client";

import { AppError } from "@/middleware/errorHandler";
import { assignableOfficeIds, monthlyUpdateWhere, type ActorScope } from "@/lib/scope";

import type {
  CreateMonthlyUpdateInput,
  UpdateMonthlyUpdateInput,
} from "@/schemas/monthlyUpdate.schema";

const INCLUDE = {
  office: true,
  plan: true,
  submittedBy: { select: { id: true, name: true, email: true, role: true } },
} as const;

export const monthlyUpdateService = {
  async list(scope: ActorScope, filters: { officeId?: string; planId?: string }) {
    return prisma.monthlyUpdate.findMany({
      where: {
        ...monthlyUpdateWhere(scope),
        ...(filters.officeId ? { officeId: filters.officeId } : {}),
        ...(filters.planId ? { planId: filters.planId } : {}),
      },
      orderBy: { monthStartDate: "desc" },
      include: INCLUDE,
    });
  },

  async getById(scope: ActorScope, id: string) {
    const update = await prisma.monthlyUpdate.findUnique({
      where: { id },
      include: INCLUDE,
    });

    if (!update) {
      throw new AppError("Monthly update not found", 404);
    }

    // An Office Admin must not be able to read another office's submission.
    if (!scope.isSuperAdmin && !scope.officeScopeIds.includes(update.officeId)) {
      throw new AppError("Monthly update not found", 404);
    }

    return update;
  },

  async create(scope: ActorScope, data: CreateMonthlyUpdateInput, submittedByUserId: string) {
    const office = await prisma.office.findUnique({ where: { id: data.officeId } });

    if (!office) {
      throw new AppError("Office not found", 404);
    }

    // An Office Admin may only file updates for their own office subtree.
    const allowed = assignableOfficeIds(scope);
    if (allowed && !allowed.includes(data.officeId)) {
      throw new AppError("You may only submit monthly updates for your own office", 403);
    }

    if (data.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: data.planId } });

      if (!plan) {
        throw new AppError("Plan not found", 404);
      }
    }

    if (data.monthEndDate < data.monthStartDate) {
      throw new AppError("Month end date cannot be earlier than the start date", 400);
    }

    // One update per office (+ plan, if given) per reporting month.
    const existing = await prisma.monthlyUpdate.findFirst({
      where: {
        officeId: data.officeId,
        planId: data.planId ?? null,
        monthStartDate: data.monthStartDate,
        monthEndDate: data.monthEndDate,
      },
    });

    if (existing) {
      throw new AppError(
        "A monthly update already exists for this office and period.",
        409,
      );
    }

    return prisma.monthlyUpdate.create({
      data: {
        ...data,
        submittedByUserId,
        submittedAt: new Date(),
      },
      include: INCLUDE,
    });
  },

  async update(scope: ActorScope, id: string, data: UpdateMonthlyUpdateInput) {
    await this.getById(scope, id); // 404s if missing or not theirs

    return prisma.monthlyUpdate.update({
      where: { id },
      data,
      include: INCLUDE,
    });
  },
};
