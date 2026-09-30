import { useMemo } from "react";

import { useAuth } from "@/features/auth/AuthContext";
import {
  can as canForRole,
  canAny as canAnyForRole,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

/**
 * Permission checks for the signed-in user. Every value is false until
 * `isLoading` finishes and a user is present, so guard on `isLoading` (or
 * render nothing) rather than briefly flashing an unauthorized UI.
 */
export function usePermission() {
  const { user, isLoading } = useAuth();
  const role = user?.role;

  const granted = useMemo(() => (role ? ROLE_PERMISSIONS[role] : []), [role]);

  return {
    role,
    /** Hierarchy level, resolved server-side from the node this person heads. */
    level: user?.accessLevel ?? null,
    isLoading,
    granted,
    can: (permission: Permission) => canForRole(role, permission),
    canAny: (permissions: readonly Permission[]) => canAnyForRole(role, permissions),
  };
}
