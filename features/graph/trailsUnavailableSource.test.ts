import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

const TRASY = read("features/graph/VariantTrasy.tsx");
const MAPA = read("features/graph/VariantMapa.tsx");

describe("a null trails answer is typeset as an outage, never as ‚no trails‘ (2026-09-06, state-coverage)", () => {
  it("VariantTrasy distinguishes null from an empty list", () => {
    // `trailsAction()` returns null when the store is down; the variant showed
    // `trasy.empty` („trasu se nepodařilo spočítat z dostupných dat") for both.
    expect(TRASY).toMatch(/trails === null \? tt\("unavailable"\)/);
    expect(TRASY).not.toMatch(/!trails \|\| trails\.length === 0/);
  });

  it("VariantMapa keeps the null and says it instead of hiding the trail panel", () => {
    expect(MAPA).not.toMatch(/setTrails\(ts \?\? \[\]\)/);
    expect(MAPA).toMatch(/trails === null && \(/);
    expect(MAPA).toMatch(/tt\("unavailable"\)/);
  });

  it("graph.trasy.unavailable exists in both catalogs", () => {
    for (const catalog of [csCatalog, enCatalog]) {
      expect(typeof (catalog as { graph: { trasy: Record<string, unknown> } }).graph.trasy.unavailable).toBe("string");
    }
  });
});
