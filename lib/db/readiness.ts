import { reportLoaderFailure } from "./loaderGuard";
import type { Store } from "./store";

/**
 * Cardinality floors — the readiness gate every public loader passes through
 * AND the release gate `/data` renders (features/data-releases/manifest.ts:
 * a kind below its floor makes the release `degraded`, never `latest`).
 *
 * PGlite creates a missing data dir as an empty-but-healthy store, so
 * "mid-ingest" and "broken" are otherwise indistinguishable from real data — a
 * half-ingested graph would render partial numbers with real citations (the
 * brand rule inverted). Public loaders call storeReady() and degrade to their
 * fallback below a floor.
 *
 * THE RULE: a floor is ~65–72 % of the corpus it guards AT THE INGEST THAT
 * LAST GREW IT — low enough that an ordinary re-ingest (de-duplication, a
 * dropped superseded version) never blacks out the product, high enough that a
 * catastrophic loss fails it. So the next ingest can check them, each floor is
 * recorded against the corpus it was set from:
 *
 *   kind      floor    corpus at the ingest that set it       share
 *   person      150    207   psp.cz PSP10 mandates, 2026-07-24  72 %
 *   company     140    196   ARES ⋈ Hlídač join, pass 10        71 %
 *   bill        100    141   psp.cz tisky, pass 11              71 %
 *   law          70    101   e-Sbírka, pass 11                  69 %
 *   contract 100 000   152 788 Registr smluv bulk dumps,        65 %
 *                            money batch 012, 2026-07-27
 *
 * WHY `contract` IS ROUNDER THAN THE REST: the four small kinds are stable
 * registers re-read whole; the contract corpus is a 123-month bulk re-ingest
 * (~26 GB streamed) whose row count moves in tens of thousands when the
 * version rule changes — batch 012 alone dropped 13 174 superseded versions.
 * 100 000 is the roundest number under the ~70 % line, which buys that
 * headroom without lowering the gate to decoration.
 *
 * WHY THIS COMMENT NOW: `contract` sat at 1 500 from 2026-07-24 to 2026-08-13
 * against a corpus of 152 788 — 0,98 % — because the floor was not raised in
 * the change that grew the corpus 2 287 → 152 788 the very next day
 * (docs/data-analysis/case-money/ledger.md, "Batch 012"). `/data` therefore
 * printed `contract · 152 788 · ≥ 1 500 · SPLNĚNO` and stamped the version
 * `latest` — and would have stamped a store that had lost 98,7 % of its
 * contracts exactly the same way. RAISE A FLOOR IN THE SAME CHANGE THAT GROWS
 * ITS CORPUS: a floor two orders of magnitude below what it guards certifies
 * catastrophe as a release.
 * See docs/architect/decisions/2026-07-26-ingest-readiness-guard.md.
 */
export const CARDINALITY_FLOORS = {
  person: 150,
  company: 140,
  bill: 100,
  law: 70,
  contract: 100_000,
} as const;

export type FloorKind = keyof typeof CARDINALITY_FLOORS;

/** One kind's cardinality verdict — the release-gate unit (batch-3 item 3D). */
export interface FloorVerdict {
  kind: FloorKind;
  /** Actual node count of the kind (full count, not the floor-capped probe). */
  count: number;
  floor: number;
  ok: boolean;
}

/**
 * Pure release-gate derivation over full per-kind counts (e.g. from
 * `Store.kgKindCounts()`): every floor kind gets a verdict, in the pinned
 * `CARDINALITY_FLOORS` key order so downstream serializations are stable.
 * A kind absent from `kindCounts` counts as 0 — an empty store fails loudly,
 * exactly like `storeReady`. Additive: `storeReady` is untouched.
 */
export function floorVerdicts(kindCounts: Readonly<Record<string, number>>): FloorVerdict[] {
  return (Object.keys(CARDINALITY_FLOORS) as FloorKind[]).map((kind) => {
    const floor = CARDINALITY_FLOORS[kind];
    const count = kindCounts[kind] ?? 0;
    return { kind, count, floor, ok: count >= floor };
  });
}

// The failure path below is loud (reportLoaderFailure logs + fires Sentry) —
// but the bypass that suppresses this whole gate had no equivalent trace,
// making the one state that should be MOST observable (a safety net
// deliberately disabled) the only one that left none. Logged once per
// process so a leaked env var (copy-pasted .env, a CI variable bleeding into
// a preview/prod deploy) is at least visible in logs, even though the check
// itself still honors the flag.
let loggedReadinessBypass = false;

/**
 * True when every requested kind meets its floor. Failures are reported (once
 * per call) through the loader-failure channel so the degradation is traceable.
 * `KG_READINESS_OFF=1` bypasses the check — for tests that seed small stores
 * on purpose; never set it in a deployment.
 */
export async function storeReady(
  store: Pick<Store, "listKgNodes"> & Partial<Pick<Store, "kgKindCounts">>,
  kinds: readonly FloorKind[],
): Promise<boolean> {
  if (process.env.KG_READINESS_OFF === "1") {
    if (!loggedReadinessBypass) {
      loggedReadinessBypass = true;
      console.warn("[readiness] KG_READINESS_OFF=1 — cardinality gate bypassed for this process");
    }
    return true;
  }
  // Counting by COUNT, not by reading a floor's worth of rows. The old probe asked
  // `listKgNodes({ kind, limit: floor })` — which (a) tripped the truncation guard on
  // every healthy call, because a probe that reads exactly its own limit is exactly
  // what that guard cannot distinguish from a truncated read, and (b) was the single
  // most expensive statement on the /zebricek path: measured on the live store, the
  // `person` probe at limit 150 cost 419–692 ms against 237–380 ms for one indexed
  // `kgKindCounts()` group-by that answers EVERY kind at once. `listKgNodes` remains
  // the fallback so a hand-built test store implementing only that keeps working.
  const failures: string[] = [];
  const counts = store.kgKindCounts ? await store.kgKindCounts() : null;
  const countByKind = counts ? new Map(counts.map((c) => [c.kind, c.count])) : null;
  for (const kind of kinds) {
    const floor = CARDINALITY_FLOORS[kind];
    const got = countByKind
      ? (countByKind.get(kind) ?? 0)
      : (await store.listKgNodes({ kind, limit: floor })).length;
    if (got < floor) failures.push(`${kind} ${got}<${floor}`);
  }
  if (failures.length > 0) {
    reportLoaderFailure("storeReady", new Error(`graph below cardinality floor: ${failures.join(", ")}`));
  }
  return failures.length === 0;
}
