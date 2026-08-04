/*
 * PENĚŽNÍ ČÍSLO JAKO CITACE — slovník hodnotových claimů /penize.
 *
 * Novinář necituje „vazba existuje", ale ČÍSLO: „firma X dostala 412 mil. Kč".
 * Do 2026-08-04 měla každá vazba trvalou adresu (`receiptRef` → /zdroj/…), ale
 * částka vedle ní žádnou — /overeni tedy uměla ověřit existenci hrany a ne
 * tvrzení, které se opisuje do článku.
 *
 * Tenhle modul je JEDINÉ místo, kde se peněžní figuře razí claim. Čistý (žádný
 * server, žádný store) právě proto, že ho musí sdílet obě strany rovnice:
 *   • plocha, která číslo vydává (kniha vazeb, spis poslance, spis firmy),
 *   • brána, která ho znovu odvozuje (features/overeni/liveFigures.ts).
 * Kdyby si každá strana skládala ref po svém, ověření by selhalo na překlepu
 * a vypadalo jako „figuru neznáme".
 *
 * PRAVIDLA
 *  1. HODNOTA JDE ZE SDÍLENÉ ARITMETIKY. Nic se tu nesčítá — `tieReach` a
 *     `bucketReachCzk` (features/money/reachableMoney.ts) jsou jediná definice
 *     dosažitelných peněz a razí se přesně jejich výsledek. Claim na jinak
 *     spočítané číslo by byl pátý součet v knize, která si jich čtyři už
 *     jednou vypěstovala.
 *  2. RAZÍ SE TO, CO SE VYKRESLUJE. Metrika pojmenovává přesně tu veličinu,
 *     kterou plocha ukazuje (dlaždice spisu poslance sází contractCzk té
 *     třídy, spis firmy dosah) — citace se nesmí týkat jiného čísla, než jaké
 *     má čtenář před očima.
 *  3. STAV BRÁNY JE SOUČÁST TVRZENÍ. `review_state` je terminální a zamítnutá
 *     vazba v grafu zůstává; claim proto nese `verified | pending | rejected`
 *     doslova, ne dvouhodnotové zjednodušení.
 *  4. AGREGÁT JE OVĚŘENÝ, JEN KDYŽ JSOU OVĚŘENÉ VŠECHNY JEHO VAZBY. Součet přes
 *     jednu potvrzenou a čtyři nezkontrolované vazby potvrzený není.
 */

import { makeClaimRef, type Claim, type ClaimReviewStatus } from "@/lib/claims/claim";
import type { ReviewState } from "./reviewTypes";
import { bucketReachCzk, tieReach, type MoneyBucket, type ReachableTie } from "./reachableMoney";

/** Dataset v slovníku SourceNote — týž řetězec, jaký nesou `MoneyMpDetail.source`
 *  a `MoneyCompanyDetail.source`. Je součástí refu, takže je fixní. */
export const MONEY_CLAIM_DATASET = "registr smluv ⋈ ares ⋈ hlídač státu";

/** Strojové názvy veličin. Ref je adresa: metrika říká, ČEHO se číslo týká. */
export const MONEY_METRIC = {
  /** Dosah JEDNÉ vazby (smlouvy + dotace firmy) — buňka „dosah" v knize vazeb. */
  tieReach: "dosah-vazby",
  /** Σ hodnot smluv firem, které poslanec vlastní nebo řídí (dlaždice spisu). */
  mpOwned: "smlouvy-firem-poslance",
  /** Σ hodnot smluv institucí, kde poslanec jen zasedá v orgánu (dlaždice spisu). */
  mpSteward: "smlouvy-instituci-poslance",
  /** Dosah jedné firmy — headline spisu firmy. */
  companyReach: "dosah-firmy",
} as const;

export type MoneyMetric = (typeof MONEY_METRIC)[keyof typeof MONEY_METRIC];

/** Metriky, které tenhle modul vydává — brána podle nich pozná, že ref má
 *  poslat do peněžních loaderů, a ne do rejstříku vzorkových figur. */
