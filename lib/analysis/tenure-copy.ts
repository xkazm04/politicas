// Tenure-aware profile copy — Case ② build (batch 005, Q-effort-5 follow-through).
//
// The tenure annotation (scripts/case-loops/effort/tenure.ts, batch 003) writes
// `effort_tenure_days` / `effort_tenure_class` / `effort_tenure_start` /
// `effort_tenure_end` onto every PSP10 person node — deterministic, sourced from
// membership.fromAt/toAt on organ 174 (the chamber itself), never touching the
// contribution score. This module turns those props into two honest UI
// affordances, both graceful-null when the data is absent or the class doesn't
// warrant a note:
//
//   1. mandateNoteCopy — for `replacement` (seated mid-term) and `departed`
//      (left mid-term) MPs, a small Czech note stating when the mandate arose
//      (and ended, if departed). `full_term` and `never_seated` render nothing
//      here: full_term needs no explanation, and never_seated already gets its
//      own LowScoreReasonBadge story (declined_mandate).
//   2. isTrendTooEarly — the PSP9→PSP10 TrendPanel compares rate-based
//      components (participation, attendance) that are meaningless over a
//      handful of sitting days; below TREND_MIN_TENURE_DAYS the comparison is
//      suppressed rather than shown noisy or misleading.
//
// NOTE on wording (tenure.ts's own comment, carried forward): fromAt is the
// date the MANDATE AROSE ("mandát vznikl"), not the oath date — never write
// "složil(a) slib" from this prop.
//
// MESSAGE KEYS, NOT SENTENCES (2026-08-12). Both copy sets were Czech literals
// here, so an English reader met them raw — in the Souboj, where the tenure
// class is the PRECONDITION for reading every number beside it. Both now return
// the KEY of the sentence (namespace `verdicts`) plus the values it interpolates;
// the consumer calls `t(key, …)`. The mandate note additionally hands back the
// ISO dates rather than a pre-formatted Czech one, so the date goes through the
// app's single formatting authority (`lib/format.ts`) like every other date on
// the page — `formatCzechDate` stays as this module's date VALIDATOR (a
// malformed prop must yield null, never a fabricated date).
//
// Pure + defensive, unit-tested by lib/**/*.test.ts — no React, no store access.

export type TenureClass = "full_term" | "replacement" | "departed" | "never_seated";

const TENURE_CLASSES: readonly TenureClass[] = ["full_term", "replacement", "departed", "never_seated"];

export function isTenureClass(x: unknown): x is TenureClass {
  return typeof x === "string" && (TENURE_CLASSES as readonly string[]).includes(x);
}

/**
 * Short Czech label for a tenure class — all FOUR classes, unlike `mandateNoteCopy`,
 * which deliberately says nothing for `full_term` / `never_seated` inside a profile
 * that has other room to explain them.
 *
 * It exists for the head-to-head (2026-08-04), where the class is not decoration but
 * the precondition for reading every other number: an MP who NEVER TOOK THE SEAT has a
 * structurally empty record, and putting their zero next to a working MP's count
 * without saying that is the single most misleading thing this surface could do. Copy
 * lives here rather than in the component so there is ONE tenure vocabulary, pinned to
 * the Czech language gate by this module's test.
 *
 * `structural: true` marks the classes that explain the counts beside them.
 * Graceful null for an unrecognized or absent class — never a fabricated label.
 */
export interface TenureClassLabel {
  /** Message key of the short class label. */
  labelKey: string;
  /** Message key of the one-sentence explanation. */
  detailKey: string;
  structural: boolean;
}

/** `never_seated` → `NeverSeated` — derived, so a new class cannot carry a
 *  hand-typed key that matches nothing in the catalogs. */
