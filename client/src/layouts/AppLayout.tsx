import { NavLink, Outlet } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermission } from "@/features/auth/usePermission";
import { NAV_ITEMS } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { user, logout } = useAuth();
  const { canAny } = usePermission();

  // Filter the menu rather than disabling entries: a section the user can
  // never open is just noise, and a visible-but-dead item is worse.
  const items = NAV_ITEMS.filter((item) => canAny(item.anyOf));

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r bg-card p-4 flex flex-col gap-1">
        <div className="px-2 pb-4">
          <p className="font-semibold text-sm">OPMPS</p>
          <p className="text-xs text-muted-foreground">
            Office Performance Monitoring
          </p>
        </div>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-4 border-t">
          <div className="px-2">
            <p className="text-xs text-muted-foreground truncate">{user?.name}</p>
            <Badge variant="secondary" className="mt-1">
              {user ? ROLE_LABELS[user.role] : ""}
            </Badge>
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
