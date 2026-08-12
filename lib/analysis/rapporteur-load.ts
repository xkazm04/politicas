// Zpravodajský tahoun — rapporteur-load badge copy (Case ② build, batch 008).
//
// Pass 34 gave the graph `rapporteur` edges (person → bill zpravodaj
// assignments from psp.cz tisky.zip); the deterministic backfill
// (scripts/case-loops/effort/rapporteur-load.ts) counts each MP's DISTINCT
// rapporteur bills into `effort_rapporteur_load`. This module turns that count
// into an honest badge for /zebricek and the spis.
//
// Deliberately NOT a third quiet-workhorse flavour: rapporteur load says
// nothing about floor visibility (the top rapporteur is also a top floor
// speaker), so it must not inherit the "tichý" framing. It is the assigned
// analytical role — positive symmetry, count not quality.
//
// MESSAGE KEYS, NOT SENTENCES (2026-08-12). The badge and its explanation were
// Czech literals here — the explanation built by string concatenation around the
// count — so an English reader read a Czech verdict. The module stays pure and
// returns the KEY plus the raw count; the consumer calls `t(key, { load })` on
// the `verdicts` namespace with the count ALREADY formatted through
// `lib/format.ts` (the app's single display-number authority: next-intl would
// otherwise route it through its own `Intl.NumberFormat`).
//
// Pure + defensive: below the threshold (or non-numeric input) renders nothing.

/** Minimum distinct bills as zpravodaj to earn the badge (18/207 at pass 35). */
export const RAPPORTEUR_WORKHORSE_MIN = 3;

export interface RapporteurLoadCopy {
  /** Message key of the badge label. */
  badgeKey: string;
  /** Message key of the explanation; declares one `{load}` placeholder. */
  detailKey: string;
  /** The count the verdict rests on — the consumer formats it, never this module. */
  load: number;
}

/** Every key this module can emit (the /overeni `*_COPY_KEYS` contract). */
export const RAPPORTEUR_COPY_KEYS: readonly string[] = ["rapporteurBadge", "rapporteurDetail"];

/** Badge copy for a stored `effort_rapporteur_load`; null below threshold or invalid. */
export function rapporteurLoadCopy(load: unknown): RapporteurLoadCopy | null {
  if (typeof load !== "number" || !Number.isFinite(load) || load < RAPPORTEUR_WORKHORSE_MIN) return null;
  return { badgeKey: "rapporteurBadge", detailKey: "rapporteurDetail", load };
}
