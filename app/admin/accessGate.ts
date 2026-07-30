import "server-only";
import { cookies } from "next/headers";
import { checkSharedToken } from "@/lib/security/token";

/**
 * Access gate for /admin — the operator console (case-loop run status, money
 * leads, the human-review queue, pipeline health). Read-only, but it is internal
 * state, and `robots: { index: false }` is not access control: it asks crawlers
 * to look away, it does not stop anyone who types the path.
 *
 * Why a PAGE-LEVEL gate and not a Next proxy (`middleware.ts` is deprecated and
 * renamed to `proxy.ts` in Next 16 — node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/proxy.md):
 *  1. A proxy is documented as a network-boundary layer that may be deployed to
 *     a CDN and "should not rely on shared modules" — exactly the drift risk the
 *     shared `checkSharedToken` helper exists to prevent.
 *  2. A proxy can rewrite/redirect/return a bare response; it cannot render the
 *     honest Czech explanation this doctrine requires (an unconfigured console
 *     must SAY it is unconfigured, not 404 into silence).
 *  3. The gate must sit in front of `getAdminData()`, which is where the data
 *     actually leaves the store. Gating at the render boundary means the query
 *     never runs unless the verdict is "ok" — no proxy-bypass path can reach it.
 *
 * Colocated in app/admin/ rather than features/admin/ on purpose: this is route
 * access control, not a feature surface. It is not a route file (only page /
 * layout / route names are routed), so it stays private to this segment.
 */

/** Session cookie carrying the operator's token. Scoped to /admin so it is never
 *  sent on any public request. httpOnly — no script may read it back. */
export const ADMIN_COOKIE = "politicas_admin";

/** 12 hours — one working session; a forgotten open tab is not a standing grant. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * `not-configured` — ADMIN_TOKEN unset in this environment: DENY and say so.
 * `locked` — configured, but this browser has not identified yet (first visit).
 * `unauthorized` — a token was presented and it does not match.
 */
export type AdminGateStatus = "ok" | "not-configured" | "locked" | "unauthorized";

/**
 * The verdict for the current request. Fails closed: the only route to "ok" is a
 * configured ADMIN_TOKEN plus a cookie whose value matches it constant-time.
 * Reading cookies also opts the route out of static prerendering, so the console
 * is never baked into a build artifact.
 */
export async function readAdminGate(): Promise<AdminGateStatus> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected?.trim()) return "not-configured";
  const submitted = (await cookies()).get(ADMIN_COOKIE)?.value;
  // No cookie at all is a locked door, not a failed attempt — the two must not
  // render the same message, or a first-time operator is told they typed the
  // token wrong when they never typed one.
  if (!submitted) return "locked";
  return checkSharedToken(submitted, expected) === "ok" ? "ok" : "unauthorized";
}
