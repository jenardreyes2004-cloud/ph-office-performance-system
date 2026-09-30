import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Only used by `prisma migrate diff` to replay existing migrations into a
    // throwaway database and work out the delta. Never a real data store.
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
