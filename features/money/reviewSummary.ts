/*
 * WHAT THE HUMAN GATE HAS ACTUALLY DECIDED — one derived answer, not a literal.
 *
 * /penize carried two sentences hard-coded as facts: a banner under the lede saying
 * „Všechny vazby osoba ↔ firma čekají na lidskou kontrolu" and a graph footer badge
 * saying „● všechny hrany datované · čekají na kontrolu". Both were true when they were
 * written, because the review console could not yet write anything. Since the console
 * learned to record `verified` (and to REVERSE a decision), the first confirmed tie makes
 * both sentences false — on the surface whose entire promise is that a number never says
 * more than the data does. The counts were already computed in `getMoneyData`
 * (`verifiedTies` / `pendingTies`) and rendered NOWHERE.
 *
 * Pure module, no server and no DOM: the phase is a decision about copy, so it is
 * testable per state (`reviewSummary.test.ts`) rather than asserted by reading the page.
 *
 * The population is the ties whose review state RESOLVED — verified + pending + rejected.
 * `MoneyStats.totalTies` is a different number (every `linked_to` edge the layer read,
 * including ones dropped for an unresolved endpoint) and must not be used here: a banner
 * that says "0 of 211 confirmed" while the ledger shows 208 rows is the same class of
 * unreconcilable claim this file exists to remove.
 */

export type ReviewPhase = "empty" | "all-pending" | "mixed" | "all-decided";

export interface ReviewSummary {
  phase: ReviewPhase;
  verified: number;
  pending: number;
  rejected: number;
  /** verified + rejected — ties a human has ruled on, either way. */
  decided: number;
  /** verified + pending + rejected — the ties this page can speak for. */
  total: number;
}

export function reviewSummary(counts: {
  verified: number;
  pending: number;
  rejected: number;
}): ReviewSummary {
  const { verified, pending, rejected } = counts;
  const decided = verified + rejected;
  const total = decided + pending;
  const phase: ReviewPhase =
    total === 0 ? "empty" : pending === total ? "all-pending" : pending === 0 ? "all-decided" : "mixed";
  return { phase, verified, pending, rejected, decided, total };
}
