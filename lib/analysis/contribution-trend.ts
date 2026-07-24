// Term-over-term contribution TREND — Case ② build phase (PSP9 restoration).
//
// Pure + defensive. Reads the optional `contribution_psp9` sub-object that the
// effort loop's psp9-contribution script writes onto a person node and turns it
// into a comparable delta against the current-term contribution. Degrades to
// `null` whenever the prior-term data is absent or malformed — the loaders pass
// that null straight through, so the UI falls back to today's single-term view.
//
// HONESTY CONTRACT (mirrors the kernel gates):
//   - Numbers are NEVER authored here; they come from the stored profiles, which
//     were authored by computeContribution. This only SUBTRACTS two authored
//     numbers to show a delta, and only for components present in BOTH terms.
//   - When the prior term is incomplete (participation/attendance await the PSP9
//     roll-call ingest — a fleet handoff), `complete=false` and the score-level
//     delta is null; only the vote-independent component deltas render.
//
// Lives under lib/analysis (with the scorer it compares) so it is unit-tested by
// the lib/**/*.test.ts suite; the feature loaders import computeTrend from here.

import { CONTRIBUTION_WEIGHTS } from "./contribution";

/** The six contribution component keys (identical to the leaderboard's ComponentKey). */
export type ComponentKey = keyof typeof CONTRIBUTION_WEIGHTS;

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** One component's term-over-term movement; `prior`/`delta` null when the prior term lacks it. */
export interface ComponentTrend {
  key: ComponentKey;
  weight: number;
  current: number;
  prior: number | null;
  delta: number | null;
}

/** Compact activity-count comparison (raw underlying stats, both terms). */
export interface CountTrend {
  billsAuthored: { prior: number; current: number };
  interpellations: { prior: number; current: number };
  speechTurns: { prior: number; current: number };
  committeeCount: { prior: number; current: number };
  leadershipCount: { prior: number; current: number };
}

export interface ContributionTrend {
  priorTerm: string; // e.g. "PSP9"
  complete: boolean; // full 0–100 score comparable across terms?
  priorScore: number | null; // only when complete
  currentScore: number;
  scoreDelta: number | null; // current − prior, only when complete
  /** Components that could not be compared because the prior term lacks them (e.g. participation). */
  pendingComponents: ComponentKey[];
  components: ComponentTrend[];
  counts: CountTrend;
  provenance: { pass: number | null; ref: string } | null;
}

const COMPONENT_ORDER: ComponentKey[] = ["participation", "committee", "legislative", "speech", "attendance", "leadership"];

/** Inputs from the current-term entry the loaders already build. */
export interface CurrentContribution {
  score: number;
  components: Record<ComponentKey, number>;
  billsAuthored: number;
  interpellations: number;
  speechTurns: number;
  committeeCount: number;
  leadershipCount: number;
}

/**
 * Build a ContributionTrend from a current-term contribution and the raw stored
 * `contribution_psp9` prop (unknown-typed, validated here). Returns null if the
 * prior-term prop is missing or unusable.
 */
export function computeTrend(current: CurrentContribution, psp9Prop: unknown): ContributionTrend | null {
  if (!psp9Prop || typeof psp9Prop !== "object") return null;
  const p = psp9Prop as Record<string, unknown>;
  const priorTerm = typeof p.term === "string" ? p.term : "PSP9";
  const priorComponents = (p.components && typeof p.components === "object" ? p.components : {}) as Record<string, unknown>;
  // If not even one vote-independent component is present, the prop is unusable.
  if (num(priorComponents.committee) === null && num(priorComponents.legislative) === null && num(priorComponents.speech) === null) {
    return null;
  }
  const complete = p.complete === true;

  const pendingComponents: ComponentKey[] = [];
  const components: ComponentTrend[] = COMPONENT_ORDER.map((key) => {
    const currentPts = current.components[key] ?? 0;
    const prior = num(priorComponents[key]);
    if (prior === null) pendingComponents.push(key);
    return {
      key,
      weight: CONTRIBUTION_WEIGHTS[key],
      current: currentPts,
      prior,
      delta: prior === null ? null : round1(currentPts - prior),
    };
  });

  const priorScore = complete ? num(p.score) : null;
  const scoreDelta = complete && priorScore !== null ? round1(current.score - priorScore) : null;

  const prov = p.provenance && typeof p.provenance === "object" ? (p.provenance as Record<string, unknown>) : null;

  return {
    priorTerm,
    complete,
    priorScore,
    currentScore: current.score,
    scoreDelta,
    pendingComponents,
    components,
    counts: {
      billsAuthored: { prior: num(p.billsAuthored) ?? 0, current: current.billsAuthored },
      interpellations: { prior: num(p.interpellations) ?? 0, current: current.interpellations },
      speechTurns: { prior: num(p.speechTurns) ?? 0, current: current.speechTurns },
      committeeCount: { prior: num(p.committeeCount) ?? 0, current: current.committeeCount },
      leadershipCount: { prior: num(p.leadershipCount) ?? 0, current: current.leadershipCount },
    },
    provenance: prov ? { pass: num(prov.pass), ref: typeof prov.ref === "string" ? prov.ref : "contribution-psp9" } : null,
  };
}
