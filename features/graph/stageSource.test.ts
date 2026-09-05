import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

const STAGE = read("features/graph/components/GraphStage.tsx");
const OVERLAYS = read("features/graph/components/StageOverlays.tsx");

describe("stage and legend tell the rejected stroke apart (2026-09-06, visual-craft)", () => {
  it("the legend derives its dash patterns from EDGE_DASH and lists the rejected pattern", () => {
    // The canvas has drawn three strokes since 2026-09-04 (stagePalette EDGE_DASH);
    // the legend listed one, with a literal `4 4` that matched neither.
    expect(OVERLAYS).toMatch(/import \{ EDGE_DASH \} from "..\/stagePalette"/);
    expect(OVERLAYS).not.toMatch(/strokeDasharray="[\d. ]+"/);
    expect(OVERLAYS).toMatch(/EDGE_DASH\.pending_review/);
    expect(OVERLAYS).toMatch(/EDGE_DASH\.rejected/);
    expect(OVERLAYS).toMatch(/ts\("rejected"\)/);
  });

  it("the forensic inline label reads the gate, not the pending boolean", () => {
    expect(STAGE).not.toMatch(/e\.pending \? `\$\{text\}/);
    expect(STAGE).toMatch(/e\.gate === "rejected" \? t\("rejected"\)/);
  });

  it("graph.stage.rejected exists in both catalogs", () => {
    for (const catalog of [csCatalog, enCatalog]) {
      expect(typeof (catalog as { graph: { stage: Record<string, unknown> } }).graph.stage.rejected).toBe("string");
    }
  });
});
