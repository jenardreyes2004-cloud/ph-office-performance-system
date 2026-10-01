import type { NextFunction, Request, Response } from "express";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "@/config/env";
import { AppError, errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { auditLog } from "@/middleware/auditLog";
import { logAuthEvent, requestLogger } from "@/middleware/systemLog";
import { systemLogService } from "@/services/systemLog.service";
import { healthRouter } from "@/routes/health.routes";
import { officeRouter } from "@/routes/office.routes";
import { employeeRouter } from "@/routes/employee.routes";
import { planRouter } from "@/routes/plan.routes";
import { metricRouter } from "@/routes/metric.routes";
import { authRouter } from "@/routes/auth.routes";
import { performanceRecordRouter } from "@/routes/performanceRecord.routes";
import { monthlyUpdateRouter } from "@/routes/monthlyUpdate.routes";
import { notificationRouter } from "@/routes/notification.routes";
import { scorecardRouter } from "@/routes/scorecard.routes";
import { auditLogRouter } from "@/routes/auditLog.routes";
import { dashboardRouter } from "@/routes/dashboard.routes";
import { systemLogRouter } from "@/routes/systemLog.routes";
import { itOpsRouter } from "@/routes/itOps.routes";
import { accountRouter } from "@/routes/account.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  // Operational logging, mounted before the routers so it sees every request.
  // Development captures DEBUG (routine reads included) because that is what
  // you want while working; production would use INFO.
  app.use("/api", requestLogger(env.nodeEnv === "production" ? "INFO" : "DEBUG"));

  // Governance logging. Before the routers so every mutating route below is
  // covered; it reads req.user at response-finish time, by which point the
  // per-router `authenticate` middleware has populated it.
  app.use("/api", auditLog);

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/offices", officeRouter);
  app.use("/api/employees", employeeRouter);
  app.use("/api/plans", planRouter);
  app.use("/api/metrics", metricRouter);
  app.use("/api/performance-records", performanceRecordRouter);
  app.use("/api/monthly-updates", monthlyUpdateRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/scorecards", scorecardRouter);
  app.use("/api/audit-log", auditLogRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/system-log", systemLogRouter);
  app.use("/api/it-ops", itOpsRouter);
  app.use("/api/accounts", accountRouter);

  // An unmatched route is exactly the kind of thing the IT admin wants to see,
  // so it is logged rather than silently 404'd.
  app.use((req: Request, res: Response) => {
    notFoundHandler(req, res);
    systemLogService.writeDetached({
      level: "WARN",
      category: "routing",
      message: `No route for ${req.method} ${req.originalUrl}`,
      userId: req.user?.userId ?? null,
      method: req.method,
      path: req.originalUrl,
      status: 404,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    // errorHandler already deals with two classes of error deliberately:
    // AppError (an intentional 400/404/409) and ZodError (a 422 from a bad
    // request body). Both are the caller's problem and requestLogger has
    // already recorded them at WARN. Only anything else is a genuine server
    // incident, and only that earns CRITICAL with a stack trace.
    //
    // Getting this wrong is not cosmetic: treating every 422 as CRITICAL
    // buried the real signal under a wall of validation noise from ordinary
    // client mistakes.
    const isHandled = err instanceof AppError || err instanceof ZodError;

    if (!isHandled) {
      systemLogService.writeDetached({
        level: "CRITICAL",
        category: "unhandled",
        message: err instanceof Error ? err.message : String(err),
        userId: req.user?.userId ?? null,
        method: req.method,
        path: req.originalUrl,
        status: 500,
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
        context: {
          stack: err instanceof Error ? err.stack?.slice(0, 2000) : null,
        },
      });
    }

    errorHandler(err, req, res, next);
  });

  return app;
}
