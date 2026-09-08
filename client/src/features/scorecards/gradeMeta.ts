import type { ScorecardGrade, ScorecardPerspective } from "@/features/scorecards/types";

export const PERSPECTIVE_LABELS: Record<ScorecardPerspective, string> = {
  DELIGHTED_CLIENTS: "Delighted Clients",
  EXCELLENT_PROCESS: "Excellent Process",
  SUSTAINABLE_FUND: "Sustainable Fund",
  STRONG_FOUNDATION: "Strong Foundation",
};

export const PERSPECTIVE_ORDER: ScorecardPerspective[] = [
  "DELIGHTED_CLIENTS",
  "EXCELLENT_PROCESS",
  "SUSTAINABLE_FUND",
  "STRONG_FOUNDATION",
];

export const GRADE_LABELS: Record<ScorecardGrade, string> = {
  OUTSTANDING: "Outstanding (O)",
  VERY_SATISFACTORY: "Very Satisfactory (VS)",
  SATISFACTORY: "Satisfactory (S)",
  UNSATISFACTORY: "Unsatisfactory (US)",
  POOR: "Poor (P)",
};

export const GRADE_SHORT: Record<ScorecardGrade, string> = {
  OUTSTANDING: "O",
  VERY_SATISFACTORY: "VS",
  SATISFACTORY: "S",
  UNSATISFACTORY: "US",
  POOR: "P",
};

export const GRADE_ORDER: ScorecardGrade[] = [
  "OUTSTANDING",
  "VERY_SATISFACTORY",
  "SATISFACTORY",
  "UNSATISFACTORY",
  "POOR",
];

export const GRADE_BADGE_VARIANT: Record<
  ScorecardGrade,
  "success" | "default" | "secondary" | "warning" | "destructive"
> = {
  OUTSTANDING: "success",
  VERY_SATISFACTORY: "default",
  SATISFACTORY: "secondary",
  UNSATISFACTORY: "warning",
  POOR: "destructive",
};

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isNaN(n) ? null : n;
}
