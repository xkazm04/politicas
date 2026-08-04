import { reportLoaderFailure } from "./loaderGuard";
import type { Store } from "./store";

/**
 * Cardinality floors ≈70 % of the 2026-07-24 ingest (207 persons / 196
 * companies / 141 bills / 101 laws / 2 287 contracts). PGlite creates a
 * missing data dir as an empty-but-healthy store, so "mid-ingest" and
 * "broken" are otherwise indistinguishable from real data — a half-ingested
 * graph would render partial numbers with real citations (the brand rule
 * inverted). Public loaders call storeReady() and degrade to their fallback
 * below a floor. Raise the floors alongside major ingests.
 * See docs/architect/decisions/2026-07-26-ingest-readiness-guard.md.
 */
export const CARDINALITY_FLOORS = {
  person: 150,
  company: 140,
  bill: 100,
  law: 70,
  contract: 1500,
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
