import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { SystemLogLevel } from "@/types";

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  category: string;
  message: string;
  method: string | null;
  path: string | null;
  status: number | null;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  context: unknown;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
}

export interface SystemLogSummary {
  since: string;
  counts: Record<SystemLogLevel, number>;
  categories: { category: string; _count: { _all: number } }[];
}

const KEY = ["system-log"] as const;

export function useSystemLog(level?: SystemLogLevel, category?: string) {
  return useQuery({
    queryKey: [...KEY, level ?? "all", category ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      if (category) params.set("category", category);
      const qs = params.toString();
      const res = await api.get<SystemLogEntry[]>(`/system-log${qs ? `?${qs}` : ""}`);
      return res.data;
    },
    // The log grows while you watch it; a slow poll keeps it useful without
    // hammering the API.
    refetchInterval: 30_000,
  });
}

export function useSystemLogSummary(hours = 24) {
  return useQuery({
    queryKey: [...KEY, "summary", hours],
    queryFn: async () => {
      const res = await api.get<SystemLogSummary>(`/system-log/summary?hours=${hours}`);
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