function stem(tenureClass: TenureClass): string {
  return tenureClass
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Message key of a class label, inside the `verdicts` namespace. */
export function tenureLabelKey(tenureClass: TenureClass): string {
  return `tenure${stem(tenureClass)}Label`;
}

/** Message key of a class explanation, inside the `verdicts` namespace. */
export function tenureDetailKey(tenureClass: TenureClass): string {
  return `tenure${stem(tenureClass)}Detail`;
}

/** `structural: true` marks the classes that explain the counts beside them. */
const STRUCTURAL: Record<TenureClass, boolean> = {
  full_term: false,
  replacement: true,
  departed: true,
  never_seated: true,
};

export function tenureClassLabel(tenureClass: unknown): TenureClassLabel | null {
  if (!isTenureClass(tenureClass)) return null;
  return {
    labelKey: tenureLabelKey(tenureClass),
    detailKey: tenureDetailKey(tenureClass),
    structural: STRUCTURAL[tenureClass],
  };
}

/** Below this many tenure days, term-over-term rate comparisons are too noisy to show. */
export const TREND_MIN_TENURE_DAYS = 90;

/** True when the TrendPanel's rate/delta comparison should be suppressed for a short
 * (or unknown) tenure. Fails CLOSED: an absent/non-numeric tenureDays (e.g. an MP
 * missing a chamber-membership row for tenure purposes) is treated as "too early
 * to trust the comparison," matching this codebase's graceful-null-first
 * discipline everywhere else — "we don't know" must never be read as "long enough." */
export function isTrendTooEarly(tenureDays: unknown): boolean {
  return typeof tenureDays !== "number" || !Number.isFinite(tenureDays) || tenureDays < TREND_MIN_TENURE_DAYS;
}

/** "2025-11-12" → "12. 11. 2025" (cs-CZ day-first, no leading zeros — matches spoken Czech dates). */
export function formatCzechDate(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${Number(d)}. ${Number(mo)}. ${y}`;
}

export interface MandateNoteCopy {
  /** Message key of the note — when the mandate arose, and ended if applicable. */
  detailKey: string;
  /** ISO start date; the consumer formats it (`lib/format.ts`), this module does not. */
  start: string;
  /** ISO end date, or null when the source carries none (a different sentence). */
  end: string | null;
}

/** Every key this module can emit (the /overeni `*_COPY_KEYS` contract). */
export const TENURE_COPY_KEYS: readonly string[] = [
  ...TENURE_CLASSES.flatMap((c) => [tenureLabelKey(c), tenureDetailKey(c)]),
  "mandateNoteReplacement",
  "mandateNoteDeparted",
  "mandateNoteDepartedNoEnd",
];

/**
 * Build the mandate-note copy for `replacement`/`departed` tenure classes.
 * Returns null for `full_term`, `never_seated`, unrecognized classes, or when
 * the start date is missing/malformed — graceful null, never a fabricated date.
 *
 * The dates come back as ISO strings: an unparseable one still yields null (the
 * `formatCzechDate` validation below is exactly that check), but the RENDERED
 * form is the consumer's, so a note reads „12. 11. 2025" in Czech and the
 * locale's own form in English instead of Czech dates inside English prose.
 */
export function mandateNoteCopy(
  tenureClass: unknown,
  tenureStart: unknown,
  tenureEnd?: unknown,
): MandateNoteCopy | null {
  if (!isTenureClass(tenureClass)) return null;
  if (tenureClass !== "replacement" && tenureClass !== "departed") return null;
  if (typeof tenureStart !== "string") return null;
  // Validation only — a malformed date must yield null, never a guessed one.
  if (!formatCzechDate(tenureStart)) return null;

  if (tenureClass === "replacement") {
    return { detailKey: "mandateNoteReplacement", start: tenureStart, end: null };
  }

  // departed
  const end = typeof tenureEnd === "string" && formatCzechDate(tenureEnd) ? tenureEnd : null;
  return {
    detailKey: end ? "mandateNoteDeparted" : "mandateNoteDepartedNoEnd",
    start: tenureStart,
    end,
  };
}
