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
  statuteCoverageClaim,
  statuteCoverageValue,
  LAW_CLAIM_DATASET,
  LAW_METRIC,
  type ForensicCensusBasis,
  type StatuteCoverageCounts,
} from "./lawClaims";
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
