/**
 * THE PUBLIC WIRE — what /zakony actually ships to a browser.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * `app/zakony/page.tsx` handed the ENTIRE `LawData` to a `"use client"` tree.
 * That payload carries, per bill, the whole gated forensic verdict (three prose
 * fields, every unstated effect with its evidence sentence, every citation), the
 * verbatim e-Sbírka §-diff text of both versions, the batch-017 sector-attribution
 * flags with their disposition prose, the full census list, the sponsor/rapporteur/
 * speaker/amendment-author rosters and the committee routing — 141 bills of it.
 *
 * The /zakony client tree renders NONE of that. It is the DOSSIER (/zakony/[cislo])
 * that renders the prose, per bill, one bill at a time. The overview needs the print
 * number, the title, the derived one-liner, the origin, the conflict flag, the
 * statute refs it searches by, and — for its four facet buttons — whether each heavy
 * field is non-empty. Everything else crossed the network for nobody.
 *
 * ── Why a PROJECTION and not a second shape ─────────────────────────────────
 * The /penize (`TIE_WIRE`) and /dashboard (`MONEY_WIRE`) precedents: this is a
 * NARROWING of the shared shape, derived FROM it, applied in the ROUTE between the
 * loader and the client. `/zakony/[cislo]`, `/zakony/predpis` and every server-side
 * consumer (`getRadarData`, `listStatuteRegistry`, /dashboard, /denik) keep the FULL
 * `LawData` — a surface that publishes a verdict must never see less than the index.
 *
 * `LAW_WIRE` and `BILL_WIRE` classify EVERY field of `LawData` / `LawBillView` as
 * `public` or `internal` under `satisfies Record<keyof …, …>`, so a field added to
 * either type FAILS TO COMPILE until someone decides whether the wire carries it.
 * The public halves are then `Pick`ed from those tables, so the mappers cannot drift
 * either — omitting a `public` field is a type error.
 *
 * ── The four MEASURED fields ────────────────────────────────────────────────
 * `hasForensic` / `hasParagraphDiff` / `hasCommittees` / `amendedLawRefs` are the one
 * place this file adds rather than narrows, and each replaces an `internal` field the
 * browser only ever MEASURED (`b.forensic != null`, `.length > 0`, `l.ref`). Shipping
 * a 7 kB verdict so a button can decide whether to render is the whole defect. The
 * `mpsWithoutTiesCount` field on /penize's wire is the same move.
 */

import type { LawBillView, LawData } from "./getLawData";

/**
 * Field-by-field classification of a bill for the /zakony INDEX.
 *
 * `public` = something `BillBrowser`, `ForensicIndexSection` or `DependencyRadar`
 * filters, searches, sorts, links or renders.
 * `internal` = evidence `/zakony/[cislo]` renders in full; it stays on `LawBillView`
 * and never leaves the server on this route.
 */
export const BILL_WIRE = {
  // rendered / linked / searched
  tiskId: "public", // row key, and the /zakony/[cislo] fallback label for a print with no cislo
  cislo: "public", // the dossier address
  title: "public",
  summary: "public", // the derived „co to mění" line — the row's headline
  origin: "public", // the origin filter and its counts
  flaggedConflict: "public", // a facet AND a row badge

  // Measured, never rendered — see the four derived fields on `PublicLawBill`.
  amendedLaws: "internal", // only `ref` (search) and `length` (count) reach the reader
  committees: "internal", // only `length > 0` (facet)
  paragraphDiffs: "internal", // only `length > 0` (facet + badge)
  forensic: "internal", // only `!= null` (facet + badge); the index reads `LawData.forensicIndex`

  // The dossier's own evidence. None of it renders on the index.
  summarySource: "internal",
  submitter: "internal",
  sponsors: "internal",
  rapporteurs: "internal",
  speakers: "internal",
  amendmentAuthors: "internal",
  stav: "internal",
  fateSb: "internal",
  fatePublishedOn: "internal",
  sponsorMinContribution: "internal",
  sponsorContractCzk: "internal",
  sponsorMoneyCompanies: "internal",
  amendedLawsFull: "internal",
  amendsUndercount: "internal",
  sectorAttributionFlags: "internal",
} as const satisfies Record<keyof LawBillView, "public" | "internal">;

type PublicBillKey = {
  [K in keyof typeof BILL_WIRE]: (typeof BILL_WIRE)[K] extends "public" ? K : never;
}[keyof typeof BILL_WIRE];

/** A bill as the /zakony client components see it: the narrowing of `LawBillView`
 *  plus the four measurements that stand in for the heavy fields above. */
