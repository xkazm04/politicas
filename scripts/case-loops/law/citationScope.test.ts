// The gate's citation-scope check over company graph_facts (2026-09-09, scan-sweep
// law-triage-batch). Exported behind a direct-run guard so the keyword net is decidable
// by a test instead of by re-reading 27 verdicts.
import { describe, expect, it } from "vitest";
import type { KgNodeRow } from "@/lib/db/types";
import { citationScopeIssue } from "./gate-verdicts";

const company: KgNodeRow = {
  id: "company:ico:25172263",
  kind: "company",
  label: "SOMPO, a.s.",
  props: { ico: "25172263" },
  firstSeenPass: 1,
  provenance: { pass: 1, method: "deterministic", ref: "test" },
};
const nodes = new Map<string, KgNodeRow>([[company.id, company]]);

describe("citationScopeIssue — a company graph_fact may not assert ownership or status", () => {
  it("flags an ownership claim about a company node", () => {
    expect(citationScopeIssue("Společnost vlastní 100 % podílu v dceřiné firmě", company.id, nodes)).not.toBeNull();
  });
  it("passes a claim the company node's own props can carry", () => {
    expect(citationScopeIssue("Společnost čerpala dotace ve výši 2 mil. Kč", company.id, nodes)).toBeNull();
  });
  it("only fires on company targets", () => {
    expect(citationScopeIssue("vlastní většinu", "psp:person:6790", nodes)).toBeNull();
  });
});

describe("citationScopeIssue — Czech keywords need Unicode boundaries (2026-09-09, bounty-hunter)", () => {
  it("flags the phrase statni podnik - an ASCII word boundary after the i-acute never fired before a space", () => {
    expect(citationScopeIssue("Jde o státní podnik založený ministerstvem", company.id, nodes)).not.toBeNull();
  });
});
