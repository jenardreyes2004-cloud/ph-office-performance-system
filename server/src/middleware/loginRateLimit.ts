import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";

import { isTestRun } from "@/config/env";
import { logAuthEvent } from "@/middleware/systemLog";

/**
 * Login rate limiting.
 *
 * Credential spraying was *detected* by securityAlert.service and never
 * *blocked*, so an attacker had unlimited attempts against every account they
 * could name. Detection alone does not slow anyone down.
 *
 * Two limiters, because either alone is trivially defeated:
 *
 *  - per IP, so one host cannot grind through a list of accounts;
 *  - per email, so a botnet cannot concentrate on one account from many hosts.
 *
 * A limited attempt is still written to the system log as a `login_failure` with
 * reason "rate limited". That is deliberate: the alerting scan reads those rows,
 * and if blocked attempts were silent then the alerting would go blind exactly
 * when an attack is under way -- the one time it matters.
 *
 * Rate limiting is never a substitute for a strong password or MFA, but it
 * raises the cost of guessing enough that it is worth having.
 */

const WINDOW_MINUTES = 15;

/**
 * Per *account*: targeted guessing at one login.
 *
 * Ten failed attempts at one account in a quarter of an hour is either a very
 * forgetful person or someone guessing. Either way the account is at risk.
 */
const MAX_ATTEMPTS_PER_EMAIL = 10;

/**
 * Per *address*: spraying, i.e. one host walking a list of accounts.
 *
 * Deliberately three times the per-account budget. This is the knob with a real
 * cost either way:
 *
 *  - Equal to the per-account limit and the IP limiter dominates: ten failed
 *    attempts from one address locks out every *other* account from that
 *    address. Behind a corporate NAT or proxy every employee shares one IP, so
 *    that is a self-inflicted denial of service rather than a defence.
 *  - Very high, and spraying becomes unlimited again.
 *
 * Thirty keeps the shared-address case survivable while still bounding a host
 * walking the roster. If this is ever deployed behind a genuinely large shared
 * egress address, raise this rather than lowering it.
 */
const MAX_ATTEMPTS_PER_IP = MAX_ATTEMPTS_PER_EMAIL * 3;

/** Shared so both limiters report the same reset time. */
const windowMs = WINDOW_MINUTES * 60 * 1000;

function skip() {
  // The check suites deliberately provoke repeated sign-ins to prove the
  // alerting works, and they run many logins in a burst. Without this they
  // would fail for the wrong reason.
  //
  // Keyed on NODE_ENV, never on a request header: a bypass flag in the request
  // would be an unauthenticated way to remove the limit.
  return isTestRun;
}

function refused(req: Request, res: Response) {
  logAuthEvent("login_failure", req, { reason: "rate limited" });
  res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
}

const shared: Partial<Options> = {
  windowMs,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  // Only *failed* attempts count.
  //
  // Without this the per-IP limiter is a denial of service waiting to happen:
  // everyone behind one corporate NAT or proxy shares an IP, so ten successful
  // sign-ins in fifteen minutes from a shared address would lock out everyone
  // the building. Guessing is what this defends against, and guessing fails --
  // so only failures need to consume the budget.
  skipSuccessfulRequests: true,
};

/** Per source address. Catches one host sweeping many accounts. */
export const loginLimiterByIp = rateLimit({ ...shared, limit: MAX_ATTEMPTS_PER_IP, handler: refused });

/**
 * Per account named in the request.
 *
 * Keyed on the submitted email rather than the session, because the session
 * does not exist yet -- this is the unauthenticated path.
 */
export const loginLimiterByEmail = rateLimit({
  ...shared,
  limit: MAX_ATTEMPTS_PER_EMAIL,
  keyGenerator: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" ? email.trim().toLowerCase() : ipKeyGenerator(req.ip ?? "");
  },
  // Only count a genuine attempt. A body with no email is malformed, and
  // letting those consume the budget would let an attacker lock a real user out
  // by submitting empty requests.
  handler: refused,
});

/** Exposed for the check suite so it can assert the configured numbers. */
export const LOGIN_RATE_LIMIT = {
  windowMinutes: WINDOW_MINUTES,
  maxAttemptsPerEmail: MAX_ATTEMPTS_PER_EMAIL,
    maxAttemptsPerIp: MAX_ATTEMPTS_PER_IP,
};