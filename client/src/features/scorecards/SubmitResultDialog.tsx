import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADE_LABELS } from "@/features/scorecards/gradeMeta";
import { useSubmitScorecardResult } from "@/features/scorecards/hooks";
import type { ScorecardEntry, ScorecardGrade } from "@/features/scorecards/types";

export function SubmitResultDialog({ entry }: { entry: ScorecardEntry }) {
  const [open, setOpen] = useState(false);
  const [rawResult, setRawResult] = useState(entry.result?.rawResult ?? "");
  const [resultPct, setResultPct] = useState(
    entry.result?.resultPct !== null && entry.result?.resultPct !== undefined
      ? String(entry.result.resultPct)
      : "",
  );
  const [grade, setGrade] = useState<ScorecardGrade | "">(entry.result?.grade ?? "");
  const submitResult = useSubmitScorecardResult(entry.officeScorecardId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await submitResult.mutateAsync({
        entryId: entry.id,
        input: {
          rawResult,
          resultPct: resultPct ? Number(resultPct) : undefined,
          grade: grade || undefined,
        },
      });
      setOpen(false);
    } catch {
      // error surfaced via submitResult.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {entry.result ? "Edit Result" : "Enter Result"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.measure}</DialogTitle>
          <DialogDescription>Target: {entry.performanceTarget}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Possible Scenarios (this measure's bands)</Label>
          <div className="flex flex-col gap-1 rounded-md border p-2 text-xs text-muted-foreground">
            {entry.bands.map((b) => (
              <div key={b.id} className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0">
                  {b.grade}
                </Badge>
                <span>{b.rawLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="raw-result">Performance Result (as reported)</Label>
            <Input
              id="raw-result"
              required
              placeholder='e.g. "36.6% (1.48M)"'
              value={rawResult}
              onChange={(e) => setRawResult(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result-pct">Result as % of target (optional)</Label>
            <Input
              id="result-pct"
              type="number"
              step="0.01"
              placeholder="e.g. 96.5"
              value={resultPct}
              onChange={(e) => setResultPct(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If this cleanly matches exactly one band above, the grade can be
              auto-suggested. Otherwise, pick the grade manually below.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grade">Grade</Label>
            <Select value={grade} onValueChange={(v) => setGrade(v as ScorecardGrade)}>
              <SelectTrigger id="grade">
                <SelectValue placeholder="Select a grade (or leave blank to auto-suggest)" />
              </SelectTrigger>
              <SelectContent>
                {entry.bands.map((b) => (
                  <SelectItem key={b.id} value={b.grade}>
                    {GRADE_LABELS[b.grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {submitResult.isError && (
            <p className="text-sm text-destructive">
              {(submitResult.error as { response?: { data?: { error?: string } } })
                ?.response?.data?.error ?? "Failed to save result."}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitResult.isPending}>
              {submitResult.isPending ? "Saving…" : "Save Result"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
