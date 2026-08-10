// Server-only: DNEŠNÍ hodnota hodnotové figury — druhá strana rovnice pro
// claim-ref, který nevydala vzorková vrstva, ale živý graf.
//
// Rejstřík vydaných figur (lib/claims/registry.ts) je čistý modul nad vzorkovou
// vrstvou — tři figury /svedectvi. Peněžní čísla na /penize a příspěvkový index
// na /zebricek se ale odvozují ze STORE, takže se do statického rejstříku
// zapsat nedají: musely by se v něm buď zmrazit (a začít lhát), nebo je tam
// psát ručně (a rozejít se s tím, co plocha sází).
//
// PRAVIDLA (táž disciplína jako getVerdictData: brána sama nic neodvozuje)
//  1. ZNOVUODVOZENÍ JDE PŘES VLASTNICKÝ LOADER. `getMoneyMpDetail`,
//     `getCompanyDetail`, `getLeaderboardData`, `getLawData` — tytéž funkce,
//     které plní plochu. Žádný vlastní dotaz, žádná vlastní aritmetika.
//  2. CLAIM SE RAZÍ TÝMŽ MODULEM JAKO NA PLOŠE (features/money/moneyClaims.ts,
//     features/civicscore/scoreClaim.ts, features/lawwatch/lawClaims.ts).
//     Ověřovat by se jinak dalo jen to, co brána umí sama napsat.
//  3. DEGRADACE: nedostupný store → `unavailable` (nikdy „figuru neznáme" —
//     to by byla nepravda), záznam, který dnešní odvození nenese → `gone`.
//
// Import `server-only` udělá z importu v klientské komponentě build-time chybu.

import "server-only";
import { getStore } from "@/lib/db/store";
import type { ClaimRefParts } from "@/lib/claims/claim";
import type { IssuedFigure } from "@/lib/claims/registry";
import { decodeClaimRef } from "@/features/shared/provenance/claimRef";
import { icoFromEntityId, pspIdFromEntityId } from "@/features/shared/provenance/caseFileLink";
import { getMoneyMpDetail } from "@/features/money/getMpDetail";
import { getCompanyDetail } from "@/features/money/getCompanyDetail";
import {
  companyReachClaim,
  mpBucketClaim,
  tieReachClaim,
  MONEY_CLAIM_DATASET,
  MONEY_METRIC,
} from "@/features/money/moneyClaims";
import { isAttributable } from "@/features/money/reachableMoney";
import { getLeaderboardData } from "@/features/civicscore/getLeaderboardData";
import {
  contributionScoreClaim,
  SCORE_CLAIM_DATASET,
  SCORE_METRIC,
} from "@/features/civicscore/scoreClaim";
import { getLawData } from "@/features/lawwatch/getLawData";
import { deriveStatuteDossier } from "@/features/lawwatch/deriveStatuteDossier";
import {
  forensicCensusClaim,
  statuteCoverageClaim,
  LAW_CLAIM_DATASET,
  LAW_METRIC,
  type StatuteCoverageMetric,
} from "@/features/lawwatch/lawClaims";
import { refFromLawNodeId } from "@/features/lawwatch/statuteRef";

export type LiveFigureResult =
  /** Metrika není z živé rodiny — o figuře rozhodne rejstřík (nebo „mimo rejstřík"). */
  | { status: "not-live" }
  | { status: "unavailable" }
  | { status: "gone" }
  | { status: "ok"; figure: IssuedFigure };

/** Datasety, jejichž figury se odvozují ze store. Ref nese dataset i metriku,
 *  takže se rodina pozná bez hádání. */
const LIVE_DATASETS: ReadonlySet<string> = new Set([
  MONEY_CLAIM_DATASET,
  SCORE_CLAIM_DATASET,
  LAW_CLAIM_DATASET,
]);

export const isLiveClaim = (parts: ClaimRefParts): boolean => LIVE_DATASETS.has(parts.dataset);

/** ISO den pro meze věrohodnosti data podpisu — plocha ho také předává, nikdy
 *  se nečte uvnitř renderu (lib/analysis/plausible-date.ts). */
