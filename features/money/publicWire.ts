/**
 * THE PUBLIC WIRE — what /penize actually ships to a browser.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * `getMoneyData()` hands the ledger 211 ties × 38 fields. `TiesLedger` renders
 * fifteen of them. The other twenty-three crossed the network on every request:
 * analyst prose (`reviewerNote`, on 211/211 ties), the corroboration provenance
 * capsule and its source URL, the human-review note and last-decision trio, the
 * owner stake, the prior-term note, the signal/tier internals. Measured on the live
 * store the four heaviest of them alone — `corroborationProvenance` 31 917 B,
 * `source` 29 711 B, `reviewerNote` 28 900 B, `corroborationSource` 17 423 B — are
 * 108 KB of a 337 KB payload, none of it rendered on this page.
 *
 * ── Why a PROJECTION and not a second shape ─────────────────────────────────
 * The console and the per-MP case file keep the FULL `MoneyTie`: they render that
 * evidence, and a surface that decides a tie must never see less than the public
 * does (memory/two-mappers-over-one-edge-starve-the-decider.md). So this is a
 * narrowing of the shared shape, derived FROM it — never a parallel declaration.
 *
 * `TIE_WIRE` classifies EVERY `MoneyTie` field as `public` or `internal`, and the
 * `satisfies Record<keyof MoneyTie, …>` makes that exhaustive: a field added to
 * `MoneyTie` fails to compile until someone decides whether the public wire carries
 * it. `PublicMoneyTie` is then `Pick`ed from that classification, so the mapper below
 * cannot drift from it either — omitting a `public` field is a type error.
 */

import type { MoneyData, MoneyMp, MoneyMpStub, MoneyTie } from "./moneyTypes";
import type { ReachableTie } from "./reachableMoney";

/**
 * Field-by-field classification of the tie for the /penize list page.
 *
 * `public` = something `TiesLedger` filters, sorts, renders or links by.
 * `internal` = evidence the CASE FILE and the REVIEW CONSOLE render in full; it stays
 * on `MoneyTie` and never leaves the server on this route.
 */
export const TIE_WIRE = {
  // rendered / linked
  companyId: "public", // row key + the per-company de-duplication in `tieReach`
  receiptRef: "public", // the /zdroj citation link on every row
  ico: "public", // shown, searched, and the /penize/firma/<ico> link
  company: "public",
  reviewState: "public",
  tieClass: "public",
  tieClassOrigin: "public", // a guessed class may not read like a recorded one
  // `tieReach()` inputs — the row's „dosah" cell AND its sort key. Do 2026-08-12
  // sem patřily i `contractCount` a `donatedToPartyCzk` pod TOUTO větou, a ta o obou
  // LHALA: `reachableMoney.ts` je nečte ani v jedné ze dvou funkcí, které dosah
  // počítají (`bucketReachCzk` = contractCzk + subsidiesCzk; `tieReach` sčítá jednu
  // vazbu touž cestou). Klasifikace, která pojmenuje nepravdivé místo renderu, je
  // horší než žádná — přesně proto tahle tabulka existuje.
  contractCzk: "public",
  subsidiesCzk: "public",
  /** RENDERUJE SE: podřádek „{count} smluv" pod buňkou dosahu (TiesLedger) — text,
   *  který `real.ledger.reachNote` čtenáři celou dobu sliboval („dosah = smlouvy
   *  z registru smluv … + dotace"), aniž by kniha ukázala, kolik těch smluv je. */
  contractCount: "public",
  // `temporalBadge()` inputs — the ARES-VR status badge + its filter
  corroboration: "public",
  temporalStatus: "public",
  roleValidTo: "public",
  // the default („evidence") sort key
  reviewRank: "public",

  // Evidence rendered by /penize/[pspId] and /penize/kontrola, not by the ledger.
  role: "internal",
  source: "internal",
  subsidiesCount: "internal",
  /** NIC NA /penize TOHLE ČÍSLO NEVYKRESLUJE. Kniha vazeb má sloupce poslanec ·
   *  firma · třída · stav · dosah a dar mezi nimi není; `money.real.ledger.donationLabel`
   *  sází spis poslance a spis firmy, ne tenhle seznam. Peněžní obrázek nad knihou má
   *  vlastní stranickou figuru v `MoneyGraphData.companies[].donatedToPartyCzk`, která
   *  jde jinou cestou (graph payload), takže překlasifikováním se z plochy neztrácí nic.
   *  `ReachableTie` pole DEKLARUJE, ale `tieReach` ho nečte — viz `reachInput` níž. */
  donatedToPartyCzk: "internal",
  donationRecipientParty: "internal",
  roleValidFrom: "internal",
  corroborationSource: "internal",
  corroborationProvenance: "internal",
  tieClassHeuristic: "internal",
  triangle: "internal",
  nearThresholdCount: "internal",
  deMinimis: "internal",
  signalScore: "internal",
  reviewTier: "internal",
  reviewOrderOrigin: "internal",
  reviewNote: "internal",
  reviewerNote: "internal",
  lastDecision: "internal",
  lastReviewer: "internal",
  lastReviewedAt: "internal",
  ownerStakePct: "internal",
  priorTerm: "internal",
  falseEdgeSuspected: "internal",
  flags: "internal",
} as const satisfies Record<keyof MoneyTie, "public" | "internal">;

