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
// prop into an honest, non-judgmental Czech label the profile can render as a
// correcting badge, instead of letting a low number imply laziness.
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
  "unknown",
] as const;

export type LowScoreReason = (typeof LOW_SCORE_REASONS)[number];

export function isLowScoreReason(x: unknown): x is LowScoreReason {
  return typeof x === "string" && (LOW_SCORE_REASONS as readonly string[]).includes(x);
}

export interface LowScoreReasonCopy {
  /** Short badge label — fits a single line next to the score. */
  badge: string;
  /** One-sentence honest explanation, rendered under the badge. */
  detail: string;
  /** Badge tone: "neutral" (structural, no implication) vs "positive" (an honest correction that reads well for the MP). */
  tone: "neutral" | "positive";
}

/**
 * Czech copy per reason (fleet: messages/*.json is shared and not editable from
 * this case's boundary — inline literals here, matching the TrendPanel precedent;
 * proposed i18n keys are listed in the batch handoff for the orchestrator).
 */
const COPY: Record<LowScoreReason, LowScoreReasonCopy> = {
  declined_mandate: {
    badge: "Mandátu se vzdal(a)",
    detail: "Nulová nebo nízká aktivita není absence — mandát byl odmítnut nebo se ho MP vzdal(a) před složením slibu či brzy po něm.",
    tone: "positive",
  },
  replacement: {
    badge: "Nastoupil(a) jako náhradník/-ce",
    detail: "Mandátu se ujal(a) až v průběhu období — nízké skóre odráží kratší reálnou dobu ve Sněmovně, ne nezájem.",
    tone: "positive",
  },
  dual_mandate: {
    badge: "Souběžný veřejný mandát",
    detail: "Poslanec/poslankyně zároveň zastává jiný volený úřad (např. starosta, krajský radní) — nízké skóre odráží souběh funkcí.",
    tone: "neutral",
  },
  prime_minister: {
    badge: "Bývalý/á předseda/kyně vlády",
    detail: "Nízké skóre je artefaktem předání vlády nebo stranického vedení na počátku období, ne absence na půdě Sněmovny.",
    tone: "neutral",
  },
  minister: {
    badge: "Člen vlády",
    detail: "Jako člen/členka vlády tráví většinu času exekutivní agendou mimo Sněmovnu — index měří jen sněmovní aktivitu.",
    tone: "neutral",
  },
  deputy_pm: {
    badge: "Místopředseda/kyně vlády",
    detail: "Jako místopředseda/kyně vlády tráví většinu času exekutivní agendou mimo Sněmovnu — index měří jen sněmovní aktivitu.",
    tone: "neutral",
  },
  opposition_leader: {
    badge: "Vedení opoziční strany",
    detail: "Stranické vedení mimo výbory zabírá čas, který index nezachycuje — nízké skóre neznamená nečinnost.",
    tone: "neutral",
  },
  new_mp: {
    badge: "Nováček/nováčka",
    detail: "První období ve Sněmovně — nízké skóre v raných měsících je u nováčků obvyklé, ne známkou nezájmu.",
    tone: "neutral",
  },
  genuine_absentee: {
    badge: "Nízká aktivita",
    detail: "Enrichment nenašel strukturální vysvětlení nízké aktivity — na rozdíl od ostatních důvodů toto NENÍ korektiv skóre.",
    tone: "neutral",
  },
  low_legislative_output: {
    badge: "Bez vlastní legislativy",
    detail: "Přítomnost a hlasování odpovídají klubu, ale bez vlastního tisku či pozměňovacího návrhu — jiný typ přispění (organizační, klubová role).",
    tone: "neutral",
  },
  unknown: {
    badge: "Neobjasněno",
    detail: "Nízké skóre bylo prověřeno, ale konkrétní příčina nebyla veřejně dohledatelná.",
    tone: "neutral",
  },
};

/** Look up the badge copy for a stored `effort_low_score_reason` value; null when absent/unrecognized. */
export function lowScoreReasonCopy(reason: unknown): LowScoreReasonCopy | null {
  return isLowScoreReason(reason) ? COPY[reason] : null;
}
