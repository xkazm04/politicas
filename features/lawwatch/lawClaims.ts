/*
 * ZÁKONNÉ ČÍSLO JAKO CITACE — slovník hodnotových claimů /zakony.
 *
 * Peněžní figura má trvalou adresu od 2026-08-04 (features/money/moneyClaims.ts)
 * a příspěvkový index taky (features/civicscore/scoreClaim.ts). Zákonná vrstva
 * neměla ani jednu: /zakony vydávalo „posudek nese 141 ze 141 tisků" a
 * /zakony/predpis/<slug> čtyři čísla pokrytí, a /overeni — brána, která citace
 * ověřuje — neměla na téhle ploše co ověřovat.
 *
 * Čistý modul (žádný server, žádné I/O) ze stejného důvodu jako u peněz a indexu:
 * claim razí PLOCHA i BRÁNA a obě musí složit bajtově týž ref. Kdyby si ho každá
 * skládala po svém, ověření by selhalo na překlepu a vypadalo jako „figuru
 * neznáme".
 *
 * PRAVIDLA
 *  1. RAZÍ SE TO, CO SE VYKRESLUJE. Metrika pojmenovává přesně tu veličinu,
 *     kterou má čtenář před očima — číslo posudků v rejstříku, jednotlivé
 *     dlaždice pokrytí předpisu. Každá dlaždice je VLASTNÍ metrika: „tisků ve
 *     stopě" a „vyhlášeno ve Sbírce" jsou dvě různá tvrzení, ne dva pohledy na
 *     jedno (týž důvod, proč má rozdělení peněz dvě metriky, ne jednu).
 *  2. ZÁKLAD ODVOZENÍ JDE Z KORPUSOVÉHO AGREGÁTU. `forensicIndex.uniformPass` +
 *     `uniformRef`, tedy dvojice, na které se shodne KAŽDÝ posudek — nikdy
 *     `LawData.pass` (to je maximum `firstSeenPass` uzlů tisků, úplně jiné
 *     číslo) a nikdy průchod jednoho posudku. Půl korpusu přepsaného novým
 *     průchodem nemá jeden základ; claim, který by si nějaký vybral, by tvrdil
 *     víc, než data nesou, a brána by hlásila `moved/basis` bez příčiny.
 *  3. STAV BRÁNY JE SOUČÁST TVRZENÍ, a tady se obě rodiny liší:
 *     • census posudků je `pending` — všech 141 verdiktů je v grafu uloženo
 *       `pending_review` a jejich podpisovou cestou je /dukazy. „Ungated" by
 *       popřelo bránu, která existuje a je prázdná.
 *     • pokrytí předpisu je `ungated` — je to aritmetika censu (kolik tisků,
 *       kolik §, kolik doložených změn). Pro počítání žádná brána není a věta
 *       „čeká na kontrolu" by slibovala kontrolu, kterou nikdo nechystá.
 *  4. PŘEDMĚT, KTERÝ NEJDE KANONICKY SLOŽIT, CLAIM NEDOSTANE. Ref je adresa;
 *     rozbitá adresa je horší než žádná (odmítavá disciplína ze
 *     sectorAttribution.ts a features/dashboard/entityLinks.ts).
 */

import { makeClaimRef, type Claim } from "@/lib/claims/claim";
import { lawNodeId } from "./statuteRef";

/** Dataset ve slovníku SourceNote — dva rejstříky, ze kterých zákonná vrstva
 *  čte. Je součástí refu, takže je FIXNÍ: verze výpočtu se nese v `derivation`,
 *  nikdy v datasetu (jinak by každý průchod zneplatnil všechny vydané adresy). */
export const LAW_CLAIM_DATASET = "psp.cz tisky ⋈ e-Sbírka";

/** Strojové názvy veličin. Ref je adresa: metrika říká, ČEHO se číslo týká. */
export const LAW_METRIC = {
  /** Kolik tisků korpusu nese forenzní posudek — komorové číslo bez předmětu. */
  forensicCensus: "forenzni-posudky",
  /** Dlaždice pokrytí jednoho předpisu (/zakony/predpis/<slug>). */
  statuteTrailBills: "novely-predpisu",
  statuteEnactedBills: "vyhlasene-novely-predpisu",
  statuteParagraphs: "paragrafy-se-stopou",
  statuteChanges: "dolozene-zmeny-fragmentu",
} as const;

export type LawMetric = (typeof LAW_METRIC)[keyof typeof LAW_METRIC];

/** Jedna vydaná zákonná figura: claim + hodnota, jak ji plocha sází. */
export interface LawFigure {
  claim: Claim;
  value: number;
}

/** Předmět claimu předpisu — id uzlu v grafu (`law:sb:586-1992`), ne rekonstrukce
 *  veřejné cesty. Null pro ref, který nejde kanonicky složit (pravidlo 4). */
export const statuteSubject = (ref: string): string | null => lawNodeId(ref);

/* ── Census forenzních posudků (komorové číslo, /zakony §03) ───────────────── */

