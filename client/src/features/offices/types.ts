export interface Office {
  id: string;
  name: string;
  code: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parentId?: string | null;
  isHeadOffice?: boolean;
  parent?: { id: string; name: string; code: string } | null;
  children?: { id: string; name: string; code: string; isHeadOffice: boolean }[];
  _count?: { employees: number };
}

/** One node of GET /offices/tree, with its children nested. */
export interface OfficeNode {
  id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
  parentId: string | null;
  employeeCount: number;
  /** Headcount across the subtree, this office included. */
  totalEmployeeCount: number;
  scorecard: {
    id: string;
    status: string;
    officeRating: string | null;
    totalScore: string | number | null;
  } | null;
  children: OfficeNode[];
}

export interface CreateOfficeInput {
  name: string;
  code: string;
  description?: string;
  parentId?: string | null;
  isHeadOffice?: boolean;
}
