// Zákonný claim je ADRESA — a adresu musí umět složit i rozložit obě strany
// rovnice (plocha, která číslo vydá, a brána, která ho znovu odvodí). Týž
// kontrakt, jaký drží features/money/moneyClaims.test.ts, plus dvě věci
// specifické pro zákonnou vrstvu: komorové tvrzení bez předmětu a dvojí stav
// brány (posudky čekají na /dukazy, aritmetika censu branou neprochází).

import { describe, expect, it } from "vitest";

import { claimStatus, parseClaimRef } from "@/lib/claims/claim";
import { detectRef } from "@/features/overeni/refDetect";
import {
  forensicCensusClaim,
  forensicCensusDerivation,
  forensicCensusRetrievedAt,
  forensicConfidenceClaim,
  forensicConfidenceDerivation,
  forensicConfidenceRetrievedAt,
  statuteCoverageClaim,
  statuteCoverageValue,
  FORENSIC_CONFIDENCE_SCALE,
  LAW_CLAIM_DATASET,
  LAW_METRIC,
  type ForensicCensusBasis,
  type ForensicVerdictBasis,
  type StatuteCoverageCounts,
} from "./lawClaims";
import { billNodeId, tiskIdFromBillNodeId } from "./billRef";
import { refFromLawNodeId } from "./statuteRef";

const basis = (over: Partial<ForensicCensusBasis> = {}): ForensicCensusBasis => ({
  uniformPass: 55,
  uniformRef: "law-forensics",
  uniformComputedAt: "2026-08-05T11:22:33.000Z",
  ...over,
});

const coverage = (over: Partial<StatuteCoverageCounts> = {}): StatuteCoverageCounts => ({
  trailBills: 7,
  enactedBills: 4,
  paragraphs: 3,
  changes: 11,
  ...over,
});

describe("adresa zákonného claimu", () => {
  it("census posudků je KOMOROVÉ tvrzení — třísegmentový ref bez předmětu", () => {
    const { claim } = forensicCensusClaim(141, basis());
    expect(parseClaimRef(claim.ref)).toEqual({
      dataset: LAW_CLAIM_DATASET,
      metric: LAW_METRIC.forensicCensus,
    });
    expect(claim.ref.split(":")).toHaveLength(3);
    expect(claim.subject).toBeUndefined();
  });

  it("předmět pokrytí je id uzlu předpisu — dekóduje se zpátky na týž ref", () => {
    const figure = statuteCoverageClaim("586/1992", "trailBills", coverage())!;
    const parts = parseClaimRef(figure.claim.ref)!;
    expect(parts.subject).toBe("law:sb:586-1992");
    expect(refFromLawNodeId(parts.subject!)).toBe("586/1992");
  });

  it("každá dlaždice má VLASTNÍ metriku i ref — jsou to různá tvrzení", () => {
    const claims = (["trailBills", "enactedBills", "paragraphs", "changes"] as const).map(
      (m) => statuteCoverageClaim("586/1992", m, coverage())!.claim,
    );
    expect(new Set(claims.map((c) => c.metric)).size).toBe(4);
    expect(new Set(claims.map((c) => c.ref)).size).toBe(4);
    // A žádná z nich není komorové tvrzení o censu posudků.
    expect(claims.map((c) => c.metric)).not.toContain(LAW_METRIC.forensicCensus);
  });

  it("adresa je ZMRAZENÁ — dataset se nesmí přepsat, verze patří do základu odvození", () => {
    // Ref je trvalá adresa. Kdyby se změnil dataset, každá dosud vydaná citace
    // zákonné vrstvy by přestala existovat (proto se verze výpočtu nese v
    // `derivation` — týž důvod jako u SCORE_CLAIM_DATASET).
    expect(LAW_CLAIM_DATASET).toBe("psp.cz tisky ⋈ e-Sbírka");
    expect(forensicCensusClaim(141, basis()).claim.ref).toBe(
      "claim:psp.cz%20tisky%20%E2%8B%88%20e-Sb%C3%ADrka:forenzni-posudky",
    );
    expect(statuteCoverageClaim("586/1992", "trailBills", coverage())!.claim.ref).toBe(
      "claim:psp.cz%20tisky%20%E2%8B%88%20e-Sb%C3%ADrka:novely-predpisu:law%3Asb%3A586-1992",
    );
  });

  it("vydanou adresu přečte detektor brány jako figuru — včetně té bez předmětu", () => {
    // Druhá strana rovnice: co plocha vydá, musí brána rozpoznat. Komorový ref
    // (bez předmětu) je přesně ten tvar, na kterém se dřív rozhodovalo „záznam
    // nenalezen" ještě před volbou metriky.
    const census = detectRef(forensicCensusClaim(141, basis()).claim.ref);
    expect(census.family).toBe("figura");
    if (census.family !== "figura") throw new Error("unreachable");
    expect(census.parts.metric).toBe(LAW_METRIC.forensicCensus);
    expect(census.parts.subject).toBeUndefined();

    const statute = detectRef(statuteCoverageClaim("586/1992", "changes", coverage())!.claim.ref);
    expect(statute.family).toBe("figura");
    if (statute.family !== "figura") throw new Error("unreachable");
    expect(statute.parts.dataset).toBe(LAW_CLAIM_DATASET);
    expect(statute.parts.subject).toBe("law:sb:586-1992");
  });

  it("předpis, jehož ref nejde kanonicky složit, claim NEDOSTANE", () => {
    // Rozbitá adresa vypadá správně a neukazuje na nic — odmítnutí je levnější.
    expect(statuteCoverageClaim("586/92", "trailBills", coverage())).toBeNull();
    expect(statuteCoverageClaim("586-1992", "changes", coverage())).toBeNull();
    expect(statuteCoverageClaim("", "paragraphs", coverage())).toBeNull();
  });
});

