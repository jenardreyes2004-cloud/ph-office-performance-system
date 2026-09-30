import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/features/auth/usePermission";
import { PERMISSION_GROUPS, ROLE_LABELS, ACCESS_LEVEL_LABELS } from "@/lib/permissions";

export function AccessPage() {
  const { role, level, granted } = usePermission();

  if (!role || !level) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">My Access</h1>
        <p className="text-sm text-muted-foreground">
          What your account can currently do. Anything not listed is hidden
          from your navigation and refused by the server.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {/* Level is the primary identity — it is what governs authority.
                The account role is shown as context, not as the headline. */}
            <Badge>{ACCESS_LEVEL_LABELS[level]}</Badge>
            <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
            <Badge variant="outline">{granted.length} permissions</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Your level comes from the unit you are responsible for. Two people
            with the same account role can sit at different levels, and see
            different things.
          </p>
        </CardContent>
      </Card>

      {PERMISSION_GROUPS.map((group) => {
        const entries = group.permissions.map((entry) => ({
          ...entry,
          has: granted.includes(entry.permission),
        }));
        const anyGranted = entries.some((e) => e.has);

        return (
          <Card key={group.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{group.title}</CardTitle>
              {!anyGranted && (
                <Badge variant="outline">None of this applies to you</Badge>
              )}
            </CardHeader>
            <CardContent>
              {anyGranted && (
                <ul className="flex flex-col gap-3">
                  {entries
                    .filter((e) => e.has)
                    .map((entry) => (
                      <li key={entry.permission} className="flex gap-2">
                        <Check className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                        <div>
                          <p className="text-sm font-medium">{entry.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.description}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              {anyGranted && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Show what you cannot do
                  </summary>
                  <ul className="flex flex-col gap-2 mt-2">
                    {entries
                      .filter((e) => !e.has)
                      .map((entry) => (
                        <li key={entry.permission} className="flex gap-2">
                          <Minus className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {entry.label}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {entry.description}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground max-w-2xl">
        Permissions are assigned by your role and are not editable from the
        interface. If something above looks wrong, ask a Main Administrator
        to review your account.
      </p>
    </div>
  );
}
