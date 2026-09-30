import type { Request, Response } from "express";
import { logAuthEvent } from "@/middleware/systemLog";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { signToken } from "@/lib/jwt";
import { env } from "@/config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === "production", // only send over HTTPS in production
  sameSite: "lax" as const,
  maxAge: 8 * 60 * 60 * 1000, // 8 hours, keep in sync with JWT_EXPIRES_IN
};

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // accessLevel is read from the Employee row the user is linked to; it is not
  // on the User model, so fetch it alongside the account.
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      employee: { select: { accessLevel: true, headedOfficeId: true } },
    },
  });

  if (!user || !user.isActive) {
    // The reason is deliberately not distinguished to the caller, but the
    // system log records which of the two it was — an IT admin chasing a
    // locked account needs that, an attacker does not get it.
    logAuthEvent("login_failure", req, {
      email,
      reason: !user ? "unknown account" : "account deactivated",
    });
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    logAuthEvent("login_failure", req, { email, reason: "bad password" });
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  res.cookie("token", token, COOKIE_OPTIONS);

  logAuthEvent("login_success", req, { userId: user.id, email: user.email });

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessLevel: user.employee?.accessLevel ?? "EMPLOYEE",
      headedOfficeId: user.employee?.headedOfficeId ?? null,
    },
  });
}

export async function logout(req: Request, res: Response) {
  res.clearCookie("token", COOKIE_OPTIONS);
  logAuthEvent("logout", req, { userId: req.user?.userId ?? null });
  return res.status(200).json({ message: "Logged out." });
}

export async function getCurrentUser(req: Request, res: Response) {
  // `authenticate` middleware already verified the token and set req.user
  const userId = req.user?.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      employee: { select: { accessLevel: true, headedOfficeId: true } },
    },
  });

  if (!user || !user.isActive) {
    logAuthEvent("unauthorized", req, {
      userId,
      reason: "session no longer valid",
    });
    return res.status(401).json({ error: "Not authenticated." });
  }

  return res.status(200).json({
    user: {
      ...user,
      accessLevel: user.employee?.accessLevel ?? "EMPLOYEE",
      headedOfficeId: user.employee?.headedOfficeId ?? null,
    },
  });
}
