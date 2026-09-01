export interface PerformanceMetric {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  weightPct: string | number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricListResult {
  metrics: PerformanceMetric[];
  totalWeight: number;
}

export interface CreateMetricInput {
  name: string;
  description?: string;
  unit?: string;
  weightPct: number;
}

export interface UpdateMetricInput {
  name?: string;
  description?: string;
  unit?: string;
  weightPct?: number;
}
