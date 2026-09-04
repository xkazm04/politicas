import "server-only";
import { cookies } from "next/headers";
import { decideAdminGate, type AdminGateStatus } from "@/lib/security/adminGate";

export type { AdminGateStatus };

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
 * The verdict for the current request. Reading cookies also opts the route out of
 * static prerendering, so the console is never baked into a build artifact.
 *
 * This function is the request-scoped READ and nothing else. It takes no verdict
 * branch: `decideAdminGate` in lib/security/adminGate.ts owns all four, over
 * plain values, where the unit lane can reach them — `cookies()` throws outside a
 * request scope, and while the verdict lived here three of its four branches had
 * no caller that could exist in a test.
 *
 * The one branch below is not a verdict. It skips the cookie read when the console
 * is unconfigured, because the original did and the verdict cannot depend on it;
 * removing it would newly opt an unconfigured /admin out of prerendering.
 */
export async function readAdminGate(): Promise<AdminGateStatus> {
  const expected = process.env.ADMIN_TOKEN;
  const submitted = expected?.trim() ? (await cookies()).get(ADMIN_COOKIE)?.value : undefined;
  return decideAdminGate({ expected, submitted });
}
