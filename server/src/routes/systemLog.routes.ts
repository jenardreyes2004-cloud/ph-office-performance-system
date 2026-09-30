import { Router } from "express";
import type { SystemLogLevel } from "@/generated/prisma/client";

import { AppError } from "@/middleware/errorHandler";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";
import { systemLogService } from "@/services/systemLog.service";

export const systemLogRouter = Router();

systemLogRouter.use(authenticate);

// The IT admin's window on the running system. The super admin can read it
// too — they are the top of the hierarchy and there is no argument for
// withholding operational health from them.
systemLogRouter.get(
  "/",
  requireRole("IT_ADMIN", "MAIN_ADMIN"),
  async (req, res) => {
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    if (level && !["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"].includes(level)) {
      throw new AppError("Invalid level", 400);
    }

    const entries = await systemLogService.list({
      level: level as SystemLogLevel | undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.json(entries);
  },
);

systemLogRouter.get("/summary", requireRole("IT_ADMIN", "MAIN_ADMIN"), async (req, res) => {
  const hours = req.query.hours ? Math.min(Number(req.query.hours) || 24, 720) : 24;
  const summary = await systemLogService.summary(hours);
  res.json(summary);
});
