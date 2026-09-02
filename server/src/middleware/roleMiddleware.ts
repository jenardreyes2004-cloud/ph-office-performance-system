import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "@/lib/jwt";

type Role = JwtPayload["role"];

/**
 * Usage: router.get("/admin-only", authenticate, requireRole("MAIN_ADMIN", "IT_ADMIN"), handler)
 * Must run AFTER `authenticate` so req.user is populated.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }

    next();
  };
}