export const MONEY_METRICS: readonly string[] = Object.values(MONEY_METRIC);

/** Předmět claimu pro uzel osoby — id grafu, ne rekonstrukce adresy účtenky;
 *  brána ho čte zpátky přes `pspIdFromEntityId` (jediný vlastník tvaru id). */
export const personSubject = (pspId: number): string => `psp:person:${pspId}`;

/** Předmět claimu pro uzel firmy. IČO se předává tak, jak ho nese id uzlu. */
export const companySubject = (ico: string): string => `company:ico:${ico}`;

/** Základ odvození: graf žádné datum sběru peněžní vrstvy nenese, nese PRŮCHOD.
 *  Píše se do claimu, aby citace uměla říct, který výpočet ji napsal. */
export const moneyDerivation = (pass: number): string => `kg-pass:${pass}`;

/** Stav lidské brány pro JEDNU vazbu — doslova, včetně zamítnutí (pravidlo 3). */
export function tieClaimStatus(state: ReviewState): ClaimReviewStatus {
  return state === "verified" ? "verified" : state === "rejected" ? "rejected" : "pending";
}

/** Stav brány pro AGREGÁT (pravidlo 4): ověřeno jen tehdy, když je ověřená
 *  každá vazba, ze které se číslo skládá; prázdný agregát tvrdí „pending". */
export function aggregateClaimStatus(states: readonly ReviewState[]): ClaimReviewStatus {
  if (states.length === 0) return "pending";
  return states.every((s) => s === "verified") ? "verified" : "pending";
}

/** Jedna vydaná peněžní figura: claim + hodnota, jak ji plocha sází. */
export interface MoneyFigure {
  claim: Claim;
  value: number;
}

const money = (
  metric: MoneyMetric,
  subject: string,
  value: number,
  pass: number,
  reviewStatus: ClaimReviewStatus,
): MoneyFigure => ({
  claim: {
    ref: makeClaimRef({ dataset: MONEY_CLAIM_DATASET, metric, subject }),
    dataset: MONEY_CLAIM_DATASET,
    metric,
    unit: "Kč",
    subject,
    reviewStatus,
    derivation: moneyDerivation(pass),
  },
  value,
});

/** Vazba tak, jak ji claim potřebuje vidět: vstupy sdílené aritmetiky + adresa. */
export type ClaimableTie = ReachableTie & { receiptRef: string; reviewState: ReviewState };

/**
 * Dosah jedné vazby. Hodnota JE `tieReach(tie).czk` — táž funkce, kterou
 * kniha vazeb používá pro buňku i pro řadicí klíč. Předmětem claimu je
 * `receiptRef`, tedy adresa téže hrany, kterou vydává odkaz „účtenka":
 * jedno tvrzení, jedna adresa, dvě čtení (existence a hodnota).
 */
export function tieReachClaim(tie: ClaimableTie, pass: number): MoneyFigure {
  return money(
    MONEY_METRIC.tieReach,
    tie.receiptRef,
    tieReach(tie).czk,
    pass,
    tieClaimStatus(tie.reviewState),
  );
}

/** Dlaždice spisu poslance — Σ hodnot smluv jedné třídy vazeb (to, co se sází). */
export function mpBucketClaim(
  pspId: number,
  side: "owned" | "steward",
  bucket: MoneyBucket,
  states: readonly ReviewState[],
  pass: number,
): MoneyFigure {
  return money(
    side === "owned" ? MONEY_METRIC.mpOwned : MONEY_METRIC.mpSteward,
    personSubject(pspId),
    bucket.contractCzk,
    pass,
    aggregateClaimStatus(states),
  );
}

/** Headline spisu firmy — dosah jedné firmy ze sdílené aritmetiky. */
export function companyReachClaim(
  ico: string,
  bucket: MoneyBucket,
  states: readonly ReviewState[],
  pass: number,
): MoneyFigure {
  return money(
    MONEY_METRIC.companyReach,
    companySubject(ico),
    bucketReachCzk(bucket),
    pass,
    aggregateClaimStatus(states),
  );
}
