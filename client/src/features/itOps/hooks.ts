import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { SystemLogLevel } from "@/types";

export interface ItOpsOverview {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  database: { ok: boolean; latencyMs: number | null; error?: string };
  migrations: { ok: boolean; failed: number; latest: { name: string; appliedAt: string }[] };
  process: { nodeVersion: string; pid: number; rssMb: number; heapUsedMb: number };
  log: {
    windowHours: number;
    counts: Record<SystemLogLevel, number>;
    totalLogged: number;
    errorTotal: number;
    errorRatePct: number;
    errorsAndCritical24h: number;
  };
  security: {
    failedLogins24h: number;
    topFailingIps: { ip: string; attempts: number }[];
    thresholds: { repeatedFailures: number; spray: number; windowMinutes: number };
    lastHour: number;
  };
  accounts: {
    byRole: Record<string, number>;
    total: number;
    deactivated: number;
  };
  slowRequests: { method: string; path: string; durationMs: number; createdAt: string }[];
}

export interface SecurityScanResult {
  repeatedFailures: { email: string; count: number }[];
  spray: { ip: string; distinctEmails: number }[];
  adminsNotified: number;
}

const KEY = ["it-ops"] as const;

/**
 * The IT admin's system view.
 *
 * Deliberately a different shape from the generic dashboard: that one answers
 * "what is happening in the organisation", this one answers "is the system
 * healthy and is anyone attacking it". Reusing the org dashboard here would
 * show an IT admin figures they have no authority over and hide the ones they
 * do — which is exactly the confusion the spine split was meant to remove.
 */
export function useItOpsOverview() {
  return useQuery({
    queryKey: [...KEY, "overview"],
    queryFn: async () => {
      const res = await api.get<ItOpsOverview>("/it-ops/overview");
      return res.data;
    },
    // Operational data goes stale; the counts are meant to be watched.
    refetchInterval: 30_000,
  });
}

/** On-demand security scan. The background job also runs every minute. */
export function useSecurityScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<SecurityScanResult>("/it-ops/security/scan");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
