import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import { globSync } from "node:fs";

const files = globSync("features/graph/**/*.{ts,tsx}").filter((f) => !f.endsWith(".test.ts"));
const sources = files.map((f) => [f, read(f)] as const);
const definers = (re: RegExp) => sources.filter(([, s]) => re.test(s)).map(([f]) => f);

describe("one definition per shared graph shape (2026-09-06, parity-auditor)", () => {
  it("edgeKey is defined once (diffViews re-exports forensicView's)", () => {
    // Two byte-identical `edgeKey` definitions (forensicView.ts, diffViews.ts) —
    // one rule, two copies, no test tying them together.
    expect(definers(/export const edgeKey = /)).toEqual(["features/graph/forensicView.ts"]);
  });

  it("the ‚hledání neproběhlo‘ PathQueryResult is built once (trailPath.unavailablePathResult)", () => {
    // graphLoader.getPathBetween and VariantMapa each spelled the eleven-field
    // unavailable result by hand; a twelfth field would have reached one of them.
    expect(definers(/status: "unavailable",[\s\S]{0,600}ruleRef: PATH_RULE_REF/)).toEqual(["features/graph/trailPath.ts"]);
  });
});
