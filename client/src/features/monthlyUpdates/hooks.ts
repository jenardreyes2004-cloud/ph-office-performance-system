import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CreateMonthlyUpdateInput, MonthlyUpdate } from "@/features/monthlyUpdates/types";

const UPDATES_KEY = ["monthly-updates"] as const;

export function useMonthlyUpdates(filters?: { officeId?: string; planId?: string }) {
  return useQuery({
    queryKey: [...UPDATES_KEY, filters ?? {}],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.officeId) params.set("officeId", filters.officeId);
      if (filters?.planId) params.set("planId", filters.planId);
      const qs = params.toString();
      const res = await api.get<MonthlyUpdate[]>(`/monthly-updates${qs ? `?${qs}` : ""}`);
      return res.data;
    },
  });
}

export function useCreateMonthlyUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMonthlyUpdateInput) => {
      const res = await api.post<MonthlyUpdate>("/monthly-updates", input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UPDATES_KEY });
    },
  });
}
