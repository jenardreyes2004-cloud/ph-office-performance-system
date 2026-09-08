import { Router } from "express";

import {
  scorecardPeriodController,
  officeScorecardController,
  scorecardEntryController,
  scorecardResultController,
} from "@/controllers/scorecard.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { requireRole } from "@/middleware/roleMiddleware";

export const scorecardRouter = Router();

// All scorecard routes require authentication.
scorecardRouter.use(authenticate);

// ----- Periods (e.g. "CY 2025") -----

scorecardRouter.get("/periods", scorecardPeriodController.list);

scorecardRouter.post(
  "/periods",
  requireRole("MAIN_ADMIN"),
  scorecardPeriodController.create,
);

// Every office, plus its scorecard for this period if one exists — the
// "click into an office to see its report" list view.
scorecardRouter.get(
  "/periods/:periodId/offices",
  scorecardPeriodController.listOffices,
);

// Start a new office's scorecard for a period (optionally seeded with entries).
scorecardRouter.post(
  "/periods/:periodId/offices/:officeId",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  officeScorecardController.create,
);

// ----- Office scorecards (the printable report/document) -----

scorecardRouter.get("/office-scorecards/:id", officeScorecardController.getById);

scorecardRouter.patch(
  "/office-scorecards/:id",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  officeScorecardController.update,
);

scorecardRouter.post(
  "/office-scorecards/:id/finalize",
  requireRole("MAIN_ADMIN"),
  officeScorecardController.finalize,
);

// ----- Entries (rows on the scorecard) -----

scorecardRouter.post(
  "/office-scorecards/:officeScorecardId/entries",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  scorecardEntryController.create,
);

scorecardRouter.patch(
  "/entries/:id",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  scorecardEntryController.update,
);

scorecardRouter.delete(
  "/entries/:id",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  scorecardEntryController.remove,
);

scorecardRouter.put(
  "/entries/:id/bands",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  scorecardEntryController.replaceBands,
);

// ----- Results (actual accomplishment + grade for one entry) -----

scorecardRouter.put(
  "/entries/:entryId/result",
  requireRole("MAIN_ADMIN", "OFFICE_ADMIN"),
  scorecardResultController.submit,
);

scorecardRouter.patch(
  "/entries/:entryId/result/final-score",
  requireRole("MAIN_ADMIN"),
  scorecardResultController.overrideFinalScore,
);
