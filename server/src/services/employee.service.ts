import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { canAccessEmployee, employeeWhere, type ActorScope } from "@/lib/scope";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/schemas/employee.schema";

export const employeeService = {
  async list(
    scope: ActorScope,
    officeId?: string,
    includeInactive = false,
  ) {
    return prisma.employee.findMany({
      where: employeeWhere(scope, { officeId, includeInactive }),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { office: { select: { id: true, name: true, code: true } } },
    });
  },

  async getById(scope: ActorScope, id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { office: true, planAssignments: true },
    });
    if (!employee) throw new AppError("Employee not found", 404);
    if (!(await canAccessEmployee(scope, id))) throw new AppError("Employee not found", 404);
    return employee;
  },

  async create(data: CreateEmployeeInput) {
    const office = await prisma.office.findUnique({ where: { id: data.officeId } });
    if (!office) throw new AppError("Office not found", 404);
    if (office.archivedAt) throw new AppError("Cannot assign employee to an archived office", 400);

    return prisma.employee.create({ data });
  },

  // Roster writes are MAIN_ADMIN / IT_ADMIN only, and both hold the whole
  // roster, so the scope check in getById is a no-op here. It is still
  // applied so the rule holds if those routes ever widen.
  async update(scope: ActorScope, id: string, data: UpdateEmployeeInput) {
    await this.getById(scope, id);
    if (data.officeId) {
      const office = await prisma.office.findUnique({ where: { id: data.officeId } });
      if (!office) throw new AppError("Office not found", 404);
    }
    return prisma.employee.update({ where: { id }, data });
  },

  async deactivate(scope: ActorScope, id: string) {
    await this.getById(scope, id);
    return prisma.employee.update({ where: { id }, data: { isActive: false } });
  },

  async reactivate(scope: ActorScope, id: string) {
    await this.getById(scope, id);
    return prisma.employee.update({ where: { id }, data: { isActive: true } });
  },
};
