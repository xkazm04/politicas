import { describe, expect, it } from "vitest";

import { parseAndValidateLawVerdict, validateLawVerdict, type LawForensicVerdict } from "@/lib/analysis/law-verdict";

const KNOWN_LAWS = ["542/2020", "477/2001"];
const KNOWN_IDS = ["company:ico:26185610", "psp:person:6150"];
const opts = { knownLawRefs: KNOWN_LAWS, knownIds: KNOWN_IDS };

const valid: LawForensicVerdict = {
  billTisk: 58,
  statedReasoning: "Government bill amending zákon č. 542/2020 Sb. on end-of-life products; stated aim is EU-directive transposition.",
  researchedContext: "Independent reporting indicates the amendment raises recycling-fee thresholds.",
  unstatedEffects: [{ effect: "raises compliance cost for small importers", whoBenefits: "large incumbents", evidence: "https://example.com/analysis" }],
  conflictAssessment: "Sponsor is linked to company:ico:26185610, active in waste — a potential benefit worth review.",
  severity: "medium",
  confidence: 3,
  citations: [
    { claim: "amends č. 542/2020 Sb.", kind: "law", source: "542/2020" },
    { claim: "raises fee thresholds", kind: "web", source: "https://example.com/analysis" },
    { claim: "sponsor linked to a waste company", kind: "graph_fact", source: "company:ico:26185610" },
  ],
};

describe("validateLawVerdict", () => {
  it("accepts a well-formed, fully-cited verdict citing only real statutes", () => {
    expect(validateLawVerdict(valid, opts).ok).toBe(true);
  });

  it("REJECTS a fabricated statute cited anywhere in prose", () => {
    const bad = { ...valid, statedReasoning: valid.statedReasoning + " It also touches zákon č. 999/2099 Sb." };
    const r = validateLawVerdict(bad, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("999/2099");
    expect(r.errors.join(" ")).toContain("fabricated legal citation");
  });

  it("REJECTS a law citation whose statute is out of scope", () => {
    const bad = { ...valid, citations: [...valid.citations, { claim: "x", kind: "law" as const, source: "12/1990" }] };
    expect(validateLawVerdict(bad, opts).ok).toBe(false);
  });

  it("REJECTS a web/bill_text citation that is not a URL", () => {
    const bad = { ...valid, citations: [{ claim: "x", kind: "web" as const, source: "a newspaper" }] };
    expect(validateLawVerdict(bad, opts).ok).toBe(false);
  });

  it("REJECTS a graph_fact citing an unknown id", () => {
    const bad = { ...valid, citations: [...valid.citations, { claim: "x", kind: "graph_fact" as const, source: "company:ico:00000000" }] };
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
});
