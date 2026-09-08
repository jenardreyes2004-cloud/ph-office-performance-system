import type { Request, Response } from "express";

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
  async listOffices(req: Request<{ periodId: string }>, res: Response) {
    const offices = await scorecardPeriodService.listOfficesForPeriod(req.params.periodId);
    res.json(offices);
  },
};

export const officeScorecardController = {
  async getById(req: Request<{ id: string }>, res: Response) {
    const scorecard = await officeScorecardService.getById(req.params.id);
    res.json(scorecard);
  },

  async create(req: Request<{ periodId: string; officeId: string }>, res: Response) {
    const data = createOfficeScorecardSchema.parse(req.body ?? {});
    const scorecard = await officeScorecardService.create(
      req.params.officeId,
      req.params.periodId,
      data,
    );
    res.status(201).json(scorecard);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateOfficeScorecardSchema.parse(req.body);
    const scorecard = await officeScorecardService.update(req.params.id, data);
    res.json(scorecard);
  },

  async finalize(req: Request<{ id: string }>, res: Response) {
    const scorecard = await officeScorecardService.finalize(req.params.id, req.user!.userId);
    res.json(scorecard);
  },
};

export const scorecardEntryController = {
  async create(req: Request<{ officeScorecardId: string }>, res: Response) {
    const data = createScorecardEntrySchema.parse(req.body);
    const entry = await scorecardEntryService.addEntry(req.params.officeScorecardId, data);
    res.status(201).json(entry);
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const data = updateScorecardEntrySchema.parse(req.body);
    const entry = await scorecardEntryService.updateEntry(req.params.id, data);
    res.json(entry);
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    await scorecardEntryService.deleteEntry(req.params.id);
    res.status(204).send();
  },

  async replaceBands(req: Request<{ id: string }>, res: Response) {
    const data = replaceScorecardBandsSchema.parse(req.body);
    const entry = await scorecardEntryService.replaceBands(req.params.id, data);
    res.json(entry);
  },
};

export const scorecardResultController = {
  async submit(req: Request<{ entryId: string }>, res: Response) {
    const data = submitScorecardResultSchema.parse(req.body);
    const result = await scorecardResultService.submit(req.params.entryId, data);
    res.json(result);
  },

  async overrideFinalScore(req: Request<{ entryId: string }>, res: Response) {
    const data = overrideFinalScoreSchema.parse(req.body);
    const result = await scorecardResultService.overrideFinalScore(req.params.entryId, data);
    res.json(result);
  },
};
