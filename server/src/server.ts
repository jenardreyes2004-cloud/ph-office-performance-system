import { createApp } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/prisma/client";
import { systemLogService } from "@/services/systemLog.service";
import {
  startSystemLogRetention,
  stopSystemLogRetention,
} from "@/services/retention.service";
import { startSecurityScan, stopSecurityScan } from "@/services/securityAlert.service";

const app = createApp();

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`);

  // Background jobs start only once the process is serving, so neither can
  // delay startup. Both are unref'd, so neither keeps the process alive.
  startSystemLogRetention();
  startSecurityScan();

  void systemLogService.write({
    level: "INFO",
    category: "startup",
    message: "API started",
    context: { node: process.version, env: env.nodeEnv },
  });
});

// Without this, Ctrl+C leaves the process hanging for the length of the
// keep-alive window instead of exiting promptly.
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down.`);

  stopSystemLogRetention();
  stopSecurityScan();

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
