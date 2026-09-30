import type { NextFunction, Request, Response } from "express";

import { systemLogService } from "@/services/systemLog.service";

/**
 * Records every completed HTTP request to the system log.
 *
 * Deliberately not the audit log: "GET /api/plans returned 200 in 12ms" is an
 * operational fact, not a governance event, and putting it in the audit trail
 * would bury the handful of rows that actually matter there.
 *
 * 5xx and 4xx are recorded at WARN or ERROR; ordinary successes at INFO and
 * are dropped unless DEBUG is enabled, so the table does not fill with routine
 * reads. `GET /api/health` is never logged — a health check every few seconds
 * is noise, and would swamp everything else.
 */
export function requestLogger(level: "INFO" | "DEBUG" = "INFO") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health" || req.path === "/api/health") return next();

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const status = res.statusCode;

      let severity: "DEBUG" | "INFO" | "WARN" | "ERROR" = "DEBUG";
      if (status >= 500) severity = "ERROR";
      else if (status >= 400) severity = "WARN";
      else severity = level;

      // A slow request is worth knowing about even though it succeeded.
      const slow = durationMs > 2000;

      if (severity === "DEBUG" && !slow) return;

      systemLogService.writeDetached({
        level: slow && severity !== "ERROR" ? "WARN" : severity,
        category: "http",
        message: slow
          ? `${req.method} ${req.originalUrl} took ${Math.round(durationMs)}ms`
          : `${req.method} ${req.originalUrl} ${status}`,
        userId: req.user?.userId ?? null,
        method: req.method,
        path: req.originalUrl,
        status,
        durationMs: Math.round(durationMs),
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
        context: slow ? { thresholdMs: 2000 } : null,
      });
    });

    next();
  };
}

/** Records authentication outcomes, successful and failed. */
export function logAuthEvent(
  outcome: "login_success" | "login_failure" | "logout" | "unauthorized",
  req: Request,
  detail: { userId?: string | null; email?: string | null; reason?: string } = {},
) {
  systemLogService.writeDetached({
    level: outcome === "login_success" || outcome === "logout" ? "INFO" : "WARN",
    category: "auth",
    message: outcome,
    userId: detail.userId ?? req.user?.userId ?? null,
    method: req.method,
    path: req.originalUrl,
    status: req.res?.statusCode ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    // The email is kept for correlating a brute-force attempt across
    // accounts; the password is never touched.
    context: { email: detail.email ?? null, reason: detail.reason ?? null },
  });
}