type PublicTieKey = {
  [K in keyof typeof TIE_WIRE]: (typeof TIE_WIRE)[K] extends "public" ? K : never;
}[keyof typeof TIE_WIRE];

/** The tie as the /penize client components see it. A narrowing of `MoneyTie`. */
export type PublicMoneyTie = Pick<MoneyTie, PublicTieKey>;

/**
 * Veřejná vazba tak, jak ji chce vidět SDÍLENÁ peněžní aritmetika
 * (`reachableMoney.ts`) — jediné místo, kde se `donatedToPartyCzk` doplňuje.
 *
 * `ReachableTie` to pole DEKLARUJE, ale ani jedna z funkcí, které kniha vazeb volá,
 * ho NEČTE: `bucketReachCzk` je `contractCzk + subsidiesCzk` a `tieReach` je součet
 * nad jednovazbovou populací touž cestou. Dar vstupuje jen do BUCKETU
 * (`MoneyBucket.donatedToPartyCzk`), a ten se na /penize počítá na SERVERU (dlaždice
 * a výběr grafu), ne v prohlížeči. `null` tady proto není dosazená hodnota, ale
 * NEPŘÍTOMNOST pole, které aritmetika nekonzultuje — a připíná to test, který stejnou
 * vazbu s darem a bez daru prožene `tieReach` a porovná koruny.
 */
export function reachInput<T extends Omit<ReachableTie, "donatedToPartyCzk">>(
  tie: T,
): T & ReachableTie {
  return { ...tie, donatedToPartyCzk: null };
}

/** An MP row on the ledger. `absenteeManagerLead`, `verifiedCount`, `pendingCount` and
 *  the two reach totals are the loader's own working values (the featured-graph
 *  selection rule, /dashboard) — the ledger renders none of them. */
export type PublicMoneyMp = Pick<MoneyMp, "pspId" | "name" | "club"> & {
  ties: PublicMoneyTie[];
};

/** MPs with no tie rendered as chips before the „+ N dalších" count. The ledger has
 *  never shown more than this; shipping all 144 stubs to render 36 is 108 rows of dead
 *  weight. Lives here, not in the component, because the SERVER does the cutting. */
export const LEDGER_CHIP_CAP = 36;

/** What `/penize` ships. Everything `MoneyData` carries except the two list fields,
 *  which are narrowed.
 *
 *  `stats` PROCHÁZÍ CELÉ a je to záměr, ne opomenutí: agregátní pás nahoře sází
 *  osm z jeho polí a `graph` + `pass` citují zbytek, takže tady není co ořezávat —
 *  a druhá klasifikační tabulka nad ~12 poli (z toho jedno vnořené `ReachableMoney`)
 *  by přidala místo, kde se dá zapomenout, ne ušetřené bajty. Nové pole `mandatesTotal`
 *  jede touž cestou: je to JMENOVATEL dlaždice „poslanci s vazbou", který se
 *  vykresluje (`money.real.stats.mpsSub`). Připíná to publicWire.test.ts. */
export interface MoneyLedgerData extends Omit<MoneyData, "mps" | "mpsWithoutTies"> {
  mps: PublicMoneyMp[];
  /** at most `LEDGER_CHIP_CAP` stubs — the ones that render. */
  mpsWithoutTies: MoneyMpStub[];
  /** the TRUE total, so the „+ N dalších" count stays honest after the cut. */
  mpsWithoutTiesCount: number;
}

/** The `public` half of `TIE_WIRE`, as a runtime list — the colocated test holds
 *  `toPublicTie` to exactly this set, so the classification above cannot become a
 *  comment that lies about what ships. */
export const PUBLIC_TIE_KEYS: readonly PublicTieKey[] = Object.entries(TIE_WIRE)
  .filter(([, v]) => v === "public")
  .map(([k]) => k as PublicTieKey);

export function toPublicTie(tie: MoneyTie): PublicMoneyTie {
  return {
    companyId: tie.companyId,
    receiptRef: tie.receiptRef,
    ico: tie.ico,
    company: tie.company,
    reviewState: tie.reviewState,
    tieClass: tie.tieClass,
    tieClassOrigin: tie.tieClassOrigin,
    contractCount: tie.contractCount,
    contractCzk: tie.contractCzk,
    subsidiesCzk: tie.subsidiesCzk,
    corroboration: tie.corroboration,
    temporalStatus: tie.temporalStatus,
    roleValidTo: tie.roleValidTo,
    reviewRank: tie.reviewRank,
  };
}

/** `MoneyData` → the /penize wire. Pure; the route applies it between the loader and
 *  the client component, so every other consumer of `getMoneyData()` (/dashboard,
 *  /denik) keeps the full shape. */
export function toLedgerData(data: MoneyData): MoneyLedgerData {
  const { mps, mpsWithoutTies, ...rest } = data;
  return {
    ...rest,
    mps: mps.map((mp) => ({
      pspId: mp.pspId,
      name: mp.name,
      club: mp.club,
      ties: mp.ties.map(toPublicTie),
    })),
    mpsWithoutTies: mpsWithoutTies.slice(0, LEDGER_CHIP_CAP),
    mpsWithoutTiesCount: mpsWithoutTies.length,
  };
}
