import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "office-performance-system-api",
    timestamp: new Date().toISOString(),
  });
});
