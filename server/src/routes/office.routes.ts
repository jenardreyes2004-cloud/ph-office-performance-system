import { Router } from "express";

import { officeController } from "@/controllers/office.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";
import { prisma } from "@/prisma/client";
import { AppError } from "@/middleware/errorHandler";
import { resolveActor, orgNodeDetailLevel } from "@/lib/scope";
import { nodeOverview } from "@/services/orgOverview.service";
import { previewMove, moveNode } from "@/services/orgMove.service";

export const officeRouter = Router();

// All office routes require authentication.
officeRouter.use(authenticate);

// Anyone authenticated can view offices.
officeRouter.get("/", officeController.list);

// Declared before "/:id" so "tree" is not swallowed as an office id.
officeRouter.get("/tree", officeController.tree);

officeRouter.get("/:id", officeController.getById);

/**
 * Everything one node shows when it is clicked.
 *
 * Visible to every signed-in account: the chart is public, because the shape of
 * an org chart is not the data in it. What the node *contains* is shaped by the
 * caller's authority -- full detail inside their own subtree, names only
 * outside it, and people-without-reporting for the IT admin. See
 * orgNodeDetailLevel.
 *
 * The level is resolved here and passed down rather than returned as a flag,
 * because the response shape genuinely differs: a node the caller may not open
 * carries no plans at all, so there is nothing for the client to leak.
 */
officeRouter.get("/:id/overview", async (req, res) => {
  const scope = await resolveActor(req.user!.userId, req.user!.role);
  // Express 5 types a param as string | string[]; these helpers want a scalar.
  res.json(await nodeOverview(scope, req.params.id as string));
});

/**
 * Where can this node move to? A dry run that names the heads who would gain
 * or lose scope, so the confirmation can state the consequence.
 */
officeRouter.get("/:id/move-options", async (req, res) => {
  const scope = await resolveActor(req.user!.userId, req.user!.role);
  if (!scope.isSuperAdmin) {
    throw new AppError("Only the hierarchy head may restructure the organization.", 403);
  }
  const newParentId = typeof req.query.parentId === "string" ? req.query.parentId : null;
  res.json(await previewMove(req.params.id as string, newParentId));
});

officeRouter.post("/:id/move", requireRole("MAIN_ADMIN"), async (req, res) => {
  const { parentId } = req.body ?? {};
  const newParentId = parentId === undefined ? null : (parentId as string | null);
  const moved = await moveNode(
    { userId: req.user!.userId, role: req.user!.role },
    req.params.id as string,
    newParentId,
  );
  res.json(moved);
});

// Only MAIN_ADMIN can modify offices.
officeRouter.post("/", requireRole("MAIN_ADMIN"), officeController.create);

officeRouter.patch("/:id", requireRole("MAIN_ADMIN"), officeController.update);

officeRouter.post(
  "/:id/archive",
  requireRole("MAIN_ADMIN"),
  officeController.archive,
);

officeRouter.post(
  "/:id/unarchive",
  requireRole("MAIN_ADMIN"),
  officeController.unarchive,
);
