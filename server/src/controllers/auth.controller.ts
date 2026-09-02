import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  res.cookie("token", token, COOKIE_OPTIONS);

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.status(200).json({ message: "Logged out." });
}

export async function getCurrentUser(req: Request, res: Response) {
  // `authenticate` middleware already verified the token and set req.user
  const userId = req.user?.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  return res.status(200).json({ user });
}
