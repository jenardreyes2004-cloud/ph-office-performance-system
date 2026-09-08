import { z } from "zod";

export const scorecardPerspectives = [
  "DELIGHTED_CLIENTS",
  "EXCELLENT_PROCESS",
  "SUSTAINABLE_FUND",
  "STRONG_FOUNDATION",
] as const;

export const scorecardGrades = [
  "OUTSTANDING",
  "VERY_SATISFACTORY",
  "SATISFACTORY",
  "UNSATISFACTORY",
  "POOR",
] as const;

// ----- Periods -----

export const createScorecardPeriodSchema = z.object({
  label: z.string().min(2).max(150),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type CreateScorecardPeriodInput = z.infer<typeof createScorecardPeriodSchema>;

// ----- Bands ("Possible Scenarios") -----

export const scorecardBandSchema = z
  .object({
    grade: z.enum(scorecardGrades),
    minPct: z.coerce.number().min(0).max(1000).optional(),
    maxPct: z.coerce.number().min(0).max(1000).optional(),
    rawLabel: z.string().min(2).max(500),
  })
  .refine((b) => b.minPct === undefined || b.maxPct === undefined || b.minPct <= b.maxPct, {
    message: "minPct cannot be greater than maxPct",
  });

export type ScorecardBandInput = z.infer<typeof scorecardBandSchema>;

// ----- Entries (rows of the scorecard) -----

export const createScorecardEntrySchema = z.object({
  perspective: z.enum(scorecardPerspectives),
  sortOrder: z.coerce.number().int().min(0).default(0),
  strategicObjective: z.string().min(2).max(500),
  responsibleUnit: z.string().max(300).optional(),
  measure: z.string().min(2).max(500),
  performanceTarget: z.string().min(1).max(300),
  weightPct: z.coerce.number().min(0).max(100),
  bands: z.array(scorecardBandSchema).min(1).max(10),
});

export const updateScorecardEntrySchema = createScorecardEntrySchema
  .omit({ bands: true })
  .partial();

export type CreateScorecardEntryInput = z.infer<typeof createScorecardEntrySchema>;
export type UpdateScorecardEntryInput = z.infer<typeof updateScorecardEntrySchema>;

export const replaceScorecardBandsSchema = z.object({
  bands: z.array(scorecardBandSchema).min(1).max(10),
});

export type ReplaceScorecardBandsInput = z.infer<typeof replaceScorecardBandsSchema>;

// ----- Office scorecards (the printable "document") -----

export const createOfficeScorecardSchema = z.object({
  entries: z.array(createScorecardEntrySchema).max(100).optional(),
});

export type CreateOfficeScorecardInput = z.infer<typeof createOfficeScorecardSchema>;

export const updateOfficeScorecardSchema = z.object({
  raterName: z.string().max(200).optional(),
  raterTitle: z.string().max(200).optional(),
  nextHigherSupervisorName: z.string().max(200).optional(),
  nextHigherSupervisorTitle: z.string().max(200).optional(),
});

export type UpdateOfficeScorecardInput = z.infer<typeof updateOfficeScorecardSchema>;

// ----- Results (actual accomplishment for one entry) -----

export const submitScorecardResultSchema = z.object({
  rawResult: z.string().min(1).max(300),
  resultPct: z.coerce.number().min(0).max(1000).optional(),
  // Required unless resultPct falls cleanly inside exactly one numeric band.
  grade: z.enum(scorecardGrades).optional(),
  notes: z.string().max(1000).optional(),
});

export type SubmitScorecardResultInput = z.infer<typeof submitScorecardResultSchema>;

export const overrideFinalScoreSchema = z.object({
  finalScore: z.coerce.number().min(0).max(1000),
  notes: z.string().max(1000).optional(),
});

export type OverrideFinalScoreInput = z.infer<typeof overrideFinalScoreSchema>;
