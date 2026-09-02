import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: requireEnv("NODE_ENV", "development"),
  port: parseInt(requireEnv("PORT", "4000"), 10),
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/office_perf?schema=public"),
  jwtSecret: requireEnv("JWT_SECRET", "dev-only-change-me"),
  jwtExpiresIn: requireEnv("JWT_EXPIRES_IN", "8h"),
  corsOrigin: requireEnv("CORS_ORIGIN", "http://localhost:5173"),
};