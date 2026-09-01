import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/schemas/employee.schema";

export const employeeService = {
  async list(officeId?: string, includeInactive = false) {
    return prisma.employee.findMany({
      where: {
        ...(officeId ? { officeId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { office: { select: { id: true, name: true, code: true } } },
    });
  },

  async getById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { office: true, planAssignments: true },
    });
    if (!employee) throw new AppError("Employee not found", 404);
    return employee;
  },

  async create(data: CreateEmployeeInput) {
    const office = await prisma.office.findUnique({ where: { id: data.officeId } });
    if (!office) throw new AppError("Office not found", 404);
    if (office.archivedAt) throw new AppError("Cannot assign employee to an archived office", 400);

    return prisma.employee.create({ data });
  },

  async update(id: string, data: UpdateEmployeeInput) {
    await this.getById(id);
    if (data.officeId) {
      const office = await prisma.office.findUnique({ where: { id: data.officeId } });
      if (!office) throw new AppError("Office not found", 404);
    }
    return prisma.employee.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    await this.getById(id);
    return prisma.employee.update({ where: { id }, data: { isActive: false } });
  },

  async reactivate(id: string) {
    await this.getById(id);
    return prisma.employee.update({ where: { id }, data: { isActive: true } });
  },
};
