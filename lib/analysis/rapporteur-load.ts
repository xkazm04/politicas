// Zpravodajský tahoun — rapporteur-load badge copy (Case ② build, batch 008).
//
// Pass 34 gave the graph `rapporteur` edges (person → bill zpravodaj
// assignments from psp.cz tisky.zip); the deterministic backfill
// (scripts/case-loops/effort/rapporteur-load.ts) counts each MP's DISTINCT
// rapporteur bills into `effort_rapporteur_load`. This module turns that count
// into an honest Czech badge for /zebricek.
//
// Deliberately NOT a third quiet-workhorse flavour: rapporteur load says
// nothing about floor visibility (the top rapporteur is also a top floor
// speaker), so it must not inherit the "tichý" framing. It is the assigned
// analytical role — positive symmetry, count not quality.
//
// Pure + defensive: below the threshold (or non-numeric input) renders nothing.

/** Minimum distinct bills as zpravodaj to earn the badge (18/207 at pass 35). */
export const RAPPORTEUR_WORKHORSE_MIN = 3;

export interface RapporteurLoadCopy {
  badge: string;
  detail: string;
  load: number;
}

/** Badge copy for a stored `effort_rapporteur_load`; null below threshold or invalid. */
export function rapporteurLoadCopy(load: unknown): RapporteurLoadCopy | null {
  if (typeof load !== "number" || !Number.isFinite(load) || load < RAPPORTEUR_WORKHORSE_MIN) return null;
  return {
    badge: "Zpravodajský tahoun",
    load,
    detail:
      `Působí jako zpravodaj (odborné zpracování tisku pro sněmovnu či výbor) u ${load} návrhů zákona — ` +
      "přidělená analytická práce nad rámec podpisu pod návrhem. Počet říká rozsah role, ne kvalitu.",
  };
}
