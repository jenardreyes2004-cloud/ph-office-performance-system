import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "@/config/env";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { healthRouter } from "@/routes/health.routes";
import { officeRouter } from "@/routes/office.routes";
import { employeeRouter } from "@/routes/employee.routes";
import { planRouter } from "@/routes/plan.routes";
import { metricRouter } from "@/routes/metric.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  app.use("/api/health", healthRouter);
  app.use("/api/offices", officeRouter);
  app.use("/api/employees", employeeRouter);
  app.use("/api/plans", planRouter);
  app.use("/api/metrics", metricRouter);

  // Future routers get mounted here as modules are built:
  // app.use("/api/auth", authRouter);
  // ...

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
