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

/**`r`n * Entity name for a nested route.
 *
 * The first segment alone collapses every scorecard operation into
 * "scorecards", so "who changed this entry?" and "who deleted that band?" were
 * indistinguishable in the trail. The sub-resource is appended when the route
 * addresses one: "/scorecards/entries/x" -> "scorecards/entries".
 */
function entityWithSubResource(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const apiAt = parts.indexOf("api");
  const index = apiAt >= 0 ? apiAt + 1 : 0;
  const head = parts[index] ?? "unknown";
  const next = parts[index + 1];
  // A collection or an id -- not a sub-resource to disambiguate.
  if (!next || next === "tree" || looksLikeId(next)) return head;
  return `${head}/${next}`;
}

function looksLikeId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

/**
 * The id a mutating request acted on, and its parent when the route is nested.
 *
 * Read from the URL path rather than `req.params`, and that is the whole fix:
 * this middleware is mounted with `app.use("/api", auditLog)`, which runs
 * *before* any router has matched, so `req.params` is still empty at this
 * point. Every previous attempt to read an id param from here therefore read
 * `undefined` and wrote null, on every route.
 *
 * A UUID-shaped segment is an id, and the path segment order matches the route
 * order, so the last one is the record actually being modified and the one
 * before it is its parent. That holds for every shape in the API, including
 * `/scorecards/office-scorecards/:id/entries/:entryId` -> entity is the entry,
 * parent is the scorecard.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idContext(path: string): { entityId: string | null; parentId: string | null } {
  const parts = path.split("/").filter(Boolean);
  const apiAt = parts.indexOf("api");
  const from = apiAt >= 0 ? apiAt + 1 : 0;

  const ids: string[] = [];
  for (const part of parts.slice(from)) {
    if (UUID.test(part)) ids.push(part);
  }

  if (ids.length === 0) return { entityId: null, parentId: null };
  return {
    entityId: ids[ids.length - 1],
    parentId: ids.length >= 2 ? ids[ids.length - 2] : null,
  };
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

export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method)) return next();

  // Captured now, not inside the finish handler: by the time the response
  // completes Express has restored req.url, and req.path no longer points at
  // the route that ran.
  const method = req.method;
  const path = req.originalUrl.split("?")[0];
  const entity = entityWithSubResource(path);
  const action = actionFor(method, path, entity);
  const { entityId, parentId } = idContext(path);

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
            entityId,
            metadata: {
              status: res.statusCode,
              method,
              // A nested route's parent id, so "everything under this
              // scorecard" is answerable. An id, never a value.
              ...(parentId ? { parentId } : {}),
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
