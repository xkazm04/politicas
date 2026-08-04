/*
 * Contribution-index provenance, aggregated over the WHOLE chamber — pure, no I/O,
 * no `server-only` (so it is testable and importable from a client surface's types).
 *
 * Why this is not two lines inside the loader: `getLeaderboardData` used to read
 * `contribution_provenance.pass` off the FIRST person node it happened to iterate and
 * publish that one number as the ranking's provenance. Two things that hides:
 *
 *   1. a HALF-RECOMPUTED store — a writer that crashed at MP 120 leaves 120 nodes on the
 *      new pass and 87 on the old one, and the page prints one confident pass number for a
 *      ranking whose rows were not authored by the same formula;
 *   2. a STALE store — the ref was discarded entirely by the old cast (`{pass?: number}`),
 *      so the six-day divergence of 2026-07-29 → 2026-08-04 (formula corrected, data not)
 *      was invisible to every surface. See CONTRIBUTION_FORMULA_REF's contract.
 *
 * The rule here: report what the DATA carries, compare it to what the CODE declares, and
 * never collapse a disagreement into a single tidy number.
 */

import { CONTRIBUTION_FORMULA_REF } from "@/lib/analysis/contribution";

/** One distinct `{pass, ref}` combination found on the person nodes, with its population. */
export interface ProvenanceVariant {
  pass: number | null;
  ref: string | null;
  count: number;
}

export interface ContributionProvenance {
  /**
   * `uniform`  — every scored person carries the same `{pass, ref}`.
   * `mixed`    — more than one combination is present (a partial recompute).
   * `absent`   — no person node carries `contribution_provenance` at all.
   */
  state: "uniform" | "mixed" | "absent";
  /** The pass, when `uniform`; null otherwise — a mixed store HAS no single pass. */
  pass: number | null;
  /** The formula ref, when `uniform`; null otherwise. */
  ref: string | null;
  /** How many distinct `{pass, ref}` combinations the chamber carries (0 when absent). */
  distinctCount: number;
  /** Every combination, count desc then pass desc — pinned so reports diff cleanly. */
  variants: ProvenanceVariant[];
  /** Persons carrying a provenance object / persons read. */
  covered: number;
  total: number;
  /** The ref lib/analysis/contribution.ts declares TODAY. */
  declaredRef: string;
  /**
   * True only when EVERY scored person's ref equals `declaredRef`. False means the
   * published ranking was authored by a different formula than the one in the code —
   * the surfaces say so; it is not an error page, it is an honest label.
   */
  formulaMatch: boolean;
}

const readProv = (props: Record<string, unknown>): { pass: number | null; ref: string | null } | null => {
  const raw = props.contribution_provenance;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pass = typeof o.pass === "number" && Number.isFinite(o.pass) ? o.pass : null;
  const ref = typeof o.ref === "string" && o.ref.length > 0 ? o.ref : null;
  if (pass === null && ref === null) return null;
  return { pass, ref };
};

/**
 * Aggregate `contribution_provenance` across every person node the leaderboard read.
 * Deterministic: the variant order depends only on the input multiset, never on iteration.
 */
export function summarizeContributionProvenance(
  personProps: readonly Record<string, unknown>[],
): ContributionProvenance {
  const buckets = new Map<string, ProvenanceVariant>();
  let covered = 0;
  for (const props of personProps) {
    const p = readProv(props);
    if (!p) continue;
    covered++;
    const key = `${p.pass ?? "—"}|${p.ref ?? "—"}`;
    const hit = buckets.get(key);
    if (hit) hit.count++;
    else buckets.set(key, { pass: p.pass, ref: p.ref, count: 1 });
  }

  const variants = [...buckets.values()].sort(
    (a, b) => b.count - a.count || (b.pass ?? -1) - (a.pass ?? -1) || (a.ref ?? "").localeCompare(b.ref ?? ""),
  );
  const state: ContributionProvenance["state"] =
    variants.length === 0 ? "absent" : variants.length === 1 ? "uniform" : "mixed";

  return {
    state,
    pass: state === "uniform" ? variants[0].pass : null,
    ref: state === "uniform" ? variants[0].ref : null,
    distinctCount: variants.length,
    variants,
    covered,
    total: personProps.length,
    declaredRef: CONTRIBUTION_FORMULA_REF,
    // An absent provenance cannot claim a match — it claims nothing at all.
    formulaMatch: variants.length > 0 && variants.every((v) => v.ref === CONTRIBUTION_FORMULA_REF),
  };
}

/**
 * The mismatch capsule a printed sheet's citation footer takes, or null when the data and
 * the code agree (or when there is nothing to compare — an absent provenance claims
 * nothing, and a poster must not print an accusation about a blank).
 */
export function formulaMismatchOrNull(
  p: ContributionProvenance,
): { storedRef: string; declaredRef: string } | null {
  if (p.state === "absent" || p.formulaMatch) return null;
  return { storedRef: storedRefLabel(p), declaredRef: p.declaredRef };
}

/** The refs the store actually carries, deduped and ordered — for the mismatch sentence. */
export function storedRefLabel(p: ContributionProvenance): string {
  const refs = [...new Set(p.variants.map((v) => v.ref ?? "—"))];
  return refs.length > 0 ? refs.join(", ") : "—";
}
