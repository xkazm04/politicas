/**
 * THE PUBLIC WIRE — what /dashboard actually ships to a browser.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * `getDashboardData()` builds the state slice AND the working set the ledger of
 * dated facts was assembled from (`StateSlice.sources`: every attributable
 * company with its kg id and crosshair refs, every drawn tie with its role and
 * registry validity, every drawn bill with its committee assignments). That set
 * is consumed ENTIRELY on the server — `sliceContracts()` reads contracts with
 * it and `buildDatedFacts()` turns it into `feed` — and then it crossed the
 * network anyway, on every request, because the whole `StateSlice` was the prop.
 * Nothing client-side reads it: `DashboardPage` uses `slice.graph`, `slice.rule`
 * and `sliceExhibitId(slice)`, and the exhibit hash is `Pick<StateSlice,
 * "graph" | "rule">` BY TYPE (see ./exhibit.ts) — so the address a reader cites
 * is computed from the picture and its rule, never from this working set.
 * Measured on the live store: 1 600 B of a 12 271 B payload.
 *
 * The money headline had the same shape: `mpsWithTies`, `companiesLinked` and
 * `totalTies` are /penize's own aggregates, kept here from before the tile
 * rendered the review phase. The velín renders none of them.
 *
 * ── Why a PROJECTION and not a second shape ─────────────────────────────────
 * The /penize precedent (`features/money/publicWire.ts`): this is a NARROWING of
 * the shared shape, derived FROM it. `MONEY_WIRE` classifies every
 * `DashboardMoney` field `public`/`internal` under
 * `satisfies Record<keyof DashboardMoney, …>`, so a field added to the headline
 * fails to compile until someone decides whether the wire carries it, and
 * `PublicDashboardMoney` is `Pick`ed from that classification — the mapper below
 * cannot drift from it either.
 *
 * `getExhibitData()` keeps the FULL `DashboardData`: it re-derives the exhibit on
 * the server from the same pipeline and needs the ledger, not less than the page.
 */

import type { StateSlice } from "./stateSlice";
import type { DashboardData, DashboardMoney } from "./getDashboardData";

/**
 * Field-by-field classification of the money headline for /dashboard.
 *
 * `public` = something the money tile renders or cites.
 * `internal` = an aggregate the LOADER carries because /penize computed it; the
 * velín's tile shows the attribution split, the floor note and the review phase,
 * and nothing else.
 */
export const MONEY_WIRE = {
  attributableCzk: "public", // the tile's numeral
  stewardCzk: "public", // the split sentence beneath it
  review: "public", // the human-gate phase (features/money/reviewSummary.ts)
  pass: "public", // the citation
  isFloor: "public", // „nejméně" — the tile may not sound surer than /penize
  perCompanyCap: "public", // the floor note's own evidence
  companiesAtCap: "public",

  // /penize's aggregates. Nothing on this page renders them.
  mpsWithTies: "internal",
  companiesLinked: "internal",
  totalTies: "internal",
} as const satisfies Record<keyof DashboardMoney, "public" | "internal">;

type PublicMoneyKey = {
  [K in keyof typeof MONEY_WIRE]: (typeof MONEY_WIRE)[K] extends "public" ? K : never;
}[keyof typeof MONEY_WIRE];

/** The money headline as the client sees it. A narrowing of `DashboardMoney`. */
export type PublicDashboardMoney = Pick<DashboardMoney, PublicMoneyKey>;

/** The `public` half of `MONEY_WIRE` as a runtime list — the colocated test holds
 *  `toPublicMoney` to exactly this set, so the classification above cannot become
 *  a comment that lies about what ships. */
export const PUBLIC_MONEY_KEYS: readonly PublicMoneyKey[] = Object.entries(MONEY_WIRE)
  .filter(([, v]) => v === "public")
  .map(([k]) => k as PublicMoneyKey);

/**
 * The slice as the client renders it: the picture and the rule printed under it.
 *
 * This is deliberately the SAME type `hashSlice()` / `sliceExhibitId()` accept —
 * so the exhibit address computed from the wire is the address computed from the
 * full slice, by construction rather than by coincidence.
 */
export type PublicStateSlice = Pick<StateSlice, "graph" | "rule">;

/** What `/dashboard` ships. Everything `DashboardData` carries except the two
 *  fields that are narrowed. */
export interface DashboardWire extends Omit<DashboardData, "money" | "slice"> {
  money: PublicDashboardMoney | null;
  slice: PublicStateSlice | null;
}

export function toPublicMoney(money: DashboardMoney): PublicDashboardMoney {
  return {
    attributableCzk: money.attributableCzk,
    stewardCzk: money.stewardCzk,
    review: money.review,
    pass: money.pass,
    isFloor: money.isFloor,
    perCompanyCap: money.perCompanyCap,
    companiesAtCap: money.companiesAtCap,
  };
}

/** `DashboardData` → the /dashboard wire. Pure; the route applies it between the
 *  loader and the client component, so `getExhibitData()` keeps the full shape. */
export function toDashboardWire(data: DashboardData): DashboardWire {
  const { money, slice, ...rest } = data;
  return {
    ...rest,
    money: money ? toPublicMoney(money) : null,
    slice: slice ? { graph: slice.graph, rule: slice.rule } : null,
  };
}
