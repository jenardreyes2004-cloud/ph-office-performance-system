import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type { CreateMetricInput, UpdateMetricInput } from "@/schemas/metric.schema";

const MAX_TOTAL_WEIGHT = 100;

async function assertWeightBudget(newWeight: number, excludeId?: string) {
  const active = await prisma.performanceMetric.findMany({
    where: { archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { weightPct: true },
  });
  const currentTotal = active.reduce((sum, m) => sum + Number(m.weightPct), 0);
  const projectedTotal = currentTotal + newWeight;

  if (projectedTotal > MAX_TOTAL_WEIGHT) {
    const remaining = Math.max(0, MAX_TOTAL_WEIGHT - currentTotal);
    throw new AppError(
      `Active metric weights can't exceed 100%. ${remaining.toFixed(2)}% is currently available.`,
      422,
    );
  }
}

export const metricService = {
  async list(includeArchived = false) {
    const metrics = await prisma.performanceMetric.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { name: "asc" },
    });
    const totalWeight = metrics
      .filter((m) => !m.archivedAt)
      .reduce((sum, m) => sum + Number(m.weightPct), 0);
    return { metrics, totalWeight };
  },

  async getById(id: string) {
    const metric = await prisma.performanceMetric.findUnique({ where: { id } });
    if (!metric) throw new AppError("Metric not found", 404);
    return metric;
  },

  async create(data: CreateMetricInput) {
    const existing = await prisma.performanceMetric.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(`A metric named "${data.name}" already exists`, 409);

    await assertWeightBudget(data.weightPct);
    return prisma.performanceMetric.create({ data });
  },

  async update(id: string, data: UpdateMetricInput) {
    const metric = await this.getById(id); // 404s if missing

    if (data.name && data.name !== metric.name) {
      const existing = await prisma.performanceMetric.findUnique({ where: { name: data.name } });
      if (existing) throw new AppError(`A metric named "${data.name}" already exists`, 409);
    }

    if (data.weightPct !== undefined && !metric.archivedAt) {
      await assertWeightBudget(data.weightPct, id);
    }

    return prisma.performanceMetric.update({ where: { id }, data });
  },

  async archive(id: string) {
    await this.getById(id);
    return prisma.performanceMetric.update({ where: { id }, data: { archivedAt: new Date() } });
  },

  async unarchive(id: string) {
    const metric = await this.getById(id);
    await assertWeightBudget(Number(metric.weightPct), id);
    return prisma.performanceMetric.update({ where: { id }, data: { archivedAt: null } });
  },
};
