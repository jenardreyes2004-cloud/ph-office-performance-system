import type { Prisma, SystemLogLevel } from "@/generated/prisma/client";

import { prisma } from "@/prisma/client";

/**
 * Operational log, kept deliberately separate from the audit trail.
 *
 * The audit log answers "who changed what" — a governance question, read by
 * the super admin. This answers "is the system healthy and who is hitting it" —
 * an operational question, read by the IT admin. Mixing them would bury
 * unhandled errors in a list of routine status changes, and would make a
 * failed login look like a data change.
 *
 * Writes are best-effort and never allowed to fail a request: a monitoring
 * system that can take down the thing it monitors is worse than no monitoring.
 */

export interface SystemLogInput {
  level: SystemLogLevel;
  category: string;
  message: string;
  userId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  durationMs?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown> | null;
}

export const systemLogService = {
  async write(input: SystemLogInput) {
    try {
      await prisma.systemLog.create({
        data: {
          level: input.level,
          category: input.category,
          message: input.message,
          userId: input.userId ?? null,
          method: input.method ?? null,
          path: input.path ?? null,
          status: input.status ?? null,
          durationMs: input.durationMs ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          context: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      // Deliberately swallowed — see the note above.
    }
  },

  /**
   * Fire-and-forget variant for use inside a response listener, where there
   * is nobody left to hand an error to.
   */
  writeDetached(input: SystemLogInput) {
    void this.write(input);
  },

  async list(filters: {
    level?: SystemLogLevel;
    category?: string;
    limit?: number;
  }) {
    return prisma.systemLog.findMany({
      where: {
        ...(filters.level ? { level: filters.level } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filters.limit ?? 200, 500),
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  },

  /** Counts by level over a window, for the health strip at the top of the UI. */
  async summary(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const grouped = await prisma.systemLog.groupBy({
      by: ["level"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0,
    };
    for (const row of grouped) counts[row.level] = row._count._all;

    const categories = await prisma.systemLog.groupBy({
      by: ["category"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 12,
    });

    return { since, counts, categories };
  },
};
