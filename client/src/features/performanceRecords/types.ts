export interface PerformanceRecord {
  id: string;
  employeeId: string;
  metricId: string;
  planId: string | null;
  recordedById: string;
  score: number;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };

  metric?: {
    id: string;
    name: string;
    unit: string | null;
    weightPct: string | number;
  };

  plan?: {
    id: string;
    title: string;
  } | null;

  recordedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreatePerformanceRecordInput {
  employeeId: string;
  metricId: string;
  planId?: string;
  score: number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export interface UpdatePerformanceRecordInput {
  employeeId?: string;
  metricId?: string;
  planId?: string;
  score?: number;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
}
