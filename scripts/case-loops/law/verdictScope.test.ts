import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERDICT_ID_KINDS, verdictGateScope } from "./verdictScope";

/* The anti-fabrication scope a verdict is gated against (known law refs, known graph ids) was
 * computed three times: prepare-batch.ts shipped company/person/law ids to the army,
 * gate-verdicts.ts checked company/person/law/bill/organ, and the write-time gate in
 * kg-forensics.ts accepts every node. The pre-write pair now shares one definition. */

const nodes = [
  { id: "company:ico:1", kind: "company", props: {} },
  { id: "psp:person:7", kind: "person", props: {} },
  { id: "law:sb:1-2000", kind: "law", props: { ref: "1/2000" } },
  { id: "bill:tisk:9", kind: "bill", props: { cislo: 9 } },
  { id: "organ:1", kind: "organ", props: {} },
  { id: "theme:economy", kind: "theme", props: {} },
];

describe("verdictGateScope", () => {
  it("known ids are exactly the five citable kinds — bill and organ included, theme excluded", () => {
    const scope = verdictGateScope(nodes, () => null);
    expect([...VERDICT_ID_KINDS]).toEqual(["company", "person", "law", "bill", "organ"]);
    expect([...scope.knownIds].sort()).toEqual(["bill:tisk:9", "company:ico:1", "law:sb:1-2000", "organ:1", "psp:person:7"]);
  });

  it("known law refs are the graph's laws plus the e-Sbírka registry when it is readable", () => {
    const withRegistry = verdictGateScope(nodes, () => ({ refs: ["2/2001", "1/2000"] }));
    expect([...withRegistry.knownLawRefs].sort()).toEqual(["1/2000", "2/2001"]);
    expect(withRegistry.graphLawCount).toBe(1);
    const without = verdictGateScope(nodes, () => null);
    expect([...without.knownLawRefs]).toEqual(["1/2000"]);
  });

  it("gate-verdicts.ts and prepare-batch.ts both read the scope from here", () => {
    for (const f of ["gate-verdicts.ts", "prepare-batch.ts"]) {
      const src = readFileSync(`scripts/case-loops/law/${f}`, "utf8");
      expect(src, f).toMatch(/from "\.\/verdictScope"/);
      expect(src, f).not.toMatch(/known-laws\.json/);
    }
  });
});
