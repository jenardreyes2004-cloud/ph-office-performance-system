import { Router } from "express";

import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const auditLogRouter = Router();

auditLogRouter.use(authenticate);

// Reading the audit trail is a supervisory act: it shows who changed another
// person's records, so it is not open to Office Admins or Employees.
auditLogRouter.get("/", requireRole("MAIN_ADMIN", "IT_ADMIN"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const entity = typeof req.query.entity === "string" ? req.query.entity : undefined;

  const entries = await prisma.auditLog.findMany({
    where: entity ? { entity } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  res.json(entries);
});

// One entity's history, for the "who changed this?" question on a record.
auditLogRouter.get("/entity/:entity/:entityId", requireRole("MAIN_ADMIN", "IT_ADMIN"), async (req, res) => {
  // Express 5 types params as string | string[].
  const entity = String(req.params.entity);
  const entityId = String(req.params.entityId);
  if (!/^[a-z-]{1,40}$/.test(entity)) throw new AppError("Invalid entity", 400);

  const entries = await prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  res.json(entries);
});
