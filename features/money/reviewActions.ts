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
// which must match REVIEWER_TOKEN exactly. If REVIEWER_TOKEN is not configured
// at all, the action returns a DISTINCT "not-configured" result so the console
// can render an honest still-read-only state instead of pretending to write.
//
// Follows the shape/simplicity of the repo's one existing server action,
// lib/i18n/locale.ts.

import { getStore } from "@/lib/db/store";
import type { ReviewDecision } from "./reviewTypes";

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
  const reviewerToken = process.env.REVIEWER_TOKEN?.trim();

  // Write path not configured at all — honest distinct state, never a generic error.
  if (!reviewerToken) {
    return { status: "not-configured" };
  }
  if (!input.token || input.token !== reviewerToken) {
    return { status: "unauthorized" };
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
    return { status: "ok", reviewState: result.reviewState, reviewer };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "unknown error" };
  }
}
