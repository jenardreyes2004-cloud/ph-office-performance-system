import type { AssignmentStatus, PlanStatus } from "@/types";

export interface Plan {
  id: string;
  title: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { planOffices: number; planAssignments: number };
}

export interface PlanOffice {
  id: string;
  planId: string;
  officeId: string;
  target: string | null;
  office: { id: string; name: string; code: string; archivedAt: string | null };
}

export interface PlanAssignmentEmployee {
  id: string;
  firstName: string;
  lastName: string;
  officeId: string;
  isActive?: boolean;
}

export interface PlanAssignment {
  id: string;
  planId: string;
  employeeId: string;
  responsibility: string | null;
  dueDate: string | null;
  status: AssignmentStatus;
  progressPct: string | number;
  createdAt: string;
  updatedAt: string;
  employee: PlanAssignmentEmployee;
}

export interface PlanDetail extends Plan {
  planOffices: PlanOffice[];
  planAssignments: PlanAssignment[];
}

export interface CreatePlanInput {
  title: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  status?: PlanStatus;
}

export interface UpdatePlanInput {
  title?: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  status?: PlanStatus;
}

export interface AddPlanOfficeInput {
  officeId: string;
  target?: string;
}

export interface AssignEmployeeInput {
  employeeId: string;
  responsibility?: string;
  dueDate?: string;
  status?: AssignmentStatus;
  progressPct?: number;
}

export interface UpdateAssignmentInput {
  responsibility?: string;
  dueDate?: string;
  status?: AssignmentStatus;
  progressPct?: number;
}
