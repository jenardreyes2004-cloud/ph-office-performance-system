import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermission } from "@/features/auth/usePermission";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { NAV_GROUPS } from "@/lib/navigation";
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_SUMMARIES,
  PERMISSION_GROUPS,
  ROLE_LABELS,
} from "@/lib/permissions";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>;
}

function StatCard({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  to?: string;
}) {
  const body = (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
  return to ? <Link to={to} className="group">{body}</Link> : body;
}

/**
 * Every figure comes from GET /dashboard/stats, which the server scopes to the
 * caller's role and office. Nothing here is filtered client-side, so a role
 * cannot see a number it should not — the API simply never sends it.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { role, level, granted, canAny, can } = usePermission();
  const { data, isLoading, isError } = useDashboardStats();

  if (!user || !role || !level) return null;

  // Grouped exactly like the sidebar, so the dashboard reinforces the same
  // Structure / Work / Results / System split instead of repeating a flat list.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.to !== "/dashboard" && canAny(item.anyOf),
    ),
  })).filter((group) => group.items.length > 0);

  const managedPermissions = PERMISSION_GROUPS.filter((g) => g.title !== "Read-only views")
    .flatMap((g) => g.permissions)
    .filter((p) => granted.includes(p.permission));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Welcome back, {user.name}</h1>
          <Badge>{ACCESS_LEVEL_LABELS[level]}</Badge>
          <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {ACCESS_LEVEL_SUMMARIES[level]}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          The numbers below are already limited to what your level can see.
        </p>
      </div>

      {isError && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Could not load your summary. Is the backend running?
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading your summary…</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={can("offices.view") ? "Offices" : "Your office"}
              value={data.offices.active}
              hint={
                data.offices.active !== data.offices.total
                  ? `${data.offices.total} total`
                  : undefined
              }
              to={can("offices.view") ? "/offices" : undefined}
            />
            <StatCard label="Employees" value={data.employees} to={can("employees.view") ? "/employees" : undefined} />
            <StatCard
              label="Active plans"
              value={data.plans.active}
              hint={data.plans.total > data.plans.active ? `${data.plans.total} total` : undefined}
              to={can("plans.view") ? "/plans" : undefined}
            />
            <StatCard
              label={role === "EMPLOYEE" ? "My assignments" : "Assignments"}
              value={data.assignments.mine}
            />
          </div>

          {data.plans.delayed > 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">
                  {data.plans.delayed} plan{data.plans.delayed === 1 ? " is" : "s are"} behind
                  schedule and need attention.
                </p>
              </CardContent>
            </Card>
          )}

          {data.assignments.recent.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionTitle>
                {role === "EMPLOYEE" ? "Your recent tasks" : "Recently updated tasks"}
              </SectionTitle>
              <Card>
                <CardContent className="pt-6 flex flex-col gap-4">
                  {data.assignments.recent.map((a) => (
                    <div key={a.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          to={`/plans/${a.planId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {a.planTitle}
                        </Link>
                        <Badge variant="outline">{a.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <ProgressBar value={a.progressPct} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {can("scorecards.view") && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Draft scorecards" value={data.scorecards.draft} to="/reports" />
              <StatCard label="Finalized" value={data.scorecards.finalized} to="/reports" />
              <StatCard
                label="Performance records"
                value={data.performanceRecords}
                to={can("performance.view") ? "/performance-scores" : undefined}
              />
            </div>
          )}
        </>
      )}

      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <div>
            <SectionTitle>{group.title}</SectionTitle>
            <p className="text-xs text-muted-foreground">{group.blurb}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((item) => (
              <Link key={item.to} to={item.to} className="group">
                <Card className="h-full transition-colors group-hover:border-primary">
                  <CardHeader>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {managedPermissions.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionTitle>What you can change</SectionTitle>
          <Card>
            <CardContent className="pt-6">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {managedPermissions.map((permission) => (
                  <li key={permission.permission} className="flex items-center gap-2 text-sm">
                    <span className="size-1.5 rounded-full bg-emerald-600" />
                    {permission.label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                Everything else is read-only for you. The full breakdown is on
                the My Access page.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {managedPermissions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Your role is read-only — everything you can open is listed above,
              and nothing here can be edited from your account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
