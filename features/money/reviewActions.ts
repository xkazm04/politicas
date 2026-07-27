"use server";

// Server action for the human-review write path on /penize/kontrola (Case ①
// FollowTheMoney). This is the FIRST write path on the platform: a human
// reviewer confirms/rejects/asks-for-more on a pending `linked_to` tie. It is a
// thin, honest gate in front of `ReviewRepository.setTieReviewState` (the ONLY
// code that ever writes `review_state`) — see lib/db/store.ts.
//
// Auth model (single-operator console, simplest correct choice for this
// batch): the server reads REVIEWER_NAME + REVIEWER_TOKEN from env. The client
// submits a token value (entered once in the console, see VerificationConsole)
// which must match REVIEWER_TOKEN — compared in constant time by the shared
// gate in lib/security/token.ts, the same one /admin uses. If REVIEWER_TOKEN is
// not configured at all, the action returns a DISTINCT "not-configured" result
// so the console can render an honest still-read-only state instead of
// pretending to write.
//
// Follows the shape/simplicity of the repo's one existing server action,
// lib/i18n/locale.ts.

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { checkSharedToken } from "@/lib/security/token";
import type { ReviewDecision } from "./reviewTypes";

const VALID_DECISIONS: readonly ReviewDecision[] = ["confirm", "reject", "needs-more"];

export interface SubmitReviewInput {
  src: string; // kg_edge.src, "psp:person:<pspId>"
  dst: string; // kg_edge.dst, "kg:company:<ico>" (whatever the tie's actual node id is)
  decision: ReviewDecision;
  note: string | null;
  /** Reviewer-submitted token, checked against process.env.REVIEWER_TOKEN. */
  token: string;
}

export type SubmitReviewResult =
  | { status: "ok"; reviewState: string; reviewer: string }
  | { status: "not-configured" }
  | { status: "unauthorized" }
  | { status: "not-found" }
  | { status: "error"; message: string };

export async function submitReviewDecision(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const reviewerName = process.env.REVIEWER_NAME?.trim();

  // Shared gate with /admin (lib/security/token.ts) — one constant-time
  // comparison, one fail-closed rule, so the two guarded surfaces cannot drift.
  // "not-configured" stays an honest DISTINCT state, never a generic error.
  const gate = checkSharedToken(input.token, process.env.REVIEWER_TOKEN);
  if (gate === "not-configured") return { status: "not-configured" };
  if (gate !== "ok") return { status: "unauthorized" };
  // D5 (batch 004): TS types erase at the server-action boundary, so a malformed
  // client payload could otherwise reach the store and pollute review_audit.decision
  // with an arbitrary string. Runtime whitelist, checked BEFORE any store call.
  if (!VALID_DECISIONS.includes(input.decision)) {
    return { status: "error", message: "invalid decision" };
  }

  try {
    const store = await getStore();
    if (!store) return { status: "error", message: "store unavailable" };

    const reviewer = reviewerName || "reviewer";
    const result = await store.setTieReviewState(
      input.src,
      input.dst,
      input.decision,
      reviewer,
      input.note,
    );
    if (!result.ok) {
      return result.error === "tie not found"
        ? { status: "not-found" }
        : { status: "error", message: result.error };
    }
    // D4 (batch 004): without this the confirmed/rejected tie stays visible in the
    // pending queue until a manual reload, inviting harmless-but-audit-polluting
    // double-decisions on the same tie. Best-effort: the write already succeeded, so a
    // revalidation failure (e.g. called outside a Next request scope, as in a unit
    // test) must not turn an honest success into a reported error.
    try {
      revalidatePath("/penize/kontrola");
    } catch (err) {
      console.warn("[submitReviewDecision] revalidatePath failed; write still succeeded", err);
    }
    return { status: "ok", reviewState: result.reviewState, reviewer };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "unknown error" };
  }
}
