export interface Office {
  id: string;
  name: string;
  code: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { employees: number };
}

export interface CreateOfficeInput {
  name: string;
  code: string;
  description?: string;
}
