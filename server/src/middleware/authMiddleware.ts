import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "@/lib/jwt";

// Extend Express's Request type so `req.user` is typed everywhere it's used.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
