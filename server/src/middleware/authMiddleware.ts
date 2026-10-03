import type { Request, Response, NextFunction } from "express";

import { prisma } from "@/prisma/client";
import { logAuthEvent } from "@/middleware/systemLog";
import { verifyToken, type JwtPayload } from "@/lib/jwt";

// Extend Express's Request type so `req.user` is typed everywhere it's used.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the token, then confirms the account is still usable.
 *
 * The token proves who signed in. It does not prove they still may. A JWT is
 * self-contained and valid for up to 8 hours, so before this second lookup a
 * deactivated employee kept every permission the role claim in their token
 * granted, and a demoted MAIN_ADMIN stayed a MAIN_ADMIN until it expired.
 * `requireRole` reads `req.user.role`, which is why that mattered: the gate
 * itself trusted a value that could no longer be true.
 *
 * So the role is re-read from the row on every authenticated request and
 * overwrites the token's claim. Deactivation and demotion therefore take
 * effect on the caller's next request rather than up to 8 hours later.
 *
 * Cost is one primary-key read per request, which is the cheapest lookup
 * available and buys correctness. No cache: it would have to be invalidated
 * on every role and active change in this process, and an account changed by
 * another instance would sit in a stale entry until it expired -- recreating
 * the bug in a harder-to-see form. Correctness first.
 *
 * Express 5 forwards a rejected promise from async middleware to the error
 * handler, so the database failure below is surfaced rather than swallowed.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const account = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, isActive: true, email: true },
  });

  if (!account) {
    logAuthEvent("unauthorized", req, {
      userId: payload.userId,
      email: payload.email,
      reason: "account removed",
    });
    return res.status(401).json({ error: "Not authenticated." });
  }

  if (!account.isActive) {
    logAuthEvent("unauthorized", req, {
      userId: account.id,
      email: account.email,
      reason: "account deactivated",
    });
    return res.status(401).json({ error: "Not authenticated." });
  }

  // The role from the row wins over the role in the token.
  req.user = { userId: account.id, role: account.role, email: account.email };
  next();
}