import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const FALLBACK_JWT_SECRET = "dev-only-change-me";

const nodeEnv = requireEnv("NODE_ENV", "development");
const jwtSecret = requireEnv("JWT_SECRET", FALLBACK_JWT_SECRET);

/**
 * Refuse to boot in production with a secret that is either the development
 * fallback or too short to be worth signing with.
 *
 * The fallback existed so a developer could clone and run without configuring
 * anything, which is worth having. The risk is that the fallback reaches a
 * deployed environment: JWTs are self-contained, so anyone holding the fallback
 * can mint a token for any user with any role, and a per-request account check
 * cannot help because the row it reads would legitimately say the attacker is a
 * MAIN_ADMIN. The only place that can be caught is startup.
 *
 * Deliberately a crash rather than a warning. A process that starts with a
 * guessable signing key is not in a working state, and continuing would mean
 * serving authenticated traffic signed with a value that is published in the
 * repository.
 */
if (nodeEnv === "production") {
  if (jwtSecret === FALLBACK_JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is still the development fallback. Refusing to start in production: " +
        "anyone could mint a token for any user.",
    );
  }
  if (jwtSecret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters in production (got ${jwtSecret.length}).`,
    );
  }
}

/**
 * True when the process is running under the check suites.
 *
 * Used only to switch off login rate limiting, which would otherwise make the
 * suites that deliberately provoke repeated sign-ins fail for the wrong reason.
 * Keyed on NODE_ENV rather than a request header so it cannot be set by a
 * caller: a bypass flag in a header would be an unauthenticated way to remove
 * the limit.
 */
export const isTestRun = nodeEnv === "test";

export const env = {
  nodeEnv,
  port: parseInt(requireEnv("PORT", "4000"), 10),
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/office_perf?schema=public"),
  jwtSecret,
  jwtExpiresIn: requireEnv("JWT_EXPIRES_IN", "8h"),
  corsOrigin: requireEnv("CORS_ORIGIN", "http://localhost:5173"),
};