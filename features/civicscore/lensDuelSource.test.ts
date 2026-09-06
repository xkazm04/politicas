import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the lens & duel files (scan-sweep 2026-09-08, civicscore-lens-duel). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the weight panel's explanations are TEXT, not hover-only attributes", () => {
  it("every preset button carries its note as sr-only text beside the title", () => {
    const s = src("features/civicscore/components/WeightPanel.tsx");
    const button = /title=\{t\(p\.noteKey\)\}[\s\S]{0,1500}?<\/button>/.exec(s)?.[0] ?? "";
    expect(button).toMatch(/sr-only[^<]*<\/span>|className="sr-only">[\s\S]*?\{t\(p\.noteKey\)\}/);
  });
  it("every slider row names its source as sr-only text, not only in the label's title", () => {
    const s = src("features/civicscore/components/WeightPanel.tsx");
    expect(s).toMatch(/className="sr-only">[\s\S]{0,120}\{c\.source\}/);
  });
});
