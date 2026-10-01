import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useItOpsOverview, useSecurityScan } from "@/features/itOps/hooks";
import type { SystemLogLevel } from "@/types";
import { cn } from "@/lib/utils";

const LEVELS: SystemLogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];

const LEVEL_TONE: Record<SystemLogLevel, "outline" | "secondary" | "warning" | "destructive"> = {
  DEBUG: "outline",
  INFO: "secondary",
  WARN: "warning",
  ERROR: "destructive",
  CRITICAL: "destructive",
};

function uptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            // nowrap: a figure split across two lines reads as two numbers,
            // and makes one card in the row taller than its neighbours.
            "text-2xl font-semibold mt-1 tabular-nums whitespace-nowrap",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-amber-600"
          )}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * The IT admin's dashboard.
 *
 * Ordered by what an operator asks in order: is it up, is it healthy, is
 * anyone attacking it, and what do I do about it. Org metrics are deliberately
 * absent — this role has no authority over projects or people, so showing
 * office and scorecard counts here would be noise at best.
 */
export function ItOpsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useItOpsOverview();
  const scan = useSecurityScan();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading system status…</p>;
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Could not load the system overview. Is the API running?
          </p>
        </CardContent>
      </Card>
    );
  }

  const healthy = data.status === "ok";
  const errorRate = data.log.errorRatePct;
  const logTotal = Math.max(data.log.totalLogged, 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner — the single answer to "is it broken?" */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          healthy
            ? "border-emerald-600/40 bg-emerald-600/5"
            : "border-destructive/40 bg-destructive/5"
        )}
      >
        {healthy ? (
          <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-emerald-600" />
        ) : (
          <AlertTriangle className="size-5 shrink-0 mt-0.5 text-destructive" />
        )}
        <div className="flex-1">
          <p className="font-medium">
            {healthy ? "All systems operational" : "System degraded"}
          </p>
          <p className="text-sm text-muted-foreground">
            Database {data.database.ok ? "reachable" : "unreachable"}
            {data.database.latencyMs !== null && ` in ${data.database.latencyMs}ms`} ·{" "}
            {data.migrations.failed === 0
              ? "migration history clean"
              : `${data.migrations.failed} failed migration(s)`}{" "}
            · up {uptime(data.uptimeSeconds)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric
          label="Error rate"
          value={`${errorRate}%`}
          hint={`${data.log.errorsAndCritical24h} error${data.log.errorsAndCritical24h === 1 ? "" : "s"} in ${data.log.windowHours}h`}
          tone={errorRate > 5 ? "bad" : errorRate > 0 ? "warn" : "good"}
        />
        <Metric
          label="Failed sign-ins"
          value={data.security.failedLogins24h}
          hint={`${data.security.lastHour} in the last hour`}
          tone={data.security.failedLogins24h > 20 ? "bad" : data.security.failedLogins24h > 0 ? "warn" : "good"}
        />
        <Metric
          label="Accounts"
          value={data.accounts.total}
          hint={
            data.accounts.deactivated > 0
              ? `${data.accounts.deactivated} deactivated`
              : "all active"
          }
        />
        <Metric
          label="Memory"
          // Whole megabytes: tenths of a MB is false precision on a figure an
          // operator only compares against a ceiling.
          value={`${Math.round(data.process.rssMb)} MB`}
          hint={`heap ${Math.round(data.process.heapUsedMb)} MB · ${data.process.nodeVersion}`}
        />
      </div>

      {/* Log volume — a proportional bar reads faster than five numbers. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System log volume</CardTitle>
          <CardDescription>
            Last {data.log.windowHours} hours. Successful routine reads are only
            recorded in development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {LEVELS.map((lvl) => {
              const count = data.log.counts[lvl] ?? 0;
              if (count === 0) return null;
              const pct = (count / logTotal) * 100;
              return (
                <div
                  key={lvl}
                  className={cn(
                    "h-full",
                    lvl === "CRITICAL" || lvl === "ERROR"
                      ? "bg-destructive"
                      : lvl === "WARN"
                        ? "bg-amber-500"
                        : lvl === "INFO"
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                  )}
                  style={{ width: `${pct}%` }}
                  title={`${lvl}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {LEVELS.map((lvl) => (
              <span key={lvl} className="flex items-center gap-1.5 text-xs">
                <Badge variant={LEVEL_TONE[lvl]} className="text-[10px]">
                  {lvl}
                </Badge>
                <span className="tabular-nums">{data.log.counts[lvl] ?? 0}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4" />
                  Sign-in activity
                </CardTitle>
                <CardDescription>
                  Alerts fire at {data.security.thresholds.repeatedFailures} repeats
                  on one account or {data.security.thresholds.spray} accounts
                  from one IP, within{" "}
                  {data.security.thresholds.windowMinutes} minutes.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={scan.isPending}
                onClick={() => scan.mutate()}
              >
                {scan.isPending ? "Scanning…" : "Scan now"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scan.isSuccess && (
              <div className="mb-3 rounded-md border border-border/60 p-3">
                <p className="text-sm">
                  {scan.data.adminsNotified > 0
                    ? `${scan.data.adminsNotified} alert(s) sent.`
                    : "No alerts. Nothing met the thresholds."}
                </p>
                {scan.data.repeatedFailures.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Repeated:{" "}
                    {scan.data.repeatedFailures
                      .map((r) => `${r.email} (${r.count})`)
                      .join(", ")}
                  </p>
                )}
                {scan.data.spray.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Spray:{" "}
                    {scan.data.spray
                      .map((s) => `${s.ip} (${s.distinctEmails} accounts)`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            {data.security.topFailingIps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No failed sign-ins recorded in the last {data.log.windowHours} hours.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.security.topFailingIps.map((row) => (
                    <tr key={row.ip} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 font-mono text-xs">{row.ip}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                        {row.attempts} failed
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Slow requests — the second most common reason to call an IT admin */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" />
              Slowest requests
            </CardTitle>
            <CardDescription>
              Anything over 2 seconds in the last {data.log.windowHours} hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.slowRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing over 2 seconds. Good.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.slowRequests.map((r, i) => (
                    <tr key={`${r.path}-${i}`} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 font-mono text-xs">
                        {r.method} {r.path}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                        {r.durationMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts by role</CardTitle>
            <CardDescription>
              Live count. Manage these under Accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5">
              {Object.entries(data.accounts.byRole).map(([role, count]) => (
                <li key={role} className="flex items-center justify-between text-sm">
                  <span>{role.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Migration state</CardTitle>
            <CardDescription>Most recent applied migrations.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.migrations.latest.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No migration history available.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.migrations.latest.map((m) => (
                  <li key={m.name} className="text-xs">
                    <p className="font-mono">{m.name}</p>
                    <p className="text-muted-foreground">
                      applied {new Date(m.appliedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Governance changes are in the{" "}
        <Link to="/audit-log" className="underline">
          audit log
        </Link>
        ; raw events are in the{" "}
        <Link to="/system-log" className="underline">
          system log
        </Link>
        .
      </p>
    </div>
  );
}
