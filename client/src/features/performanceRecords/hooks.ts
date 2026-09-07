import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

import type {
  CreatePerformanceRecordInput,
  PerformanceRecord,
} from "@/features/performanceRecords/types";

const PERFORMANCE_RECORDS_KEY = ["performance-records"] as const;

export function usePerformanceRecords() {
  return useQuery({
    queryKey: PERFORMANCE_RECORDS_KEY,
    queryFn: async () => {
      const res = await api.get<PerformanceRecord[]>("/performance-records");

      return res.data;
    },
  });
}
export function useCreatePerformanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePerformanceRecordInput) => {
      const res = await api.post<PerformanceRecord>(
        "/performance-records",
        input,
      );

      return res.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PERFORMANCE_RECORDS_KEY,
      });
    },
  });
}
