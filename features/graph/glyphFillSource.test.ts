import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

// The legend paints its glyphs with the token class (`fill-cobalt`…) so the forensic
// layer can remap them, and says why: „hex z KIND_STYLE by na tmě lhal". Four sibling
// DOM glyphs — inspector, search hits, path-finder rows and the permalink page —
// still painted `fill={style.fill}`, the canvas hex, so in forensic mode the same
// kind wore two colours (2026-09-06, scan-sweep, parity-auditor + visual-craft).

const FILES = [
  "features/graph/components/NodeInspector.tsx",
  "features/graph/components/NodeSearch.tsx",
  "features/graph/components/TrailFinder.tsx",
  "features/graph/PermalinkPage.tsx",
];

describe("DOM glyphs are painted through the token class, never the canvas hex (2026-09-06)", () => {
  for (const file of FILES) {
    it(`${file}`, () => {
      const src = read(file);
      expect(src).not.toMatch(/fill=\{style\.fill\}/);
      expect(src).toMatch(/className=\{KIND_FILL_CLASS\[KIND_FILL_TOKEN\[/);
    });
  }
});
