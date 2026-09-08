import { prisma } from "@/prisma/client";

import { AppError } from "@/middleware/errorHandler";

import type {
  CreatePerformanceRecordInput,
  UpdatePerformanceRecordInput,
} from "@/schemas/performanceRecord.schema";

export const performanceRecordService = {
  async list() {
    return prisma.performanceRecord.findMany({
      orderBy: { periodStart: "desc" },
      include: {
        employee: true,
        metric: true,
        plan: true,
        recordedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  },

  async getById(id: string) {
    const record = await prisma.performanceRecord.findUnique({
      where: { id },
      include: {
        employee: true,
        metric: true,
        plan: true,
        recordedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!record) {
      throw new AppError("Performance record not found", 404);
    }

    return record;
  },

  async create(data: CreatePerformanceRecordInput, recordedById: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const metric = await prisma.performanceMetric.findUnique({
      where: { id: data.metricId },
    });

    if (!metric) {
      throw new AppError("Performance metric not found", 404);
    }

    if (data.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: data.planId },
      });

      if (!plan) {
        throw new AppError("Plan not found", 404);
      }
    }

    if (data.periodEnd < data.periodStart) {
      throw new AppError("Period end cannot be earlier than period start", 400);
    }

    // Only one performance record is allowed
    // for the same employee, metric, and period.
    const existing = await prisma.performanceRecord.findFirst({
      where: {
        employeeId: data.employeeId,
        metricId: data.metricId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });

    if (existing) {
      throw new AppError(
        "A performance record already exists for this employee, metric, and period.",
        409,
      );
    }

    return prisma.performanceRecord.create({
      data: {
        ...data,
        recordedById,
      },
      include: {
        employee: true,
        metric: true,
        plan: true,
        recordedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  },

  async update(id: string, data: UpdatePerformanceRecordInput) {
    await this.getById(id);

    if (data.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
      });

      if (!employee) {
        throw new AppError("Employee not found", 404);
      }
    }

    if (data.metricId) {
      const metric = await prisma.performanceMetric.findUnique({
        where: { id: data.metricId },
      });

      if (!metric) {
        throw new AppError("Performance metric not found", 404);
      }
    }

    if (data.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: data.planId },
      });

      if (!plan) {
        throw new AppError("Plan not found", 404);
      }
    }

    if (data.periodStart && data.periodEnd) {
      if (data.periodEnd < data.periodStart) {
        throw new AppError(
          "Period end cannot be earlier than period start",
          400,
        );
      }
    }

    return prisma.performanceRecord.update({
      where: { id },
      data,
      include: {
        employee: true,
        metric: true,
        plan: true,
        recordedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  },
};
