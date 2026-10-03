/**
 * Shared guard for the seed scripts.
 *
 * `seedAccessLevels.ts` creates accounts with the password `Test@1234`, which
 * is in the repository and therefore public. Against a development database
 * that is the point -- it makes the system usable immediately. Against anything
 * reachable, it is a set of pre-authenticated accounts including a
 * MAIN_ADMIN.
 *
 * There is no way to tell the two apart from inside the script, so the safe
 * assumption is the dangerous one: refuse unless the operator has said
 * explicitly that this is a throwaway database.
 */
export function assertSeedAllowedToRun(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const override = process.env.ALLOW_TEST_PASSWORD_SEED === "yes";

  if (nodeEnv === "production" && !override) {
    throw new Error(
      "Refusing to run a seed that creates accounts with the well-known password " +
        'Test@1234 against NODE_ENV=production.\n' +
        "Set ALLOW_TEST_PASSWORD_SEED=yes if this really is a throwaway database " +
        "you are about to destroy.",
    );
  }

  if (nodeEnv === "production" && override) {
    console.warn(
      "\n  ALLOW_TEST_PASSWORD_SEED=yes against NODE_ENV=production.\n" +
        "  These accounts are publicly known and MUST NOT survive deployment.\n",
    );
  }
}