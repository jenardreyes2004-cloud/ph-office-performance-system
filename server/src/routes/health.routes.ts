import { Router } from "express";

import { prisma } from "@/prisma/client";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbStatus: "connected" | "error" = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  res.json({
    status: "ok",
    service: "office-performance-system-api",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});
