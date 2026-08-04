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
import { pspIdFromNodeId } from "./moneyLoader";
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
  /** The write path is configured but the operator is not identifiable — a
   *  MISCONFIGURATION, kept distinct from every other failure so the console can say
   *  what to fix instead of showing a generic error. */
  | { status: "misconfigured"; message: string }
  /** A reversal of an already-decided tie arrived without a reason. */
  | { status: "reason-required" }
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
  // FAIL CLOSED ON ANONYMITY (2026-08-04). This used to fall back to the literal string
  // "reviewer" when REVIEWER_NAME was unset, so every operator's decision entered the
  // tamper-evident hash chain under one indistinguishable identity — a chain that cannot
  // say WHO decided is a log, not an audit. The row is never written now; the console
  // reports a misconfiguration instead, and the chain gains no anonymous row.
  if (!reviewerName) {
    return {
      status: "misconfigured",
      message: "REVIEWER_NAME není nastavené — rozhodnutí by do auditní stopy vstoupilo bez jména.",
    };
  }

  try {
    const store = await getStore();
    if (!store) return { status: "error", message: "store unavailable" };

    const reviewer = reviewerName;
    const result = await store.setTieReviewState(
      input.src,
      input.dst,
      input.decision,
      reviewer,
      input.note,
    );
    if (!result.ok) {
      if (result.error === "tie not found") return { status: "not-found" };
      // The repository is the only place that knows the tie's PRIOR state, so the
      // reversal-needs-a-reason rule lives there; map it to its own status rather than
      // burying it in a generic error string.
      if (result.error === "reversal requires a note") return { status: "reason-required" };
      return { status: "error", message: result.error };
    }
    // D4 (batch 004): without this the confirmed/rejected tie stays visible in the
    // pending queue until a manual reload, inviting harmless-but-audit-polluting
    // double-decisions on the same tie. Best-effort: the write already succeeded, so a
    // revalidation failure (e.g. called outside a Next request scope, as in a unit
    // test) must not turn an honest success into a reported error.
    //
    // The MP's own surfaces are revalidated too (2026-08-04): `features/money/packet.ts`
    // compiles ONLY `reviewState === "verified"` ties, so a confirmation or a reversal
    // that stopped at /penize/kontrola left the evidence packet asserting a stale set of
    // human-verified ties — the one artifact built to be quoted elsewhere.
    const pspId = pspIdFromNodeId(input.src);
    const paths = [
      "/penize/kontrola",
      "/penize",
      // /dukazy is the PUBLIC bulletin of gate decisions — it reads `review_audit`, the
      // very table this action appends to, so a decision that did not revalidate it left
      // the one page built to announce the decision serving the state before it.
      "/dukazy",
      ...(pspId != null ? [`/penize/${pspId}`, `/penize/${pspId}/paket`] : []),
    ];
    for (const p of paths) {
      try {
        revalidatePath(p);
      } catch (err) {
        console.warn(`[submitReviewDecision] revalidatePath(${p}) failed; write still succeeded`, err);
      }
    }
    return { status: "ok", reviewState: result.reviewState, reviewer };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "unknown error" };
  }
}