const todayIso = (): string => new Date().toISOString().slice(0, 10);

export async function resolveLiveFigure(parts: ClaimRefParts): Promise<LiveFigureResult> {
  if (!isLiveClaim(parts)) return { status: "not-live" };

  // Nedostupný store není verdikt o odkazu (pravidlo 3) — a rozpozná se DŘÍV,
  // než loader stačí vrátit null, ve kterém splývá selhání s neexistencí.
  const store = await getStore();
  if (!store) return { status: "unavailable" };

  // KOMOROVÁ figura předmět NEMÁ (třísegmentový ref, lib/claims/claim.ts) —
  // kontrola předmětu proto patří do větví, které ho potřebují. Když stála před
  // switchem, každé tvrzení o celku by dostalo „záznam nenalezen".
  if (parts.metric === LAW_METRIC.forensicCensus) return resolveForensicCensus();

  const subject = parts.subject;
  if (subject === undefined) return { status: "gone" };

  switch (parts.metric) {
    case MONEY_METRIC.tieReach:
      return resolveTieReach(subject);
    case MONEY_METRIC.mpOwned:
      return resolveMpBucket(subject, "owned");
    case MONEY_METRIC.mpSteward:
      return resolveMpBucket(subject, "steward");
    case MONEY_METRIC.companyReach:
      return resolveCompanyReach(subject);
    case SCORE_METRIC.contribution:
      return resolveContributionScore(subject);
    case LAW_METRIC.statuteTrailBills:
      return resolveStatuteCoverage(subject, "trailBills");
    case LAW_METRIC.statuteEnactedBills:
      return resolveStatuteCoverage(subject, "enactedBills");
    case LAW_METRIC.statuteParagraphs:
      return resolveStatuteCoverage(subject, "paragraphs");
    case LAW_METRIC.statuteChanges:
      return resolveStatuteCoverage(subject, "changes");
    default:
      return { status: "not-live" };
  }
}

// ── Peníze ──────────────────────────────────────────────────────────────────

/** Předmětem claimu vazby je JEJÍ ÚČTENKA (`h.<src>.<rel>.<dst>`) — jedno
 *  tvrzení, jedna adresa. Poslanec se z ní čte dekodérem adres, ne novým
 *  parserem, a vazba se pak hledá SHODOU refu: rekonstruovaný ref by mohl
 *  vypadat správně a ukazovat na jinou hranu. */
async function resolveTieReach(receiptRef: string): Promise<LiveFigureResult> {
  const ref = decodeClaimRef(receiptRef);
  if (!ref || ref.kind !== "edge") return { status: "gone" };
  const pspId = pspIdFromEntityId(ref.src);
  if (pspId === null) return { status: "gone" };

  const detail = await getMoneyMpDetail(pspId);
  if (!detail) return { status: "gone" };
  const tie = detail.ties.find((t) => t.receiptRef === receiptRef);
  if (!tie) return { status: "gone" };

  const { claim, value } = tieReachClaim(tie, detail.pass);
  return { status: "ok", figure: { claim, kind: "czkCompact", value, issuedAt: `/penize/${pspId}` } };
}

async function resolveMpBucket(subject: string, side: "owned" | "steward"): Promise<LiveFigureResult> {
  const pspId = pspIdFromEntityId(subject);
  if (pspId === null) return { status: "gone" };
  const detail = await getMoneyMpDetail(pspId);
  if (!detail) return { status: "gone" };

  const bucket = side === "owned" ? detail.money.attributable : detail.money.steward;
  const states = detail.ties
    .filter((t) => isAttributable(t.tieClass) === (side === "owned"))
    .map((t) => t.reviewState);
  const { claim, value } = mpBucketClaim(pspId, side, bucket, states, detail.pass);
  return { status: "ok", figure: { claim, kind: "czkCompact", value, issuedAt: `/penize/${pspId}` } };
}

