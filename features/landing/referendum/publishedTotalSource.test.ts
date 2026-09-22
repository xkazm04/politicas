// The published weight total on /referendum (2026-09-08, scan-sweep landing-page).
// ReferendumTeaser derives it ("i ten součet je derivace, ne literál"); the page
// that invites the reader to REWRITE the weights handed WeightPanel the literal
// 100 under published weights — a number no test held.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LENS_COMPONENT_ORDER, PUBLISHED_WEIGHTS } from "@/features/civicscore/lens";

describe("the published weight total is derived, never the literal 100 (2026-09-08, parity-auditor)", () => {
  it("ReferendumPage hands WeightPanel a derived total under published weights", () => {
    const src = readFileSync("features/landing/referendum/ReferendumPage.tsx", "utf8");
    expect(src).not.toMatch(/totalRaw=\{lensView\?\.totalRaw \?\? 100\}/);
    expect(src).toMatch(/const publishedTotal = LENS_COMPONENT_ORDER\.reduce\(/);
    expect(src).toMatch(/totalRaw=\{lensView\?\.totalRaw \?\? publishedTotal\}/);
  });

  it("the published weights sum to 100 today — the fact the literal assumed and nothing pinned", () => {
    expect(LENS_COMPONENT_ORDER.reduce((s, k) => s + PUBLISHED_WEIGHTS[k], 0)).toBe(100);
  });
});
