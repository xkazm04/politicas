import { checkSharedToken } from "./token";

/**
 * The /admin gate verdict, decided over plain values.
 *
 * Why this is not in `app/admin/accessGate.ts` where the rest of the gate lives:
 * the verdict used to be computed inline beside `await cookies()`, and
 * `cookies()` throws outside a request scope. That made three of the four
 * verdicts unreachable from the unit lane — measured, not assumed: a probe
 * importing `readAdminGate` reached `not-configured` (which returns before the
 * cookie read) and threw on the other three. The branches were never hard; the
 * runtime was simply not there to call them.
 *
 * So the cookie jar is mirrored down to the one string this decision actually
 * reads, and every branch is taken here. `accessGate.ts` keeps the request-scoped
 * read and takes no verdict branch of its own.
 */

/** Everything the verdict depends on, as values a test can construct. */
export type AdminGateInput = {
  /** `ADMIN_TOKEN` for this environment; undefined or blank means unconfigured. */
  expected: string | undefined;
  /** The value of the admin cookie on this request, if one was sent at all. */
  submitted: string | undefined;
};

/**
 * `not-configured` — ADMIN_TOKEN unset in this environment: DENY and say so.
 * `locked` — configured, but this browser has not identified yet (first visit).
 * `unauthorized` — a token was presented and it does not match.
 */
export type AdminGateStatus = "ok" | "not-configured" | "locked" | "unauthorized";

/**
 * Fails closed: the only route to "ok" is a configured ADMIN_TOKEN plus a
 * submitted value that matches it constant-time.
 */
export function decideAdminGate({ expected, submitted }: AdminGateInput): AdminGateStatus {
  if (!expected?.trim()) return "not-configured";
  // No cookie at all is a locked door, not a failed attempt — the two must not
  // render the same message, or a first-time operator is told they typed the
  // token wrong when they never typed one.
  if (!submitted) return "locked";
  return checkSharedToken(submitted, expected) === "ok" ? "ok" : "unauthorized";
}
