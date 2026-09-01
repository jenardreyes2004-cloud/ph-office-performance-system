import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type { CreateOfficeInput, UpdateOfficeInput } from "@/schemas/office.schema";

export const officeService = {
  async list(includeArchived = false) {
    return prisma.office.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    });
  },

  async getById(id: string) {
    const office = await prisma.office.findUnique({
      where: { id },
      include: { employees: true },
    });
    if (!office) throw new AppError("Office not found", 404);
    return office;
  },

  async create(data: CreateOfficeInput) {
    const existing = await prisma.office.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError(`Office code "${data.code}" is already in use`, 409);

    return prisma.office.create({ data });
  },

  async update(id: string, data: UpdateOfficeInput) {
    await this.getById(id); // 404s if missing
    if (data.code) {
      const existing = await prisma.office.findUnique({ where: { code: data.code } });
      if (existing && existing.id !== id) {
        throw new AppError(`Office code "${data.code}" is already in use`, 409);
      }
    }
    return prisma.office.update({ where: { id }, data });
  },

  async archive(id: string) {
    await this.getById(id);
    return prisma.office.update({ where: { id }, data: { archivedAt: new Date() } });
  },

  async unarchive(id: string) {
    await this.getById(id);
    return prisma.office.update({ where: { id }, data: { archivedAt: null } });
  },
};