describe("základ odvození jde z KORPUSOVÉHO agregátu", () => {
  it("nese ref výpočtu a průchod, na kterém se shodne celý korpus", () => {
    expect(forensicCensusDerivation(basis())).toBe("law-forensics@55");
    expect(forensicCensusClaim(141, basis()).claim.derivation).toBe("law-forensics@55");
  });

  it("nejednotný korpus žádný základ nedostane — chybějící základ netvrdí nic", () => {
    expect(forensicCensusDerivation(basis({ uniformPass: null }))).toBeNull();
    expect(forensicCensusDerivation(basis({ uniformRef: null }))).toBeNull();
    expect(forensicCensusClaim(141, basis({ uniformPass: null })).claim.derivation).toBeUndefined();
  });

  it("datum citace je DEN zápisu posudků, nikdy dopočítaný", () => {
    expect(forensicCensusRetrievedAt(basis())).toBe("2026-08-05");
    expect(forensicCensusClaim(141, basis()).claim.retrievedAt).toBe("2026-08-05");
    expect(forensicCensusRetrievedAt(basis({ uniformComputedAt: null }))).toBeNull();
    expect(forensicCensusRetrievedAt(basis({ uniformComputedAt: "nedávno" }))).toBeNull();
    expect(
      forensicCensusClaim(141, basis({ uniformComputedAt: null })).claim.retrievedAt,
    ).toBeUndefined();
  });

  it("pokrytí předpisu základ NENESE — census nemá jeden výpočet, který by ho napsal", () => {
    expect(statuteCoverageClaim("586/1992", "changes", coverage())!.claim.derivation).toBeUndefined();
  });
});

