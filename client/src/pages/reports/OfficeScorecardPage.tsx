import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/AuthContext";
import {
  GRADE_BADGE_VARIANT,
  GRADE_SHORT,
  PERSPECTIVE_LABELS,
  PERSPECTIVE_ORDER,
  toNumber,
} from "@/features/scorecards/gradeMeta";
import {
  useFinalizeOfficeScorecard,
  useOfficeScorecard,
} from "@/features/scorecards/hooks";
import { SubmitResultDialog } from "@/features/scorecards/SubmitResultDialog";
import type { ScorecardEntry, ScorecardPerspective } from "@/features/scorecards/types";

export function OfficeScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: scorecard, isLoading, isError } = useOfficeScorecard(id);
  const finalize = useFinalizeOfficeScorecard(id ?? "");

  const canEdit =
    scorecard?.status === "DRAFT" &&
    (user?.role === "MAIN_ADMIN" || user?.role === "OFFICE_ADMIN");
  const canFinalize = scorecard?.status === "DRAFT" && user?.role === "MAIN_ADMIN";

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading report…</p>;
  }

  if (isError || !scorecard) {
    return <p className="text-sm text-destructive">Failed to load this report.</p>;
  }

  const entriesByPerspective = new Map<ScorecardPerspective, ScorecardEntry[]>();
  for (const perspective of PERSPECTIVE_ORDER) {
    entriesByPerspective.set(
      perspective,
      scorecard.entries.filter((e) => e.perspective === perspective),
    );
  }

  const totalWeight =
    toNumber(scorecard.totalWeight) ??
    scorecard.entries.reduce((sum, e) => sum + (toNumber(e.weightPct) ?? 0), 0);
  const totalScore =
    toNumber(scorecard.totalScore) ??
    scorecard.entries.reduce((sum, e) => {
      const score = toNumber(e.result?.finalScore) ?? toNumber(e.result?.initialScore) ?? 0;
      return sum + score;
    }, 0);

  return (
    <div className="flex flex-col gap-4 print-container">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">
            {scorecard.office.name} — {scorecard.period.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            Status: {scorecard.status}
            {scorecard.officeRating ? ` · Rating: ${scorecard.officeRating}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canFinalize && (
            <Button
              variant="outline"
              disabled={finalize.isPending}
              onClick={() => finalize.mutate()}
            >
              {finalize.isPending ? "Finalizing…" : "Finalize Scorecard"}
            </Button>
          )}
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {finalize.isError && (
        <p className="text-sm text-destructive no-print">
          {(finalize.error as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ?? "Failed to finalize — every measure needs a result first."}
        </p>
      )}

      <div className="print-header hidden print:block">
        <p className="text-xs uppercase tracking-wide">
          Office-Level Performance Scorecard
        </p>
        <h2 className="text-lg font-bold">
          {scorecard.office.name} — {scorecard.period.label}
        </h2>
      </div>

      {PERSPECTIVE_ORDER.map((perspective) => {
        const entries = entriesByPerspective.get(perspective) ?? [];
        if (entries.length === 0) return null;

        return (
          <Card key={perspective} className="print-avoid-break">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">{PERSPECTIVE_LABELS[perspective]}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategic Objective</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Measure</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right no-print">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const score =
                      toNumber(entry.result?.finalScore) ??
                      toNumber(entry.result?.initialScore);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="max-w-52 whitespace-pre-wrap text-sm">
                          {entry.strategicObjective}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {entry.responsibleUnit ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-pre-wrap text-sm">
                          {entry.measure}
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap">
                          {entry.performanceTarget}
                        </TableCell>
                        <TableCell className="text-right">
                          {toNumber(entry.weightPct)?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap">
                          {entry.result?.rawResult ?? (
                            <span className="text-muted-foreground">Not submitted</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.result?.grade ? (
                            <Badge variant={GRADE_BADGE_VARIANT[entry.result.grade]}>
                              {GRADE_SHORT[entry.result.grade]}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {score !== null ? score.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right no-print">
                          {canEdit && <SubmitResultDialog entry={entry} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <Card className="print-avoid-break">
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Weight</p>
            <p className="text-xl font-semibold">{totalWeight.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Score</p>
            <p className="text-xl font-semibold">{totalScore.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Office Adjectival Rating</p>
            <p className="text-xl font-semibold">
              {scorecard.officeRating ? (
                <Badge variant={GRADE_BADGE_VARIANT[scorecard.officeRating]}>
                  {scorecard.officeRating}
                </Badge>
              ) : (
                "Pending finalization"
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="print-avoid-break">
        <CardContent className="pt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Rater</p>
            <p className="font-medium">{scorecard.raterName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{scorecard.raterTitle ?? ""}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Next Higher Supervisor</p>
            <p className="font-medium">{scorecard.nextHigherSupervisorName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {scorecard.nextHigherSupervisorTitle ?? ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
