import { NavLink, Outlet } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermission } from "@/features/auth/usePermission";
import { NAV_GROUPS } from "@/lib/navigation";
import { ACCESS_LEVEL_LABELS, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * The sidebar is grouped rather than a flat list. Four spines — Structure, Work,
 * Results, System — so it is always obvious whether a screen is describing the
 * organisation or describing work. Groups with nothing visible are dropped
 * entirely rather than left as an empty heading.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { canAny } = usePermission();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAny(item.anyOf)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-4 border-b">
          <p className="font-semibold text-sm">OPMPS</p>
          <p className="text-xs text-muted-foreground">
            Office Performance Monitoring
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group, index) => (
            <div key={group.title} className={cn(index > 0 && "mt-4")}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground truncate">{user?.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {/* Level first: it is what actually governs what this person can
                do, so it is the label they should recognise themselves by. */}
            {user?.accessLevel && (
              <Badge className="text-[10px]">
                {ACCESS_LEVEL_LABELS[user.accessLevel]}
              </Badge>
            )}
            {user && (
              <Badge variant="outline" className="text-[10px]">
                {ROLE_LABELS[user.role]}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2"
            onClick={logout}
          >
            Log out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
