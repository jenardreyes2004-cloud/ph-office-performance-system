import { Router } from "express";
import { login, logout, getCurrentUser } from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/authMiddleware";
import { loginLimiterByEmail, loginLimiterByIp } from "@/middleware/loginRateLimit";

export const authRouter = Router();

// Both limiters run before the handler, so a blocked attempt never reaches the
// password comparison. Order is IP first: it is the cheaper key.
authRouter.post("/login", loginLimiterByIp, loginLimiterByEmail, login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, getCurrentUser);