export type PublicLawBill = Pick<LawBillView, PublicBillKey> & {
  /** `amendedLaws.map(l => l.ref)` — the browser searches these and counts them; the
   *  node label and e-Sbírka title beside each ref render only on the dossier. */
  amendedLawRefs: string[];
  hasForensic: boolean;
  hasParagraphDiff: boolean;
  hasCommittees: boolean;
};

/**
 * Field-by-field classification of the /zakony payload itself.
 *
 * `internal` here is never „unimportant": `forensicCount` and `forensicWithheldCount`
 * ARE rendered — by /dashboard, off the full shape — and the index renders the same
 * two facts out of `forensicIndex` (`verdictCount`, `withheldVerdictCount`), which is
 * the aggregation that owns them. Two paths to one number is how two numbers appear.
 */
export const LAW_WIRE = {
  bills: "public", // narrowed per element — see BILL_WIRE
  topLaws: "public", // §02 (capped, see TOP_LAWS_RENDERED)
  originCounts: "public",
  totalBills: "public",
  totalLaws: "public",
  totalAmends: "public",
  flaggedCount: "public",
  forensicIndex: "public", // the §03 register — a pure aggregation, already server-derived
  summaryCount: "public",
  paragraphDiffCount: "public",
  committeeRoutedBills: "public",
  censusBillCount: "public",
  censusUndercountTotal: "public",
  pass: "public",

  // Rendered by /dashboard off the full shape; the index reads `forensicIndex` instead.
  forensicCount: "internal",
  forensicWithheldCount: "internal",
  // Computed for a surface that does not exist yet — no render site anywhere today.
  sectorAttributionBillCount: "internal",
  sectorAttributionFlagCount: "internal",
} as const satisfies Record<keyof LawData, "public" | "internal">;

type PublicLawKey = {
  [K in keyof typeof LAW_WIRE]: (typeof LAW_WIRE)[K] extends "public" ? K : never;
}[keyof typeof LAW_WIRE];

/**
 * How many most-amended statutes §02 draws. Exported so the SERVER cuts the list and
 * the component's own slice reads the same constant — a cap declared in two places is
 * a cap that drifts, and the honest total is `totalLaws`, which ships regardless.
 */
export const TOP_LAWS_RENDERED = 20;

/** What `/zakony` ships. Everything `LawData` marks `public`, with `bills` narrowed. */
export interface LawWatchWire extends Omit<Pick<LawData, PublicLawKey>, "bills"> {
  bills: PublicLawBill[];
}

/** The `public` halves as runtime lists — the colocated test holds the mappers to
 *  exactly these sets, so the tables above cannot become comments that lie about
 *  what ships. */
export const PUBLIC_BILL_KEYS: readonly PublicBillKey[] = Object.entries(BILL_WIRE)
  .filter(([, v]) => v === "public")
  .map(([k]) => k as PublicBillKey);

export const PUBLIC_LAW_KEYS: readonly PublicLawKey[] = Object.entries(LAW_WIRE)
  .filter(([, v]) => v === "public")
  .map(([k]) => k as PublicLawKey);

/** The four measured fields, as a runtime list — pinned by the test beside the keys
 *  they stand in for, so a measurement can never quietly become a second payload. */
export const DERIVED_BILL_KEYS = ["amendedLawRefs", "hasForensic", "hasParagraphDiff", "hasCommittees"] as const;

export function toPublicBill(b: LawBillView): PublicLawBill {
  return {
    tiskId: b.tiskId,
    cislo: b.cislo,
    title: b.title,
    summary: b.summary,
    origin: b.origin,
    flaggedConflict: b.flaggedConflict,
    amendedLawRefs: b.amendedLaws.map((l) => l.ref),
    hasForensic: b.forensic !== null,
    hasParagraphDiff: b.paragraphDiffs.length > 0,
    hasCommittees: b.committees.length > 0,
  };
}

/**
 * `LawData` → the /zakony wire. Pure; the route applies it between the loader and the
 * client component, so every other consumer of `getLawData()` keeps the full shape.
 */
export function toLawWatchWire(data: LawData): LawWatchWire {
  return {
    bills: data.bills.map(toPublicBill),
    topLaws: data.topLaws.slice(0, TOP_LAWS_RENDERED),
    originCounts: data.originCounts,
    totalBills: data.totalBills,
    totalLaws: data.totalLaws,
    totalAmends: data.totalAmends,
    flaggedCount: data.flaggedCount,
    forensicIndex: data.forensicIndex,
    summaryCount: data.summaryCount,
    paragraphDiffCount: data.paragraphDiffCount,
    committeeRoutedBills: data.committeeRoutedBills,
    censusBillCount: data.censusBillCount,
    censusUndercountTotal: data.censusUndercountTotal,
    pass: data.pass,
  };
}
