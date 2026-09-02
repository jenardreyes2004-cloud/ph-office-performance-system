import { Router } from "express";
import { login, logout, getCurrentUser } from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/authMiddleware";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, getCurrentUser);