describe("stav brány je součást tvrzení, a obě rodiny se liší", () => {
  it("census posudků čeká na lidskou bránu (/dukazy), není negatovaný", () => {
    // Všech 141 verdiktů je v grafu uloženo pending_review; „ungated" by popřelo
    // bránu, která existuje a je zatím prázdná.
    expect(claimStatus(forensicCensusClaim(141, basis()).claim)).toBe("pending");
  });

  it("pokrytí předpisu je deterministická aritmetika — ungated", () => {
    for (const m of ["trailBills", "enactedBills", "paragraphs", "changes"] as const) {
      expect(claimStatus(statuteCoverageClaim("586/1992", m, coverage())!.claim), m).toBe("ungated");
    }
  });
});

/*
 * JISTOTA JEDNOHO POSUDKU (2026-08-12). Odložený claim — a ten odklad byl
 * zapsaný jen v CLAUDE.md. Liší se od censu ve dvou věcech, které se tady
 * přibíjejí: předmětem je id UZLU TISKU (ne veřejné číslo, ze kterého se skládá
 * adresa dosjeru) a základ odvození je provenience TOHO posudku, protože korpus
 * se na jednom průchodu neshodne (14 různých na uloženém grafu).
 */
describe("adresa uzlu tisku (kodek)", () => {
  it("skládá a rozkládá kanonický tvar", () => {
    expect(billNodeId(43111)).toBe("bill:tisk:43111");
    expect(tiskIdFromBillNodeId("bill:tisk:43111")).toBe(43111);
  });

  it("odmítá fallback id 0, záporná i necelá čísla — adresa ze selhání čtení není adresa", () => {
    expect(billNodeId(0)).toBeNull();
    expect(billNodeId(-4)).toBeNull();
    expect(billNodeId(4.5)).toBeNull();
    expect(billNodeId(Number.NaN)).toBeNull();
  });

  it("nehádá: cizí prefix, vodicí nula ani prázdný ocas adresu nedají", () => {
    expect(tiskIdFromBillNodeId("bill:tisk:0")).toBeNull();
    expect(tiskIdFromBillNodeId("bill:tisk:043111")).toBeNull();
    expect(tiskIdFromBillNodeId("bill:tisk:")).toBeNull();
    expect(tiskIdFromBillNodeId("law:sb:586-1992")).toBeNull();
    expect(tiskIdFromBillNodeId("psp:bill:4")).toBeNull();
  });
});

