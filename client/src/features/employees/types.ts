export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  officeId: string;
  isActive: boolean;
  hiredAt: string | null;
  createdAt: string;
  office?: { id: string; name: string; code: string };
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  position?: string;
  officeId: string;
}
