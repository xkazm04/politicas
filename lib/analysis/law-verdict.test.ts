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
  conflictAssessment:
    "Předkladatel je vázán na společnost company:ico:26185610 působící v odpadovém hospodářství — možný prospěch, který si zaslouží prověření.",
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
