import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSystemLog, useSystemLogSummary } from "@/features/systemLog/hooks";
import type { SystemLogLevel } from "@/types";

const LEVEL_TONE: Record<SystemLogLevel, "outline" | "secondary" | "warning" | "destructive"> = {
  DEBUG: "outline",
  INFO: "secondary",
  WARN: "warning",
  ERROR: "destructive",
  CRITICAL: "destructive",
};

const LEVELS: SystemLogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * The IT admin's operational view. Distinct from the audit log on purpose:
 * that one answers "who changed what", this one answers "is the system
 * healthy and who is hitting it".
 */
export function SystemLogPage() {
  const [level, setLevel] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const { data: entries, isLoading, isError } = useSystemLog(
    (level || undefined) as SystemLogLevel | undefined,
    category || undefined,
  );
  const { data: summary } = useSystemLogSummary(24);

  const total = summary
    ? Object.values(summary.counts).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">System Log</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Server-side activity: sign-ins, failed requests, slow queries,
          unmatched routes and unhandled errors. Governance changes are in the
          audit log instead.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {LEVELS.map((lvl) => (
            <Card key={lvl}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{lvl}</p>
                <p className="text-2xl font-semibold mt-1">
                  {summary.counts[lvl] ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {summary && total > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.categories.map((c) => (
            <Badge
              key={c.category}
              variant={category === c.category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory(category === c.category ? "" : c.category)}
            >
              {c.category}: {c._count._all}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((lvl) => (
              <SelectItem key={lvl} value={lvl}>
                {lvl}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(level || category) && (
          <span className="text-xs text-muted-foreground">
            Filtering{level ? ` level=${level}` : ""}
            {level && category ? " and" : ""}
            {category ? ` category=${category}` : ""}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading system log…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load the system log.
            </p>
          )}
          {entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded for this filter.
            </p>
          )}

          {entries && entries.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {when(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEVEL_TONE[e.level]} className="text-[10px]">
                        {e.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium">{e.message}</p>
                      {e.path && (
                        <p className="text-muted-foreground font-mono text-[10px]">
                          {e.method} {e.path}
                          {e.status ? ` → ${e.status}` : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.user?.name ?? "—"}
                      {e.ip && <span className="block text-[10px]">{e.ip}</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {e.durationMs !== null ? `${e.durationMs}ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
