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
  label: string;
  detail: string;
  structural: boolean;
}

const TENURE_CLASS_LABELS: Record<TenureClass, TenureClassLabel> = {
  full_term: {
    label: "Celé období",
    detail: "Mandát drží po celé sledované období — čísla níže popisují plnou dobu ve Sněmovně.",
    structural: false,
  },
  replacement: {
    label: "Nastoupil(a) v průběhu",
    detail: "Mandátu se ujal(a) až v průběhu období — čísla níže popisují kratší reálnou dobu ve Sněmovně.",
    structural: true,
  },
  departed: {
    label: "Odešel(a) v průběhu",
    detail: "Mandát zanikl v průběhu období — čísla níže popisují kratší reálnou dobu ve Sněmovně.",
    structural: true,
  },
  never_seated: {
    label: "Mandát nepřevzal(a)",
    detail: "Mandátu se vzdal(a) nebo ho nepřevzal(a) — ve Sněmovně nepracoval(a), takže čísla níže nejsou výkon, ale prázdný záznam.",
    structural: true,
  },
};

export function tenureClassLabel(tenureClass: unknown): TenureClassLabel | null {
  return isTenureClass(tenureClass) ? TENURE_CLASS_LABELS[tenureClass] : null;
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
  /** One-sentence Czech note — when the mandate arose, and ended if applicable. */
  detail: string;
}

/**
 * Build the mandate-note copy for `replacement`/`departed` tenure classes.
 * Returns null for `full_term`, `never_seated`, unrecognized classes, or when
 * the start date is missing/malformed — graceful null, never a fabricated date.
 */
export function mandateNoteCopy(
  tenureClass: unknown,
  tenureStart: unknown,
  tenureEnd?: unknown,
): MandateNoteCopy | null {
  if (!isTenureClass(tenureClass)) return null;
  if (tenureClass !== "replacement" && tenureClass !== "departed") return null;
  if (typeof tenureStart !== "string") return null;
  const start = formatCzechDate(tenureStart);
  if (!start) return null;

  if (tenureClass === "replacement") {
    return { detail: `Mandát vznikl ${start} (nastoupil/a jako náhradník/nice).` };
  }

  // departed
  const end = typeof tenureEnd === "string" ? formatCzechDate(tenureEnd) : null;
  return {
    detail: end
      ? `Mandát vznikl ${start}, zanikl ${end} (odešel/odešla v průběhu období).`
      : `Mandát vznikl ${start} (odešel/odešla v průběhu období).`,
  };
}
