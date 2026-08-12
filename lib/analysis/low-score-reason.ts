// Honest "low-score-reason" labels — Case ② build phase (batch 002, O-effort-2).
//
// The contribution index (lib/analysis/contribution.ts) is a fair measure of
// FLOOR ACTIVITY, but a young term means the bottom of the ranking is dominated
// by structural artifacts, not disengagement: an MP who relinquished the seat
// before taking the oath, a minister whose committee time is spent in cabinet,
// a replacement seated weeks ago, someone holding a second elected office. The
// effort loop's enrichment stage annotates these with a closed-vocabulary
// `effort_low_score_reason` prop (namespaced, pending_review, NEVER touching the
// score itself — see docs/case-loops.md guardrails). This module turns that
// prop into an honest, non-judgmental correcting badge the ranking and the
// profile can render, instead of letting a low number imply laziness.
//
// MESSAGE KEYS, NOT SENTENCES (2026-08-12). The copy used to be Czech string
// literals right here, and the product has a real English locale (cookie switch,
// lib/i18n/config.ts): an English reader got „Nastoupil(a) jako náhradník/-ce"
// glued to a translated date, i.e. one sentence in two languages. The module
// stays PURE — it returns the KEY of the sentence and the consumer calls
// `t(key)` on the `verdicts` namespace — which is the /overeni precedent
// (`verdictHeadlineKey`, `gateStatusInfo().labelKey`): the mapping itself
// becomes testable, and the Czech is pinned to the language gate where it now
// lives, in messages/cs.json.
//
// Pure + defensive: an unknown or missing reason renders nothing (graceful
// null), never a fabricated explanation.

export const LOW_SCORE_REASONS = [
  "minister",
  "deputy_pm",
  "prime_minister",
  "opposition_leader",
  "replacement",
  "new_mp",
  "dual_mandate",
  "genuine_absentee",
  "low_legislative_output",
  "declined_mandate",
  "institutional_promotion",
  "unknown",
] as const;

export type LowScoreReason = (typeof LOW_SCORE_REASONS)[number];

export function isLowScoreReason(x: unknown): x is LowScoreReason {
  return typeof x === "string" && (LOW_SCORE_REASONS as readonly string[]).includes(x);
}

export interface LowScoreReasonCopy {
  /** Message key of the short badge label — fits a single line next to the score. */
  badgeKey: string;
  /** Message key of the one-sentence honest explanation, rendered under the badge. */
  detailKey: string;
  /** Badge tone: "neutral" (structural, no implication) vs "positive" (an honest correction that reads well for the MP). */
  tone: "neutral" | "positive";
}

/** `declined_mandate` → `DeclinedMandate` — the key stem is DERIVED from the
 *  vocabulary, so a new reason cannot be added with a hand-typed key that
 *  matches nothing in the catalogs. */
function stem(reason: LowScoreReason): string {
  return reason
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Message key of a reason's badge label, inside the `verdicts` namespace. */
export function lowScoreBadgeKey(reason: LowScoreReason): string {
  return `lowScore${stem(reason)}Badge`;
}

/** Message key of a reason's explanation, inside the `verdicts` namespace. */
export function lowScoreDetailKey(reason: LowScoreReason): string {
  return `lowScore${stem(reason)}Detail`;
}

/**
 * Every key this module can emit — the /overeni contract (`VERDICT_COPY_KEYS`,
 * `GUIDE_COPY_KEYS`): a pure module that returns keys must publish the closed
 * set, so a messages test can assert both catalogs carry all of them.
 */
export const LOW_SCORE_COPY_KEYS: readonly string[] = LOW_SCORE_REASONS.flatMap((r) => [
  lowScoreBadgeKey(r),
  lowScoreDetailKey(r),
]);

/** Tone is NOT copy — it is the vocabulary's own judgement about the reason, and
 *  `genuine_absentee` is deliberately neutral: its sentence says in as many words
 *  that it is NOT a correction, so the chip must not colour it like one. */
const TONE: Record<LowScoreReason, LowScoreReasonCopy["tone"]> = {
  declined_mandate: "positive",
  replacement: "positive",
  institutional_promotion: "positive",
  dual_mandate: "neutral",
  prime_minister: "neutral",
  minister: "neutral",
  deputy_pm: "neutral",
  opposition_leader: "neutral",
  new_mp: "neutral",
  genuine_absentee: "neutral",
  low_legislative_output: "neutral",
  unknown: "neutral",
};

/** Look up the badge copy for a stored `effort_low_score_reason` value; null when absent/unrecognized. */
export function lowScoreReasonCopy(reason: unknown): LowScoreReasonCopy | null {
  if (!isLowScoreReason(reason)) return null;
  return {
    badgeKey: lowScoreBadgeKey(reason),
    detailKey: lowScoreDetailKey(reason),
    tone: TONE[reason],
  };
}
