import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: { status?: number; method?: string; fields?: unknown } | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
}

const AUDIT_KEY = ["audit-log"] as const;

/** Supervisory view — the API refuses it to Office Admins and Employees. */
export function useAuditLog(limit = 200) {
  return useQuery({
    queryKey: [...AUDIT_KEY, limit],
    queryFn: async () => {
      const res = await api.get<AuditEntry[]>(`/audit-log?limit=${limit}`);
      return res.data;
    },
    // The trail does not change while you read it, and it grows forever.
    refetchInterval: 60_000,
  });
}
