import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermission } from "@/features/auth/usePermission";
import { NAV_ITEMS } from "@/lib/navigation";
import { PERMISSION_GROUPS, ROLE_LABELS, ROLE_SUMMARIES } from "@/lib/permissions";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>;
}

/**
 * The dashboard has no stats API yet, so instead of fake numbers it does the
 * two things it can do accurately: show who you are, and list exactly the
 * sections your role can open.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { role, granted, canAny } = usePermission();

  if (!user || !role) return null;

  // Filter by permission exactly like the sidebar does — otherwise this grid
  // would advertise sections the signed-in role cannot open.
  const items = NAV_ITEMS.filter(
    (item) => item.to !== "/dashboard" && canAny(item.anyOf),
  );

  const managedPermissions = PERMISSION_GROUPS.filter((g) =>
    g.title !== "Read-only views",
  )
    .flatMap((g) => g.permissions)
    .filter((p) => granted.includes(p.permission));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Welcome back, {user.name}</h1>
          <Badge>{ROLE_LABELS[role]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {ROLE_SUMMARIES[role]}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Your sections</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
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
