import { Navigate, Outlet, useLocation } from "react-router-dom";

import { usePermission } from "@/features/auth/usePermission";
import type { Permission } from "@/lib/permissions";

interface RequirePermissionProps {
  /** The user needs at least one of these. */
  anyOf: readonly Permission[];
}

/**
 * Route-level permission gate. Renders the route only when the signed-in
 * user holds one of the listed permissions, otherwise redirects to the
 * dashboard. A user who cannot see a nav item also cannot reach its URL
 * directly.
 */
export function RequirePermission({ anyOf }: RequirePermissionProps) {
  const { isLoading, canAny } = usePermission();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!canAny(anyOf)) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
