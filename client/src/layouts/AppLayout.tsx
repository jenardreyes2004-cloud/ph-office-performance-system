import { NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/offices", label: "Offices" },
  { to: "/employees", label: "Employees" },
  { to: "/plans", label: "Plans" },
  { to: "/performance", label: "Performance" },
  { to: "/reports", label: "Reports" },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r bg-card p-4 flex flex-col gap-1">
        <div className="px-2 pb-4">
          <p className="font-semibold text-sm">OPMPS</p>
          <p className="text-xs text-muted-foreground">
            Office Performance Monitoring
          </p>
        </div>
        {NAV_ITEMS.map((item) => (
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
          <p className="px-2 text-xs text-muted-foreground truncate">
            {user?.name} · {user?.role}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1"
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
