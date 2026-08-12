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
 *
 * ── DVA ZÁZNAMY O TOM, CO SE TU RAZÍ A CO NE ────────────────────────────────
 *
 * JISTOTA POSUDKU (2026-08-12). Claim nad jistotou jednoho posudku byl odložen
 * a ten odklad byl zapsán JEN v CLAUDE.md — tedy nikde, kde by ho někdo hledal.
 * Teď existuje (`forensicConfidenceClaim`) a nese vlastní upřesnění pravidla 2:
 * základ odvození jde z PROVENIENCE TOHO POSUDKU (`forensic_provenance.ref@pass`),
 * ne z korpusového agregátu. Pravidlo 2 zakazuje průchod jednoho posudku pro
 * tvrzení O CELKU — tam by výběr jednoho z mnoha lhal o celku. Tvrzení o JEDNOM
 * tisku ale žádný korpusový základ nemá: měřeno na uloženém grafu (záloha
 * pass 55) nese ref „law-forensics" všech 141 posudků, ale průchodů je 14
 * různých (12 … 55), takže `uniformPass` je null a korpusový základ neexistuje.
 * Vzít ho by znamenalo buď nepsat základ vůbec, nebo psát průchod, který ten
 * konkrétní posudek nenapsal.
 *
 * `sponsorContractCzk` SE NERAZÍ, A NIKDY RAZIT NEBUDE. Uložené číslo na uzlu
 * tisku (`sponsor_contract_czk`) sčítá VŠECHNY firmy, ke kterým je předkladatel
 * v grafu vázán — včetně institucí, kde má jen správní roli — a bere nejvyšší
 * případ mezi předkladateli. /penize peníze instituce připisuje instituci,
 * nikdy poslanci. Trvalá adresa by z volnějšího pravidla udělala citovatelnou
 * figuru, kterou by peněžní modul pro tutéž osobu nikdy nepotvrdil; ověření by
 * pak hlásilo `moved` u čísla, které se nepohnulo. Věta o rozdílu pravidel
 * stojí u toho čísla na ploše (`detail.conflictAttribution`) — a tam zůstane.
 */

import { makeClaimRef, type Claim } from "@/lib/claims/claim";
import { billNodeId } from "./billRef";
import { lawNodeId } from "./statuteRef";

/** Dataset ve slovníku SourceNote — dva rejstříky, ze kterých zákonná vrstva
 *  čte. Je součástí refu, takže je FIXNÍ: verze výpočtu se nese v `derivation`,
 *  nikdy v datasetu (jinak by každý průchod zneplatnil všechny vydané adresy). */
export const LAW_CLAIM_DATASET = "psp.cz tisky ⋈ e-Sbírka";

/** Strojové názvy veličin. Ref je adresa: metrika říká, ČEHO se číslo týká. */
export const LAW_METRIC = {
  /** Kolik tisků korpusu nese forenzní posudek — komorové číslo bez předmětu. */
  forensicCensus: "forenzni-posudky",
  /** Jistota JEDNOHO posudku na stupnici 1–5 (/zakony/<cislo>). */
  forensicConfidence: "posudek-jistota",
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

/** Graf nese ISO okamžik; claim nese DEN — den je to, co se dá citovat.
 *  Nečitelný tvar se raději vynechá, než aby se dopočítával. JEDNA implementace
 *  pro obě rodiny posudků: dvě by se rozešly v tom, co ještě je datum. */
function isoDay(instant: string | null): string | null {
  if (instant === null) return null;
  const day = instant.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Den zápisu posudků (`YYYY-MM-DD`) z jednoho okamžiku, na kterém se shodne celý
 *  korpus. */
export function forensicCensusRetrievedAt(basis: ForensicCensusBasis): string | null {
  return isoDay(basis.uniformComputedAt);
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

/* ── Jistota jednoho posudku (/zakony/<cislo>) ─────────────────────────────── */

/** Horní mez stupnice jistoty. Plocha sází „4/5" a claim nese jednotku „z 5" —
 *  obojí z tohohle jednoho čísla, aby viditelná stupnice a citovaná jednotka
 *  nemohly tvrdit každá jiný rozsah. */
export const FORENSIC_CONFIDENCE_SCALE = 5;

/** Provenience JEDNOHO posudku — přesně ta tři pole, která `LawForensicView`
 *  čte z `forensic_provenance`. Strukturální typ (jako `ForensicCensusBasis`),
 *  aby modul zůstal nezávislý na loaderu. */
export interface ForensicVerdictBasis {
  pass: number | null;
  provenanceRef: string | null;
  computedAt: string | null;
}

/** `<ref výpočtu>@<průchod>` toho posudku (např. `law-forensics@15`), nebo null.
 *  Chybějící pole nenese nic — a nenapsaný základ je poctivější než základ
 *  půjčený od korpusu, který tenhle posudek nenapsal (viz hlavička). */
export function forensicConfidenceDerivation(basis: ForensicVerdictBasis): string | null {
  if (basis.provenanceRef === null || basis.pass === null) return null;
  return `${basis.provenanceRef}@${basis.pass}`;
}

/** Den zápisu TOHOTO posudku (`YYYY-MM-DD`). */
export function forensicConfidenceRetrievedAt(basis: ForensicVerdictBasis): string | null {
  return isoDay(basis.computedAt);
}

/**
 * Claim nad jistotou jednoho posudku. Null, když předmět nejde kanonicky složit
 * (pravidlo 4 — `tiskId 0` je fallback nepřečteného id uzlu, ne adresa) nebo
 * když hodnota není konečné číslo (pomlčka nesmí svědčit — `CitableNumber`
 * v tom případě atributy nevydá vůbec, a claim bez hodnoty není citace).
 *
 * Stav brány je `pending`, ne `ungated`: verdikty jsou v grafu uloženy
 * `pending_review` a jejich podpisovou cestou je /dukazy — týž argument
 * pravidla 3, jaký nese census. Jistota není aritmetika censu, je to údaj
 * uvnitř posudku, který na podpis teprve čeká.
 */
export function forensicConfidenceClaim(
  tiskId: number,
  confidence: number,
  basis: ForensicVerdictBasis,
): LawFigure | null {
  const subject = billNodeId(tiskId);
  if (subject === null) return null;
  if (!Number.isFinite(confidence)) return null;
  const derivation = forensicConfidenceDerivation(basis);
  const retrievedAt = forensicConfidenceRetrievedAt(basis);
  return {
    claim: {
      ref: makeClaimRef({
        dataset: LAW_CLAIM_DATASET,
        metric: LAW_METRIC.forensicConfidence,
        subject,
      }),
      dataset: LAW_CLAIM_DATASET,
      metric: LAW_METRIC.forensicConfidence,
      unit: `z ${FORENSIC_CONFIDENCE_SCALE}`,
      subject,
      reviewStatus: "pending",
      ...(retrievedAt !== null && { retrievedAt }),
      ...(derivation !== null && { derivation }),
    },
    value: confidence,
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
