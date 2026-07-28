// Making the contribution index CHECKABLE — Case ② read side.
//
// The index is the product's central claim, and on the MP dossier it arrives as
// a number plus six bars. Politicas positions itself as methodology-transparent,
// so a journalist or a rival campaign should be able to audit an MP's standing
// without reading `contribution.ts`. This module derives, per component:
//
//   · the MP's value IN THE COMPONENT'S OWN UNIT (tisky, výbory, vystoupení, %)
//   · the scorer's saturation cap for that unit — where the component stops paying
//   · the chamber median of that same unit
//   · the headroom left, and the rank this MP would hold with that component at
//     its cap and everything else unchanged
//
// EVERYTHING here is DERIVED and must be labelled as such on-page. It changes
// neither the index nor its weights — it only re-states, in real units, what the
// published formula in `contribution.ts` already does.
//
// Two rules this file exists to keep:
//  1. MISSING IS NOT ZERO. `num()` on the read path maps an absent prop to 0, which
//     would render "0 vystoupení" for an MP whose speech data was never ingested —
//     a fabricated fact. Every value here is `number | null` and a null says so.
//  2. NO INTERPOLATION. `rankAtCap` is not a curve fit: it counts how many real MPs
//     hold a real score above the projected one. The chamber median is a median of
//     real values, over the MPs that actually have one.
//
// Pure and DB-free — the loader passes in the chamber rows it has already read.

import {
  COMMITTEE_SATURATION,
  CONTRIBUTION_WEIGHTS,
  LEGISLATIVE_SATURATION,
  SPEECH_SATURATION,
} from "./contribution";

export type ComponentKey = keyof typeof CONTRIBUTION_WEIGHTS;

/** How a component's value should be read by a human: a 0–1 rate, or a count. */
export type ComponentUnit = "rate" | "count";

/**
 * The saturation point of each component IN ITS OWN UNIT — the value at which it
 * pays its full weight. Mirrors `computeContribution` exactly; the three count
 * caps are imported, never re-typed.
 *
 * `leadership` is the odd one: it is a STEP, not a ramp (holding any leadership
 * role at all pays the whole 10 points), so its cap is 1 and its headroom is
 * all-or-nothing.
 */
export const COMPONENT_CAP: Record<ComponentKey, number> = {
  participation: 1,
  committee: COMMITTEE_SATURATION,
  legislative: LEGISLATIVE_SATURATION,
  speech: SPEECH_SATURATION,
  attendance: 1,
  leadership: 1,
};

export const COMPONENT_UNIT: Record<ComponentKey, ComponentUnit> = {
  participation: "rate",
  committee: "count",
  legislative: "count",
  speech: "count",
  attendance: "rate",
  leadership: "count",
};

const nn = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * The component's value in its own unit, read from the person node's props —
 * `null` when the input the scorer used is not present on the node at all.
 *
 * `attendance` is stored as an ABSENCE rate and scored as `1 - absence`, so what
 * a reader should see (and compare against a median) is the presence rate.
 * `legislative` sums two inputs; if either is missing the sum would understate,
 * so the whole component reads as missing rather than as a smaller true number.
 */
export function componentValue(key: ComponentKey, props: Record<string, unknown>): number | null {
  switch (key) {
    case "participation":
      return nn(props.participation_rate);
    case "committee":
      return nn(props.committee_count);
    case "legislative": {
      const bills = nn(props.bills_authored);
      const interp = nn(props.interpellations);
      return bills === null || interp === null ? null : bills + interp;
    }
    case "speech":
      return nn(props.speech_turns);
    case "attendance": {
      const absence = nn(props.absence_rate);
      return absence === null ? null : round3(1 - absence);
    }
    case "leadership":
      return nn(props.leadership_count);
  }
}

/** Median of the values present; `null` when nobody in the chamber has one. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export interface ComponentLegibility {
  key: ComponentKey;
  weight: number;
  unit: ComponentUnit;
  /** This MP's value in the component's own unit. `null` ⇒ the input is missing. */
  value: number | null;
  /** Where the component saturates, same unit. */
  cap: number;
  /** Points this MP earns from it today (from the leaderboard breakdown). */
  points: number;
  /** Median of the real values across the MPs that have one. */
  chamberMedian: number | null;
  /** Units left to the cap (0 when saturated). `null` when the value is missing. */
  headroomUnits: number | null;
  /** Index points the component could still yield. `null` when the value is missing. */
  headroomPoints: number | null;
  /**
   * Rank this MP would hold with THIS component at its cap and every other input
   * unchanged — counted against the real scores of the real chamber, not fitted.
   * `null` when the value is missing or the component is already saturated.
   */
  rankAtCap: number | null;
}

export interface ScoreLegibility {
  rank: number;
  total: number;
  score: number;
  /** Index points between this MP and the MP one rank above. `null` at rank 1. */
  gapToNext: number | null;
  nextName: string | null;
  components: ComponentLegibility[];
}

export interface LegibilityInput {
  self: {
    rank: number;
    score: number;
    props: Record<string, unknown>;
    /** Earned points per component — the leaderboard's own breakdown. */
    points: Record<ComponentKey, number>;
  };
  /** Every MP in the chamber: their authoritative score + raw person-node props. */
  chamber: readonly { score: number; props: Record<string, unknown> }[];
  /** The MP one rank above, if any. */
  next: { name: string; score: number } | null;
  /** Which components to describe, in the order the page renders them. */
  keys: readonly ComponentKey[];
}

export function computeScoreLegibility(input: LegibilityInput): ScoreLegibility {
  const { self, chamber, next, keys } = input;
  const scores = chamber.map((m) => m.score);

  const components = keys.map<ComponentLegibility>((key) => {
    const weight = CONTRIBUTION_WEIGHTS[key];
    const cap = COMPONENT_CAP[key];
    const value = componentValue(key, self.props);
    const chamberValues = chamber
      .map((m) => componentValue(key, m.props))
      .filter((v): v is number => v !== null);

    let headroomUnits: number | null = null;
    let headroomPoints: number | null = null;
    let rankAtCap: number | null = null;
    if (value !== null) {
      headroomUnits = Math.max(0, round3(cap - value));
      // leadership is a step: any role at all pays the full weight, so its
      // headroom is the whole weight or nothing — never a proportion.
      headroomPoints =
        key === "leadership"
          ? value > 0
            ? 0
            : weight
          : round1(Math.max(0, Math.min(weight, (headroomUnits / cap) * weight)));
      if (headroomPoints > 0) {
        const projected = round1(self.score + headroomPoints);
        // Counted, not interpolated: how many REAL MPs hold a REAL score above it.
        rankAtCap = 1 + scores.filter((s) => s > projected).length;
      }
    }

    return {
      key,
      weight,
      unit: COMPONENT_UNIT[key],
      value,
      cap,
      points: self.points[key] ?? 0,
      chamberMedian: median(chamberValues),
      headroomUnits,
      headroomPoints,
      rankAtCap,
    };
  });

  return {
    rank: self.rank,
    total: chamber.length,
    score: self.score,
    gapToNext: next ? round1(next.score - self.score) : null,
    nextName: next?.name ?? null,
    components,
  };
}