describe("jistota posudku je citovatelná figura", () => {
  const verdict = (over: Partial<ForensicVerdictBasis> = {}): ForensicVerdictBasis => ({
    pass: 15,
    provenanceRef: "law-forensics",
    computedAt: "2026-07-24T17:41:44.184Z",
    ...over,
  });

  it("předmětem je id UZLU tisku a hodnotou je jistota, kterou plocha sází", () => {
    const figure = forensicConfidenceClaim(43111, 4, verdict())!;
    const parts = parseClaimRef(figure.claim.ref)!;
    expect(parts.metric).toBe(LAW_METRIC.forensicConfidence);
    expect(parts.subject).toBe("bill:tisk:43111");
    expect(figure.value).toBe(4);
    // Jednotka nese stupnici z JEDNOHO čísla — viditelné „4/5" a citovaná
    // jednotka nemůžou tvrdit jiný rozsah.
    expect(figure.claim.unit).toBe(`z ${FORENSIC_CONFIDENCE_SCALE}`);
  });

  it("základ odvození je provenience TOHOTO posudku, ne korpusový agregát", () => {
    expect(forensicConfidenceDerivation(verdict())).toBe("law-forensics@15");
    expect(forensicConfidenceClaim(43111, 4, verdict())!.claim.derivation).toBe("law-forensics@15");
    // Týž ref v jiném průchodu je JINÝ základ — brána na tom pozná `moved/basis`.
    expect(forensicConfidenceClaim(43111, 4, verdict({ pass: 55 }))!.claim.derivation).toBe(
      "law-forensics@55",
    );
  });

  it("chybějící základ nebo datum se VYNECHÁ — nenapsaný základ netvrdí nic", () => {
    expect(forensicConfidenceDerivation(verdict({ pass: null }))).toBeNull();
    expect(forensicConfidenceDerivation(verdict({ provenanceRef: null }))).toBeNull();
    expect(forensicConfidenceClaim(43111, 4, verdict({ pass: null }))!.claim.derivation).toBeUndefined();
    expect(
      forensicConfidenceClaim(43111, 4, verdict({ provenanceRef: null }))!.claim.derivation,
    ).toBeUndefined();

    expect(forensicConfidenceRetrievedAt(verdict())).toBe("2026-07-24");
    expect(forensicConfidenceRetrievedAt(verdict({ computedAt: null }))).toBeNull();
    expect(forensicConfidenceRetrievedAt(verdict({ computedAt: "nedávno" }))).toBeNull();
    expect(
      forensicConfidenceClaim(43111, 4, verdict({ computedAt: null }))!.claim.retrievedAt,
    ).toBeUndefined();
  });

  it("tisk s fallback id 0 claim NEDOSTANE (pravidlo 4)", () => {
    // `getLawData` píše `Number(...) || 0`, když se id uzlu přečíst nepodaří —
    // „bill:tisk:0" by byla adresa vyrobená ze selhání čtení.
    expect(forensicConfidenceClaim(0, 4, verdict())).toBeNull();
    expect(forensicConfidenceClaim(-1, 4, verdict())).toBeNull();
  });

  it("nekonečná hodnota claim nedostane — pomlčka nesmí svědčit", () => {
    expect(forensicConfidenceClaim(43111, Number.NaN, verdict())).toBeNull();
    expect(forensicConfidenceClaim(43111, Number.POSITIVE_INFINITY, verdict())).toBeNull();
  });

  it("posudek čeká na lidskou bránu (/dukazy) — pending, nikdy ungated", () => {
    // Jistota je údaj UVNITŘ posudku uloženého `pending_review`, ne aritmetika
    // censu; „ungated" by popřelo bránu, která na něj teprve čeká.
    expect(claimStatus(forensicConfidenceClaim(43111, 4, verdict())!.claim)).toBe("pending");
  });

  it("brána vydanou adresu přečte a vytáhne z ní týž tisk", () => {
    const figure = forensicConfidenceClaim(43111, 3, verdict())!;
    const det = detectRef(figure.claim.ref);
    expect(det.family).toBe("figura");
    if (det.family !== "figura") throw new Error("unreachable");
    expect(det.parts.dataset).toBe(LAW_CLAIM_DATASET);
    expect(det.parts.metric).toBe(LAW_METRIC.forensicConfidence);
    expect(tiskIdFromBillNodeId(det.parts.subject!)).toBe(43111);
  });

  it("je to VLASTNÍ metrika — s censem ani s pokrytím se nesmí splést", () => {
    const conf = forensicConfidenceClaim(43111, 4, verdict())!.claim;
    expect(conf.metric).not.toBe(LAW_METRIC.forensicCensus);
    expect(conf.ref).not.toBe(forensicCensusClaim(141, basis()).claim.ref);
    expect(conf.ref.split(":")).toHaveLength(4);
  });
});

describe("hodnota je ta, kterou plocha sází", () => {
  it("dlaždice se páruje s polem pokrytí, které nese její jméno", () => {
    const c = coverage();
    expect(statuteCoverageValue(c, "trailBills")).toBe(7);
    expect(statuteCoverageValue(c, "enactedBills")).toBe(4);
    expect(statuteCoverageValue(c, "paragraphs")).toBe(3);
    expect(statuteCoverageValue(c, "changes")).toBe(11);
    for (const m of ["trailBills", "enactedBills", "paragraphs", "changes"] as const) {
      expect(statuteCoverageClaim("586/1992", m, c)!.value, m).toBe(statuteCoverageValue(c, m));
    }
  });

  it("census razí počet posudků tak, jak ho rejstřík spočítal", () => {
    expect(forensicCensusClaim(141, basis()).value).toBe(141);
    expect(forensicCensusClaim(0, basis()).value).toBe(0);
  });
});
