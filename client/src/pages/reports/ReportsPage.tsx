import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/AuthContext";
import { GRADE_BADGE_VARIANT, GRADE_SHORT, toNumber } from "@/features/scorecards/gradeMeta";
import { CreatePeriodDialog } from "@/features/scorecards/CreatePeriodDialog";
import {
  useOfficesForPeriod,
  useScorecardPeriods,
  useStartOfficeScorecard,
} from "@/features/scorecards/hooks";

export function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: periods, isLoading: periodsLoading } = useScorecardPeriods();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>(undefined);

  // Derive the active period during render instead of syncing it via an
  // effect: default to the first period until the user picks one explicitly.
  const periodId = selectedPeriodId ?? periods?.[0]?.id;

  const { data: offices, isLoading: officesLoading } = useOfficesForPeriod(periodId);
  const startScorecard = useStartOfficeScorecard(periodId ?? "");

  const canManagePeriods = user?.role === "MAIN_ADMIN";
  const canStartScorecard = user?.role === "MAIN_ADMIN" || user?.role === "OFFICE_ADMIN";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Office-level Balanced Scorecards. Pick a period, then click an office
            to view or print its report.
          </p>
        </div>
        {canManagePeriods && <CreatePeriodDialog />}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Period:</span>
        <Select value={periodId} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a scorecard period" />
          </SelectTrigger>
          <SelectContent>
            {periods?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {periodsLoading && (
        <p className="text-sm text-muted-foreground">Loading periods…</p>
      )}

      {!periodsLoading && (!periods || periods.length === 0) && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No scorecard periods yet.
              {canManagePeriods
                ? " Create one above to get started."
                : " Ask a MAIN_ADMIN to create one."}
            </p>
          </CardContent>
        </Card>
      )}

      {periodId && (
        <Card>
          <CardContent className="pt-6">
            {officesLoading && (
              <p className="text-sm text-muted-foreground">Loading offices…</p>
            )}
            {offices && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {offices.map((o) => {
                  const rating = o.scorecard?.officeRating;
                  const score = toNumber(o.scorecard?.totalScore);
                  return (
                    <Card
                      key={o.officeId}
                      className={
                        o.scorecard ? "cursor-pointer hover:border-primary transition-colors" : ""
                      }
                      onClick={() => {
                        if (o.scorecard) {
                          navigate(`/reports/office-scorecards/${o.scorecard.id}`);
                        }
                      }}
                    >
                      <CardContent className="pt-6 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{o.officeName}</p>
                            <p className="text-xs text-muted-foreground">{o.officeCode}</p>
                          </div>
                          {rating && (
                            <Badge variant={GRADE_BADGE_VARIANT[rating]}>
                              {GRADE_SHORT[rating]}
                            </Badge>
                          )}
                        </div>

                        {o.scorecard ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Status: {o.scorecard.status}
                              {score !== null ? ` · Score: ${score.toFixed(2)}` : ""}
                            </p>
                            <Button variant="ghost" size="sm" className="self-start px-0">
                              View report →
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">
                              No scorecard started for this period yet.
                            </p>
                            {canStartScorecard && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="self-start"
                                disabled={startScorecard.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startScorecard.mutate(o.officeId, {
                                    onSuccess: (created) =>
                                      navigate(`/reports/office-scorecards/${created.id}`),
                                  });
                                }}
                              >
                                Start Scorecard
                              </Button>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
