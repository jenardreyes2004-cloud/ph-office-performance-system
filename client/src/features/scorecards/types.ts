export type ScorecardPerspective =
  | "DELIGHTED_CLIENTS"
  | "EXCELLENT_PROCESS"
  | "SUSTAINABLE_FUND"
  | "STRONG_FOUNDATION";

export type ScorecardGrade =
  | "OUTSTANDING"
  | "VERY_SATISFACTORY"
  | "SATISFACTORY"
  | "UNSATISFACTORY"
  | "POOR";

export type OfficeScorecardStatus = "DRAFT" | "FINALIZED";

export interface ScorecardPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface OfficeForPeriod {
  officeId: string;
  officeName: string;
  officeCode: string;
  scorecard: {
    id: string;
    status: OfficeScorecardStatus;
    totalWeight: string | number | null;
    totalScore: string | number | null;
    officeRating: ScorecardGrade | null;
    finalizedAt: string | null;
  } | null;
}

export interface ScorecardBand {
  id: string;
  entryId: string;
  grade: ScorecardGrade;
  minPct: string | number | null;
  maxPct: string | number | null;
  rawLabel: string;
}

export interface ScorecardResult {
  id: string;
  entryId: string;
  rawResult: string;
  resultPct: string | number | null;
  grade: ScorecardGrade | null;
  isAutoGraded: boolean;
  initialScore: string | number | null;
  finalScore: string | number | null;
  notes: string | null;
  updatedAt: string;
}

export interface ScorecardEntry {
  id: string;
  officeScorecardId: string;
  perspective: ScorecardPerspective;
  sortOrder: number;
  strategicObjective: string;
  responsibleUnit: string | null;
  measure: string;
  performanceTarget: string;
  weightPct: string | number;
  bands: ScorecardBand[];
  result: ScorecardResult | null;
}

export interface OfficeScorecard {
  id: string;
  officeId: string;
  periodId: string;
  status: OfficeScorecardStatus;
  raterName: string | null;
  raterTitle: string | null;
  nextHigherSupervisorName: string | null;
  nextHigherSupervisorTitle: string | null;
  totalWeight: string | number | null;
  totalScore: string | number | null;
  officeRating: ScorecardGrade | null;
  finalizedAt: string | null;
  office: { id: string; name: string; code: string };
  period: ScorecardPeriod;
  finalizedBy: { id: string; name: string } | null;
  entries: ScorecardEntry[];
}

export interface CreateScorecardPeriodInput {
  label: string;
  startDate: string;
  endDate: string;
}

export interface SubmitScorecardResultInput {
  rawResult: string;
  resultPct?: number;
  grade?: ScorecardGrade;
  notes?: string;
}

export interface UpdateOfficeScorecardInput {
  raterName?: string;
  raterTitle?: string;
  nextHigherSupervisorName?: string;
  nextHigherSupervisorTitle?: string;
}
