import { describe, expect, it } from "vitest";

import { parseAndValidateLawVerdict, validateLawVerdict, type LawForensicVerdict } from "@/lib/analysis/law-verdict";

const KNOWN_LAWS = ["542/2020", "477/2001"];
const KNOWN_IDS = ["company:ico:26185610", "psp:person:6150"];
const opts = { knownLawRefs: KNOWN_LAWS, knownIds: KNOWN_IDS };

const valid: LawForensicVerdict = {
  billTisk: 58,
  statedReasoning:
    "Vládní návrh novelizuje zákon č. 542/2020 Sb., o výrobcích s ukončenou životností; deklarovaným cílem je transpozice unijní směrnice.",
  researchedContext: "Nezávislé zpravodajství uvádí, že novela zvyšuje prahové hodnoty recyklačních poplatků.",
  unstatedEffects: [
    {
      effect: "Zvyšuje náklady na plnění povinností u malých dovozců, kteří je nemohou rozložit do většího objemu.",
      whoBenefits: "Velcí zavedení výrobci, kteří fixní náklady na plnění povinností absorbují snadněji.",
      evidence: "https://example.com/analysis",
    },
  ],
  // The urn stays in the citation SOURCE; prose says it in Czech (the batch-013 M6 jargon
  // gate rejects graph urns inside reader-facing sentences).
  conflictAssessment:
    "Předkladatel je vázán na společnost s IČO 26185610 působící v odpadovém hospodářství — možný prospěch, který si zaslouží prověření.",
  severity: "medium",
  confidence: 3,
  citations: [
    { claim: "Novelizuje zákon č. 542/2020 Sb.", kind: "law", source: "542/2020" },
    { claim: "Zvyšuje prahové hodnoty poplatků podle nezávislého zpravodajství.", kind: "web", source: "https://example.com/analysis" },
    { claim: "Předkladatel je vázán na společnost působící v odpadovém hospodářství.", kind: "graph_fact", source: "company:ico:26185610" },
  ],
};

