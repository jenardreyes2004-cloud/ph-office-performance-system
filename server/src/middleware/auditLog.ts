import type { NextFunction, Request, Response } from "express";

import { prisma } from "@/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Writes an AuditLog row for every successful mutating request.
 *
 * Done as middleware rather than per-controller calls so that a new route
 * cannot be added without an audit trail: anything added to a router after
 * this middleware is covered automatically.
 *
 * Deliberately records *shape* rather than values — the field names a request
 * touched, never their contents. Performance scores and plan descriptions are
 * the payload of this system; a log that copied request bodies would turn the
 * audit table into a second, unprotected copy of the same sensitive data.
 */

// Request fields that must never reach the log, in any nesting depth.
const REDACTED = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "authorization",
]);

function safeKeys(value: unknown, depth = 0): Prisma.InputJsonValue {
  if (depth > 2) return "[truncated]";
  // A marker string rather than JSON null: only field names are recorded, so
  // the distinction between null and "absent" carries no meaning here, and
  // InputJsonValue (unlike the nullable Prisma wrapper) has no null member.
  if (value === null || value === undefined) return "[null]";
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return typeof value;

  const out: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED.has(key.toLowerCase()) ? "[redacted]" : safeKeys(val, depth + 1);
  }
  return out;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// First path segment after /api is the resource, e.g. "/api/plans/abc" -> "plans".
function entityFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const apiAt = parts.indexOf("api");
  const index = apiAt >= 0 ? apiAt + 1 : 0;
  return parts[index] ?? "unknown";
}

function actionFor(method: string, path: string, entity: string): string {
  switch (method) {
    case "POST": {
      // /archive and /finalize are state transitions worth naming.
      const last = path.split("/").filter(Boolean).pop() ?? "";
      if (/^(archive|unarchive|deactivate|reactivate|finalize|mark-all-read)$/.test(last)) {
        return `${last.toUpperCase()} ${entity}`;
      }
      return `CREATE ${entity}`;
    }
    case "PATCH":
    case "PUT":
      return `UPDATE ${entity}`;
    case "DELETE":
      return `DELETE ${entity}`;
    default:
      return `${method} ${entity}`;
  }
}

function toId(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method)) return next();

  // Captured now, not inside the finish handler: by the time the response
  // completes Express has restored req.url, and req.path no longer points at
  // the route that ran.
  const method = req.method;
  const path = req.originalUrl.split("?")[0];
  const entity = entityFromPath(path);
  const action = actionFor(method, path, entity);

  res.on("finish", () => {
    // Only successful changes are worth an audit row; a 4xx changed nothing.
    if (res.statusCode >= 400) return;

    // The request body is deliberately not read here. express.json() has
    // already consumed the stream, and re-reading it would hang. Recording is
    // best-effort: a logging failure must never surface as a request failure,
    // so it runs detached and swallows its own errors.
    void (async () => {
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.user?.userId ?? null,
            action,
            entity,
            // Express 5 types a param as string | string[]; audit wants a scalar.
            entityId: toId(req.params?.id ?? req.params?.periodId),
            metadata: {
              status: res.statusCode,
              method,
              fields: safeKeys(req.body),
            },
          },
        });
      } catch {
        // Intentionally ignored — see above.
      }
    })();
  });

  next();
}
