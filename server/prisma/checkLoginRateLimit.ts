import "dotenv/config";

import { spawn } from "node:child_process";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Proves login rate limiting actually blocks, over real HTTP.
 *
 * Cannot run against the shared check server: that one is started with
 * NODE_ENV=test, which is precisely the mode that disables the limiter, so
 * probing it would prove nothing. So this suite starts its own short-lived
 * server on a spare port with NODE_ENV=development -- where the limiter *is*
 * enforced -- probes it, and shuts it down.
 *
 * The limiter is in-memory and per-process, so a dedicated instance also means
 * this suite cannot leave counters behind that would break the next run.
 *
 * Run: npx tsx prisma/checkLoginRateLimit.ts
 */

const PORT = 4010;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "Test@1234";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const failures: string[] = [];
const runStartedAt = new Date(Date.now() - 5_000);

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failures.push(label);
  }
}

function sleep(ms: number) {
  // Synchronous: this runs before/after the server handle exists and a
  // timer-based wait inside the harness is awkward. At these durations a spin
  // wait is fine and keeps the suite single-threaded and predictable.
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* spin */
  }
}

async function login(email: string, password = "wrong-password") {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, retryAfter: res.headers.get("retry-after") };
}

async function startServer(): Promise<import("node:child_process").ChildProcess> {
  const child = spawn(
    process.execPath,
    [
      "-r",
      "tsx",
      "src/server.ts",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "development", PORT: String(PORT) },
      stdio: "ignore",
    },
  );

  // Wait for it to answer rather than sleeping a fixed amount.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    sleep(500);
  }
  child.kill();
  throw new Error(`server on ${PORT} did not become ready`);
}

async function main() {
  console.log("Login rate limiting — over real HTTP, on a dedicated dev-mode server\n");

  const server = await startServer();
  console.log(`  server up on ${PORT} (NODE_ENV=development, limiter active)\n`);

  try {
    // -----------------------------------------------------------------
    console.log("per-email limit blocks a single account");
    // -----------------------------------------------------------------
    const victim = "rate.limit.probe@test.local";
    let sawRateLimited = false;
    let sawRetryAfter = false;
    let attempts = 0;

    for (let i = 0; i < 14; i++) {
      attempts++;
      const r = await login(victim);
      if (r.status === 429) {
        sawRateLimited = true;
        if (r.retryAfter) sawRetryAfter = true;
        break;
      }
    }
    check(
      `repeated attempts on one account are eventually blocked (after ${attempts})`,
      sawRateLimited,
    );
    check("the 429 carries Retry-After", sawRetryAfter);

    // The correct password must not get in either -- the limiter runs before
    // the credential check, so a locked account stays locked.
    const correctButLocked = await login(victim, PASSWORD);
    check(
      "a correct password does not bypass the limit",
      correctButLocked.status === 429,
      `got ${correctButLocked.status}`,
    );

    // -----------------------------------------------------------------
    console.log("\nthe per-account limit does not cause collateral lockout");
    // -----------------------------------------------------------------
    // The case that matters in production: everyone behind one office NAT
    // shares an IP. If one person is being attacked, the others must keep
    // working. The per-IP budget is deliberately higher than the per-account
    // one for exactly this reason.
    const other = await login("another.account@test.local");
    check(
      "an unrelated account is not blocked by someone else's limit",
      other.status === 401,
      `got ${other.status} (401 = still evaluated, 429 = collateral lockout)`,
    );

    const good = await login("it.admin@test.local", PASSWORD);
    check("a genuine account can still sign in", good.status === 200, `got ${good.status}`);

    // -----------------------------------------------------------------
    console.log("\nbut spraying many accounts from one host is still bounded");
    // -----------------------------------------------------------------
    // The other half of the trade-off: if the per-IP budget were unbounded,
    // an attacker could walk the entire roster at will.
    let sprayed = 0;
    let sprayBlocked = false;
    for (let i = 0; i < 40; i++) {
      sprayed++;
      const r = await login(`spray.target.${i}@test.local`);
      if (r.status === 429) {
        sprayBlocked = true;
        break;
      }
    }
    check(
      `spraying across accounts from one address is blocked (after ${sprayed})`,
      sprayBlocked,
      "one host walked the whole roster unchallenged",
    );

    // -----------------------------------------------------------------
    console.log("\nblocked attempts are still audited by the alerting scan");
    // -----------------------------------------------------------------
    // This is the part that is easy to get wrong and expensive to lose: if
    // blocked attempts were silent, alerting would go blind exactly when an
    // attack is under way.
    await sleep(800);
    const rows = await prisma.systemLog.findMany({
      where: { category: "auth", message: "login_failure", createdAt: { gte: runStartedAt } },
      select: { context: true },
    });
    const rateLimited = rows.filter(
      (r) => JSON.stringify(r.context ?? {}).includes("rate limited"),
    ).length;
    check(
      `rate-limited attempts were written to the system log (${rateLimited})`,
      rateLimited > 0,
      "alerting would be blind during an attack",
    );

    // -----------------------------------------------------------------
    console.log("\ncleanup");
    // -----------------------------------------------------------------
    // This suite made the server write auth log rows. Left behind, they
    // accumulate into a genuine repeated-failure signature and check:alerting
    // later reports an attack that never happened -- one suite poisoning
    // another. Removed for the same reason the alerting check cleans up.
    await prisma.systemLog.deleteMany({
      where: { category: "auth", createdAt: { gte: runStartedAt } },
    });
    await prisma.systemLog.deleteMany({
      where: { category: "security", createdAt: { gte: runStartedAt } },
    });
    await prisma.notification.deleteMany({
      where: {
        createdAt: { gte: runStartedAt },
        OR: [
          { message: { contains: "failed sign-in attempts" } },
          { message: { contains: "credential stuffing" } },
        ],
      },
    });

    const leftover = await prisma.systemLog.count({
      where: { createdAt: { gte: runStartedAt }, OR: [{ category: "auth" }, { category: "security" }] },
    });
    check("no auth or security log rows left behind", leftover === 0, `${leftover} remain`);

    const alerts = await prisma.notification.count({
      where: {
        createdAt: { gte: runStartedAt },
        OR: [
          { message: { contains: "failed sign-in attempts" } },
          { message: { contains: "credential stuffing" } },
        ],
      },
    });
    check("no security alerts left in any inbox", alerts === 0, `${alerts} remain`);
  } finally {
    server.kill();
  }

  console.log("");
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Login rate limiting blocks as intended and still reports.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });