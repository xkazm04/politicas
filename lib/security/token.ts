import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared-token gate — the ONE place the platform compares a secret.
 *
 * Two surfaces stand behind an operator token: the money write path
 * (`features/money/reviewActions.ts`, `REVIEWER_TOKEN`) and the operator console
 * (`app/admin/accessGate.ts`, `ADMIN_TOKEN`). They used to be one implementation
 * and one copy waiting to happen; both now call `checkSharedToken` so the
 * comparison AND the fail-closed semantics cannot drift apart.
 *
 * Server-only on purpose: `node:crypto` and the expected value must never be
 * reachable from a client bundle. (`server-only` throws outside a React Server
 * environment; vitest aliases it to a stub — see vitest.config.ts.)
 */

/**
 * Constant-time token comparison. Plain `!==` on secrets is not constant-time —
 * V8 short-circuits at the first mismatched character, letting a caller who can
 * repeat the request measure response latency to recover the token one character
 * at a time. Hash both sides to a fixed length first so even the length of the
 * raw input never leaks through timing either (`timingSafeEqual` throws on
 * length mismatch, so unequal-length inputs could not be compared at all).
 */
export function tokensMatch(submitted: string, expected: string): boolean {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The gate verdict. `not-configured` is deliberately DISTINCT from
 * `unauthorized`: an unset token means the surface was never wired in this
 * environment, and the honesty doctrine says a surface must state that plainly
 * rather than pretend to be either open or under attack. Both are denials —
 * there is no verdict in which a missing token grants access.
 */
export type TokenGate = "ok" | "not-configured" | "unauthorized";

/**
 * Decide a shared-token gate. FAILS CLOSED in every branch: no expected token
 * configured → `not-configured` (deny + say so), nothing submitted or a
 * mismatch → `unauthorized`. Both sides are trimmed because operators paste
 * tokens and a trailing newline is not an authorization decision.
 */
export function checkSharedToken(
  submitted: string | null | undefined,
  expected: string | null | undefined,
): TokenGate {
  const want = expected?.trim();
  if (!want) return "not-configured";
  const got = submitted?.trim();
  // Empty submission: nothing to compare, and short-circuiting here leaks
  // nothing about the expected value (its presence is already public in the UI).
  if (!got) return "unauthorized";
  return tokensMatch(got, want) ? "ok" : "unauthorized";
}