/** Provenienční agregát korpusu posudků — přesně ta tři pole, která
 *  `ForensicIndexView` počítá s pravidlem „jen když se shodne CELÝ korpus".
 *  Strukturální typ, aby modul zůstal nezávislý na loaderu. */
export interface ForensicCensusBasis {
  uniformPass: number | null;
  uniformRef: string | null;
  uniformComputedAt: string | null;
}

/** `<ref výpočtu>@<průchod>` (např. `law-forensics@55`), nebo null, když korpus
 *  nemá jeden základ (pravidlo 2). Chybějící základ netvrdí nic — a to je
 *  poctivý stav, ne mezera. */
export function forensicCensusDerivation(basis: ForensicCensusBasis): string | null {
  if (basis.uniformRef === null || basis.uniformPass === null) return null;
  return `${basis.uniformRef}@${basis.uniformPass}`;
}

/** Den zápisu posudků (`YYYY-MM-DD`) z jednoho okamžiku, na kterém se shodne celý
 *  korpus. Graf nese ISO okamžik; claim nese DEN — den je to, co se dá citovat.
 *  Nečitelný tvar se raději vynechá, než aby se dopočítával. */
export function forensicCensusRetrievedAt(basis: ForensicCensusBasis): string | null {
  if (basis.uniformComputedAt === null) return null;
  const day = basis.uniformComputedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Uzavřenost censu: kolik tisků korpusu nese posudek. Komorové tvrzení, takže
 * ref je TŘÍSEGMENTOVÝ (bez předmětu) — grammar lib/claims/claim.ts.
 *
 * `verdictCount` se předává tak, jak ho nese rejstřík; modul nic nepočítá.
 * Kdyby počítal, byla by to druhá agregace vedle features/lawwatch/forensicIndex.ts.
 */
export function forensicCensusClaim(verdictCount: number, basis: ForensicCensusBasis): LawFigure {
  const derivation = forensicCensusDerivation(basis);
  const retrievedAt = forensicCensusRetrievedAt(basis);
  return {
    claim: {
      ref: makeClaimRef({ dataset: LAW_CLAIM_DATASET, metric: LAW_METRIC.forensicCensus }),
      dataset: LAW_CLAIM_DATASET,
      metric: LAW_METRIC.forensicCensus,
      unit: "tisků",
      // Posudky čekají na podpis lidské brány (/dukazy) — pravidlo 3.
      reviewStatus: "pending",
      ...(retrievedAt !== null && { retrievedAt }),
      ...(derivation !== null && { derivation }),
    },
    value: verdictCount,
  };
}

/* ── Pokrytí jednoho předpisu (/zakony/predpis/<slug>) ─────────────────────── */

/** Která dlaždice pokrytí — jména jsou zároveň jména polí `StatuteCoverage`,
 *  takže se metrika a hodnota nemůžou rozejít. */
export type StatuteCoverageMetric = "trailBills" | "enactedBills" | "paragraphs" | "changes";

/** Strukturální podmnožina `StatuteCoverage` (deriveStatuteDossier.ts). */
export interface StatuteCoverageCounts {
  trailBills: number;
  enactedBills: number;
  paragraphs: number;
  changes: number;
}

const COVERAGE_METRIC: Record<StatuteCoverageMetric, LawMetric> = {
  trailBills: LAW_METRIC.statuteTrailBills,
  enactedBills: LAW_METRIC.statuteEnactedBills,
  paragraphs: LAW_METRIC.statuteParagraphs,
  changes: LAW_METRIC.statuteChanges,
};

const COVERAGE_UNIT: Record<StatuteCoverageMetric, string> = {
  trailBills: "tisků",
  enactedBills: "tisků",
  paragraphs: "§",
  changes: "změn",
};

/** Hodnota dlaždice — JEDNO místo, kde se metrika páruje s polem pokrytí.
 *  Plocha i brána čtou tuhle funkci, takže citované číslo je vždycky to,
 *  které dlaždice vysázela. */
export function statuteCoverageValue(
  coverage: StatuteCoverageCounts,
  metric: StatuteCoverageMetric,
): number {
  return coverage[metric];
}

/**
 * Claim nad jednou dlaždicí pokrytí předpisu. Null, když ref předpisu nejde
 * kanonicky složit — takový předpis nemá adresu, a citace bez adresy není
 * citace (pravidlo 4).
 */
export function statuteCoverageClaim(
  ref: string,
  metric: StatuteCoverageMetric,
  coverage: StatuteCoverageCounts,
): LawFigure | null {
  const subject = statuteSubject(ref);
  if (subject === null) return null;
  const m = COVERAGE_METRIC[metric];
  return {
    claim: {
      ref: makeClaimRef({ dataset: LAW_CLAIM_DATASET, metric: m, subject }),
      dataset: LAW_CLAIM_DATASET,
      metric: m,
      unit: COVERAGE_UNIT[metric],
      subject,
      // Aritmetika censu — lidskou branou neprochází (pravidlo 3).
      reviewStatus: "ungated",
    },
    value: statuteCoverageValue(coverage, metric),
  };
}
