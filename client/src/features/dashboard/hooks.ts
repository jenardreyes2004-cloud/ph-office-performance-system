import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface DashboardStats {
  role: string;
  offices: { total: number; active: number };
  employees: number;
  assignments: {
    mine: number;
    recent: {
      id: string;
      planId: string;
      planTitle: string;
      status: string;
      progressPct: number;
      dueDate: string | null;
    }[];
  };
  plans: { total: number; active: number; delayed: number };
  performanceRecords: number;
  scorecards: { draft: number; finalized: number };
}

const DASHBOARD_KEY = ["dashboard", "stats"] as const;

/**
 * Scoped by the server to the caller's role and office, so every figure here
 * is already filtered — there is no client-side narrowing to do.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: async () => {
      const res = await api.get<DashboardStats>("/dashboard/stats");
      return res.data;
    },
  });
}