async function resolveCompanyReach(subject: string): Promise<LiveFigureResult> {
  const ico = icoFromEntityId(subject);
  if (ico === null) return { status: "gone" };
  const detail = await getCompanyDetail(ico, todayIso());
  if (!detail) return { status: "gone" };

  // Táž volba strany rozdělení, jakou dělá spis firmy: jedna firma naplní právě
  // jeden košík a KTERÝ to je, je verdikt pravidla přiřazení.
  const bucket = detail.money.attributable.companies > 0 ? detail.money.attributable : detail.money.steward;
  const { claim, value } = companyReachClaim(
    detail.ico,
    bucket,
    detail.ties.map((t) => t.reviewState),
    detail.pass,
  );
  return {
    status: "ok",
    figure: { claim, kind: "czkCompact", value, issuedAt: `/penize/firma/${detail.ico}` },
  };
}

// ── Příspěvkový index ───────────────────────────────────────────────────────

/** Kompozit jednoho poslance z KOMOROVÉHO pohledu — týž `react.cache()`-ovaný
 *  loader, který sází /zebricek, včetně agregované provenience. Číslo se tu
 *  nepočítá: druhá implementace formule je přesně to, čemu se `CONTRIBUTION_
 *  FORMULA_REF` brání. */
async function resolveContributionScore(subject: string): Promise<LiveFigureResult> {
  const pspId = pspIdFromEntityId(subject);
  if (pspId === null) return { status: "gone" };

  const data = await getLeaderboardData();
  if (!data) return { status: "gone" };
  const entry = data.entries.find((e) => e.pspId === pspId);
  if (!entry) return { status: "gone" };

  const { claim, value } = contributionScoreClaim(pspId, entry.score, data.provenance);
  return { status: "ok", figure: { claim, kind: "dec", value, issuedAt: `/poslanec/${pspId}` } };
}

// ── Zákonná vrstva ──────────────────────────────────────────────────────────
//
// Obě rodiny jdou přes `getLawData()` — týž `react.cache()`-ovaný a napříč
// požadavky memoizovaný loader, který plní /zakony i dosjar předpisu. Brána tu
// nepočítá NIC: rejstřík posudků i pokrytí předpisu jsou hotové agregace
// (forensicIndex.ts, deriveStatuteDossier.ts) a claim razí týž modul jako plocha.
//
// DEGRADACE: `getLawData()` vrací null, když store chybí, když neprojde
// readiness gate nebo když čtení spadne — ve všech třech případech je TMAVÁ CELÁ
// VRSTVA, ne prázdný záznam. Odpověď je proto `unavailable`, ne „záznam
// nenalezen": ta druhá věta by o existujícím tisku lhala.

async function resolveForensicCensus(): Promise<LiveFigureResult> {
  const data = await getLawData();
  if (!data) return { status: "unavailable" };
  const fi = data.forensicIndex;
  // Korpus bez jediného posudku žádné takové tvrzení nevydal — „0 ze 141" je
  // stav evidence, ne citovatelná figura.
  if (fi.verdictCount === 0) return { status: "gone" };
  const { claim, value } = forensicCensusClaim(fi.verdictCount, fi);
  return { status: "ok", figure: { claim, kind: "int", value, issuedAt: "/zakony#posudky" } };
}

/** Předmětem je id uzlu předpisu (`law:sb:586-1992`); čte ho sdílený kodek adres
 *  předpisu, ne druhý parser. Nekanonický předmět je „záznam nenalezen" — adresa
 *  je naše, jen za ní žádný předpis nestojí. */
async function resolveStatuteCoverage(
  subject: string,
  metric: StatuteCoverageMetric,
): Promise<LiveFigureResult> {
  const ref = refFromLawNodeId(subject);
  if (ref === null) return { status: "gone" };

  const data = await getLawData();
  if (!data) return { status: "unavailable" };
  const dossier = deriveStatuteDossier(data, ref);
  if (!dossier) return { status: "gone" };

  const figure = statuteCoverageClaim(dossier.ref, metric, dossier.coverage);
  if (!figure) return { status: "gone" };
  return {
    status: "ok",
    figure: {
      claim: figure.claim,
      kind: "int",
      value: figure.value,
      issuedAt: `/zakony/predpis/${dossier.slug}`,
    },
  };
}
