import type { Request, Response } from "express";

import { AppError } from "@/middleware/errorHandler";
import { canActOnScorecardOffice, resolveActor, scorecardOfficeIds, type ActorScope } from "@/lib/scope";
import { owningOfficeIdFor } from "@/services/scorecard.service";
import {
  scorecardPeriodService,
  officeScorecardService,
  scorecardEntryService,
  scorecardResultService,
} from "@/services/scorecard.service";
import {
  createScorecardPeriodSchema,
  createOfficeScorecardSchema,
  updateOfficeScorecardSchema,
  createScorecardEntrySchema,
  updateScorecardEntrySchema,
  replaceScorecardBandsSchema,
  submitScorecardResultSchema,
  overrideFinalScoreSchema,
} from "@/schemas/scorecard.schema";

/**
 * Scorecard controllers.
 *
 * Every entry point resolves the caller's scope and checks it. The routes gate
 * on role, and role is the wrong question: an OFFICE_ADMIN holds that role
 * whether they head an office in NCR or one in NCR South. Without these checks
 * any office admin could read, edit, band, submit and finalize every office's
 * scorecard in the system.
 *
 * Out of scope is a 404, never a 403, so the endpoint does not confirm that
 * another office's scorecard exists.
 */
async function scopeOf(req: Request): Promise<ActorScope> {
  return resolveActor(req.user!.userId, req.user!.role);
}

/** Throws 404 unless the caller may act on the scorecard/entry's office. */
async function assertOfficeInScope(
  scope: ActorScope,
  target: { officeScorecardId?: string; entryId?: string },
): Promise<void> {
  const officeId = await owningOfficeIdFor(target);
  // A missing row and an out-of-scope row are deliberately indistinguishable.
  if (!officeId || !canActOnScorecardOffice(scope, officeId)) {
    throw new AppError("Scorecard not found", 404);
  }
}

export const scorecardPeriodController = {
  async list(_req: Request, res: Response) {
    const periods = await scorecardPeriodService.list();
    res.json(periods);
  },

  async create(req: Request, res: Response) {
    const data = createScorecardPeriodSchema.parse(req.body);
    const period = await scorecardPeriodService.create(data);
    res.status(201).json(period);
  },

  // Every office plus its scorecard for this period, if one has been started.
  // Narrowed to the caller's own subtree.
  async listOffices(req: Request<{ periodId: string }>, res: Response) {
    const scope = await scopeOf(req);
    const offices = await scorecardPeriodService.listOfficesForPeriod(
      req.params.periodId,
      scorecardOfficeIds(scope),
    );
    res.json(offices);
  },
};

  export const officeScorecardController = {
  async create(req: Request<{ periodId: string; officeId: string }>, res: Response) {
    const scope = await scopeOf(req);
    if (!canActOnScorecardOffice(scope, req.params.officeId)) {
      throw new AppError("Scorecard not found", 404);
    }
    const data = createOfficeScorecardSchema.parse(req.body ?? {});
    const scorecard = await officeScorecardService.create(
      req.params.officeId,
      req.params.periodId,
      data,
    );
    res.status(201).json(scorecard);
  },

  async getById(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { officeScorecardId: req.params.id });
    res.json(await officeScorecardService.getById(req.params.id));
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { officeScorecardId: req.params.id });
    const data = updateOfficeScorecardSchema.parse(req.body);
    res.json(await officeScorecardService.update(req.params.id, data));
  },

  async finalize(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { officeScorecardId: req.params.id });
    res.json(await officeScorecardService.finalize(req.params.id, req.user!.userId));
  },
};

export const scorecardEntryController = {
  async create(req: Request<{ officeScorecardId: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { officeScorecardId: req.params.officeScorecardId });
    const data = createScorecardEntrySchema.parse(req.body);
    const entry = await scorecardEntryService.addEntry(req.params.officeScorecardId, data);
    res.status(201).json(entry);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { entryId: req.params.id });
    const data = updateScorecardEntrySchema.parse(req.body);
    res.json(await scorecardEntryService.updateEntry(req.params.id, data));
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { entryId: req.params.id });
    await scorecardEntryService.deleteEntry(req.params.id);
    res.status(204).send();
  },

  async replaceBands(req: Request<{ id: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { entryId: req.params.id });
    const data = replaceScorecardBandsSchema.parse(req.body);
    res.json(await scorecardEntryService.replaceBands(req.params.id, data));
  },
};

export const scorecardResultController = {
  async submit(req: Request<{ entryId: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { entryId: req.params.entryId });
    const data = submitScorecardResultSchema.parse(req.body);
    res.json(await scorecardResultService.submit(req.params.entryId, data));
  },

  async overrideFinalScore(req: Request<{ entryId: string }>, res: Response) {
    const scope = await scopeOf(req);
    await assertOfficeInScope(scope, { entryId: req.params.entryId });
    const data = overrideFinalScoreSchema.parse(req.body);
    res.json(await scorecardResultService.overrideFinalScore(req.params.entryId, data));
  },
};