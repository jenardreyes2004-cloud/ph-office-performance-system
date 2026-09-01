import { PrismaClient } from "@prisma/client";

import { env } from "@/config/env";

// Reuse a single PrismaClient across hot-reloads in dev (tsx watch),
// otherwise every file save opens a fresh pool of DB connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}
