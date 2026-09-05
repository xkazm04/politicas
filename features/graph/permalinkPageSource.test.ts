import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import { gateCounts } from "./permalink";

const PAGE = read("features/graph/PermalinkPage.tsx");

describe("gateCounts — one counting of the three gate states (2026-09-06, parity-auditor)", () => {
  it("counts pending and rejected separately; null (ungated) and verified count as neither", () => {
    const g = gateCounts([
      { gate: "verified" },
      { gate: "pending_review" },
      { gate: "pending_review" },
      { gate: "rejected" },
      { gate: null },
    ]);
    expect(g).toEqual({ pending: 2, rejected: 1 });
    expect(gateCounts([])).toEqual({ pending: 0, rejected: 0 });
  });
});

describe("permalink page prints the gate line the OG card already prints (2026-09-06, parity-auditor)", () => {
  it("the trasa and okoli exhibits use gateCounts and name rejected edges", () => {
    // The 2026-09-04 fix taught permalinkCardModel and the OG card to say „N hran
    // odmítla kontrola" for trasa and okoli; the page under the card still counted
    // `e.pending` only for trasa and printed no gate line at all for okoli.
    expect(PAGE).not.toMatch(/filter\(\(e\) => e\.pending\)/);
    expect(PAGE.match(/gateCounts\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(PAGE.match(/t\("rejectedEdges"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
