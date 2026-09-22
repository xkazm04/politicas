import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

// Server actions are network calls. Eight call sites in the graph feature chained
// `.then(...)` with no rejection handler, so a failed action left its state machine
// where it was: the map said „sestavuji mapu grafu…" forever, the inspector „načítám"
// forever, the cite button disabled forever. Every `.then` now has a `.catch` that
// settles the state (2026-09-06, scan-sweep, error-handler + state-coverage).

const FILES = [
  "features/graph/VariantMapa.tsx",
  "features/graph/VariantTrasy.tsx",
  "features/graph/useNodeSelection.ts",
  "features/graph/components/NodeSearch.tsx",
];

describe("every graph server-action call settles on rejection (2026-09-06, error-handler)", () => {
  for (const file of FILES) {
    it(`${file}: as many .catch handlers as Action(...).then chains`, () => {
      const src = read(file);
      const thens = src.match(/\w+Action\([^;]*?\)\s*\.then\(/g)?.length ?? 0;
      const catches = src.match(/\.catch\(/g)?.length ?? 0;
      expect(thens, "test must see the call sites").toBeGreaterThan(0);
      expect(catches).toBe(thens);
    });
  }

  it("CiteView awaits the action inside try/catch and settles on failure", () => {
    const src = read("features/graph/components/CiteView.tsx");
    expect(src).toMatch(/try \{\s*issued = await citeViewAction\(state\);/);
    expect(src).toMatch(/settle\("unissued"\);\s*return;\s*\}/);
  });
});