describe("validateLawVerdict", () => {
  it("accepts a well-formed, fully-cited verdict citing only real statutes", () => {
    expect(validateLawVerdict(valid, opts).ok).toBe(true);
  });

  it("REJECTS a fabricated statute cited anywhere in prose", () => {
    const bad = { ...valid, statedReasoning: valid.statedReasoning + " Dotýká se rovněž zákona č. 999/2099 Sb." };
    const r = validateLawVerdict(bad, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("999/2099");
    expect(r.errors.join(" ")).toContain("fabricated legal citation");
  });

  it("REJECTS a law citation whose statute is out of scope", () => {
    const bad = { ...valid, citations: [...valid.citations, { claim: "Novelizuje zákon č. 12/1990 Sb.", kind: "law" as const, source: "12/1990" }] };
    expect(validateLawVerdict(bad, opts).ok).toBe(false);
  });

  it("REJECTS a web/bill_text citation that is not a URL", () => {
    const bad = { ...valid, citations: [{ claim: "Uvádí to deník.", kind: "web" as const, source: "a newspaper" }] };
    expect(validateLawVerdict(bad, opts).ok).toBe(false);
  });

  it("REJECTS a graph_fact citing an unknown id", () => {
    const bad = { ...valid, citations: [...valid.citations, { claim: "Vazba na neznámou firmu.", kind: "graph_fact" as const, source: "company:ico:00000000" }] };
    expect(validateLawVerdict(bad, opts).ok).toBe(false);
  });

  it("REJECTS empty citations and out-of-range confidence", () => {
    expect(validateLawVerdict({ ...valid, citations: [] }, opts).ok).toBe(false);
    expect(validateLawVerdict({ ...valid, confidence: 9 }, opts).ok).toBe(false);
  });

  it("parses a fenced JSON block then validates", () => {
    const text = "Here is my verdict:\n```json\n" + JSON.stringify(valid) + "\n```\n";
    expect(parseAndValidateLawVerdict(text, opts).ok).toBe(true);
  });

  // Batch 013 (M6): the audit found pipeline tokens in reader-facing prose in 9 of 10
  // verdicts — internal prop names, origin enums, cache paths, graph urns, batch numbers.
  // Prose rules do not survive the next army; the contract now rejects them in code.
  it("REJECTS pipeline jargon in reader-facing prose (urns, enums, cache paths, batch refs)", () => {
    const urnInProse = { ...valid, conflictAssessment: "Vazba na společnost company:ico:26185610 je v datech evidována." };
    const r1 = validateLawVerdict(urnInProse, opts);
    expect(r1.ok).toBe(false);
    expect(r1.errors.join(" ")).toContain("pipeline jargon");

    const enumToken = { ...valid, researchedContext: "Jde o návrh typu mp_group s vysokou prioritou projednání ve výborech." };
    expect(validateLawVerdict(enumToken, opts).ok).toBe(false);

    const cachePath = {
      ...valid,
      unstatedEffects: [{ ...valid.unstatedEffects[0], evidence: "Ověřeno v .data/law-collision-cache/tisk-58/12345.txt na řádku 42." }],
    };
    expect(validateLawVerdict(cachePath, opts).ok).toBe(false);

    const batchRef = { ...valid, researchedContext: "Souvislost potvrdila už dávka batch-004 při ručním porovnání znění obou tisků." };
    expect(validateLawVerdict(batchRef, opts).ok).toBe(false);

    // The closure audit (C2) found the first regex list covered only one of the three prop
    // identifiers the finding named — a gate must cover what its own motivating defect showed.
    const moneyTies = { ...valid, conflictAssessment: "Pole moneyTies je u předkladatele prázdné, takže vazby neevidujeme." };
    expect(validateLawVerdict(moneyTies, opts).ok).toBe(false);
    const leads = { ...valid, conflictAssessment: "Signál attributedSectorLeads je u tisku prázdný." };
    expect(validateLawVerdict(leads, opts).ok).toBe(false);
    const bareBatch = { ...valid, researchedContext: "Zjištění pochází z interního batch zpracování textů." };
    expect(validateLawVerdict(bareBatch, opts).ok).toBe(false);

    // Batch-017 structural rules: identifiers are caught by SHAPE, not by a token list.
    const camel = { ...valid, conflictAssessment: "Hodnota likelyCompanionTisk u tohoto podnětu není v datech vyplněna." };
    expect(validateLawVerdict(camel, opts).ok).toBe(false);
    const snake = { ...valid, researchedContext: "Pole review_state zůstává u všech vazeb beze změny." };
    expect(validateLawVerdict(snake, opts).ok).toBe(false);
    const propShape = { ...valid, conflictAssessment: "U předkladatele je evidováno sponzorství: [] a příznak střetu: false, tedy žádná vazba." };
    expect(validateLawVerdict(propShape, opts).ok).toBe(false);
  });

  it("the camelCase allowlist admits real e-government and media names", () => {
    const real = {
      ...valid,
      researchedContext:
        "Materiál prošel systémem eKLEP a registr eTurista podle nařízení eIDAS popsal server iROZHLAS; důvodová zpráva odkazuje na strategii eGovernment.",
    };
    expect(validateLawVerdict(real, opts).ok).toBe(true);
  });

  // Batch-017 audit M8: the first-match `continue` used to void the whole camelCase rule the
  // moment an ALLOWLISTED name preceded the identifier — the verdict depended on word order.
  it("an allowlisted name does NOT shield a later camelCase identifier in the same field", () => {
    const shielded = {
      ...valid,
      researchedContext: "Systém eGovernment eviduje hodnotu sponsorContractCzk pro tento tisk podle důvodové zprávy.",
    };
    const r = validateLawVerdict(shielded, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("sponsorContractCzk");
  });

  it("diacritic allowlist entries are live (eSbírka) and unit symbols pass (kWh, mSv)", () => {
    const real = {
      ...valid,
      researchedContext:
        "Znění vyhlašované v systému eSbírka stanoví limit 500 kWh ročně a nejvyšší přípustnou dávku 12 mSv; server iROZHLAS o změně informoval.",
    };
    expect(validateLawVerdict(real, opts).ok).toBe(true);
  });

  // Batch-017 closure: the accusative form above never hit the effort rule (it matches only
  // the exact „dávka <digit>" shape) — the NOMINATIVE dose is the real case and must pass,
  // while a bare „dávka 12" (the pipeline batch-id shape) must still flag.
  it("a nominative dose or benefit amount passes; a bare dávka-digit still flags", () => {
    const dose = { ...valid, researchedContext: "Efektivní dávka 12 mSv ročně je podle důvodové zprávy nejvyšší přípustná; absorbovaná dávka 5 mGy se nemění." };
    expect(validateLawVerdict(dose, opts).ok).toBe(true);
    const benefit = { ...valid, researchedContext: "Paušální dávka 15 000 Kč se podle přechodného ustanovení vyplácí jednorázově." };
    expect(validateLawVerdict(benefit, opts).ok).toBe(true);
    // sentence-initial capitalized form must behave like the lowercase one (closure follow-up)
    const capitalized = { ...valid, researchedContext: "Dávka 12 mSv ročně je podle důvodové zprávy nejvyšší přípustná; roční limit odběru je 250 kWh." };
    expect(validateLawVerdict(capitalized, opts).ok).toBe(true);
    const batchId = { ...valid, researchedContext: "Souvislost potvrdila dávka 12 při ručním porovnání znění obou tisků." };
    expect(validateLawVerdict(batchId, opts).ok).toBe(false);
  });

  it("proper names beginning with „scan“ and declined „stewardka“ are not pipeline tokens", () => {
    const real = {
      ...valid,
      researchedContext:
        "Dopravce provozující vozidla Scania zaměstnává stewardy a stewardky ve vlacích; novela jejich pracovní podmínky podle důvodové zprávy nemění.",
    };
    expect(validateLawVerdict(real, opts).ok).toBe(true);
  });

  it("bare lowercase pipeline tokens „amends“ and „pending“ are rejected", () => {
    const amendsTok = { ...valid, researchedContext: "Regenerovaná topologie hran amends v grafu potvrzuje rozsah novely." };
    expect(validateLawVerdict(amendsTok, opts).ok).toBe(false);
    const pendingTok = { ...valid, conflictAssessment: "Vazba předkladatele je ve stavu pending a čeká na lidskou kontrolu." };
    expect(validateLawVerdict(pendingTok, opts).ok).toBe(false);
  });

  it("prop-value shapes without a space and English prop heads are rejected", () => {
    const noSpace = { ...valid, conflictAssessment: "U předkladatele je evidováno flagged:false, tedy žádná vazba ke kontrole." };
    expect(validateLawVerdict(noSpace, opts).ok).toBe(false);
    const enumHead = { ...valid, conflictAssessment: "Záznam nese severity: vysokou a nic dalšího z něj neplyne." };
    expect(validateLawVerdict(enumHead, opts).ok).toBe(false);
  });

  it("structural rules do NOT fire on ordinary Czech legal prose", () => {
    const ordinary = {
      ...valid,
      researchedContext:
        "Novela v čl. II bodu 3 mění § 55a odst. 2 písm. a) zákona č. 542/2020 Sb.; podle důvodové zprávy jde o technickou opravu, kterou výbor projednal 12. března 2026 a doporučil ji schválit beze změn.",
    };
    expect(validateLawVerdict(ordinary, opts).ok).toBe(true);
  });

  // Batch 009 (presentation gate): 27/27 gated verdicts were English and rendered verbatim
  // to Czech readers. The contract now rejects that at persist time.
  it("REJECTS a verdict whose reader-facing prose is English", () => {
    const english = {
      ...valid,
      statedReasoning:
        "The government bill amends the end-of-life products act and the stated aim is to transpose the relevant European Union directive into national law.",
    };
    const r = validateLawVerdict(english, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("statedReasoning");
    expect(r.errors.join(" ")).toContain("není česky");
  });

  it("REJECTS English inside an unstated effect or a citation claim, not just the long fields", () => {
    const badEffect = {
      ...valid,
      unstatedEffects: [
        {
          effect: "The amendment raises compliance costs for smaller importers who cannot spread them over volume.",
          whoBenefits: "Large incumbent producers that can absorb the fixed compliance cost more easily.",
          evidence: "https://example.com/analysis",
        },
      ],
    };
    expect(validateLawVerdict(badEffect, opts).ok).toBe(false);

    const badClaim = {
      ...valid,
      citations: [
        ...valid.citations,
        {
          claim: "The bill also amends the market surveillance statute and replaces the old directive reference.",
          kind: "law" as const,
          source: "477/2001",
        },
      ],
    };
    expect(validateLawVerdict(badClaim, opts).ok).toBe(false);
  });

  it("allows re-validating an archived English verdict with requireCzech: false", () => {
    const english = {
      ...valid,
      statedReasoning:
        "The government bill amends the end-of-life products act and the stated aim is to transpose the relevant European Union directive into national law.",
    };
    expect(validateLawVerdict(english, { ...opts, requireCzech: false }).ok).toBe(true);
  });
});
