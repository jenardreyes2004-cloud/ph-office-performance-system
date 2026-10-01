import { z } from "zod";

/**
 * Input validation for account management.
 *
 * An account is a login credential plus a role -- distinct from an Employee,
 * which is a roster record. Keeping the two apart matters: an account can be
 * deactivated without removing anyone from the organization, and an employee
 * record can exist before a login is issued.
 */

/**
 * Password policy.
 *
 * Length is the rule that actually resists guessing, so it leads. The
 * complexity requirements are deliberately mild: rules that produce
 * "Passw0rd!" are satisfied by writing them on a sticky note next to the
 * keyboard. Ten characters with a letter and a digit is a floor, not a goal.
 */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200, "Password must be at most 200 characters.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

/**
 * Strict, so an unrecognised field is a 422 rather than being silently
 * dropped. Plain z.object() strips unknown keys, which turns
 * `PATCH /accounts/:id { "role": "MAIN_ADMIN" }` into a cheerful 200 that
 * changed nothing -- the caller believes they promoted somebody. Rejecting it
 * is the honest answer, and it is also what makes the guard's role field
 * unsmugglable through this endpoint.
 */
export const createAccountSchema = z.strictObject({
  name: z.string().min(2).max(200),
  email: z.string().email().max(320).toLowerCase(),
  password: passwordSchema,
  /**
   * Defaults to EMPLOYEE rather than requiring a role, so the common case --
   * issuing a plain login -- cannot accidentally grant more than intended.
   */
  role: z.enum(["MAIN_ADMIN", "OFFICE_ADMIN", "IT_ADMIN", "EMPLOYEE"]).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Nothing here changes authority directly.
 *
 * `role`, `isActive` and `headedOfficeId` are deliberately absent: those are
 * the fields the self-promotion guard exists to police, and accepting them on
 * a general-purpose update endpoint would make it the place people reach for
 * when they want more power. They are changed through the named,
 * individually-guarded endpoints below, so each one has its own reason code.
 */
export const updateAccountSchema = z.strictObject({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().max(320).toLowerCase().optional(),
  /**
   * Optional on update: leaving it out means "keep the current password". A
   * caller who wants to clear a password is not expressing an intent the
   * system should support.
   */
  password: passwordSchema.optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(["MAIN_ADMIN", "OFFICE_ADMIN", "IT_ADMIN", "EMPLOYEE"]),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type SetActiveInput = z.infer<typeof setActiveSchema>;