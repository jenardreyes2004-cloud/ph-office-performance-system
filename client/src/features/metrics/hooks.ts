import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CreateMetricInput, MetricListResult, PerformanceMetric } from "@/features/metrics/types";

const METRICS_KEY = ["metrics"] as const;

export function useMetrics() {
  return useQuery({
    queryKey: METRICS_KEY,
    queryFn: async () => {
      const res = await api.get<MetricListResult>("/metrics");
      return res.data;
    },
  });
}

export function useCreateMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMetricInput) => {
      const res = await api.post<PerformanceMetric>("/metrics", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: METRICS_KEY });
    },
  });
}

export function useArchiveMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<PerformanceMetric>(`/metrics/${id}/archive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: METRICS_KEY });
    },
  });
}

export function useUnarchiveMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<PerformanceMetric>(`/metrics/${id}/unarchive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: METRICS_KEY });
    },
  });
}
