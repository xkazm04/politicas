// The six component rows are READER-FACING Czech copy plus a citation each, published
// to /zebricek, /kraj, /metodika, the /referendum embed and the printed poster. That is
// exactly the class of string this repo has already shipped in English three times
// (memory/reader-facing-loaders-need-the-language-gate.md) — so it is pinned here, not
// trusted. The weights are pinned to the FORMULA rather than restated, because a label
// nobody checks and a weight nobody checks fail the same way: silently.

import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import { CONTRIBUTION_WEIGHTS } from "@/lib/analysis/contribution";
import { COMPONENT_DEFS, componentDefs, type ComponentKey } from "./componentDefs";
import { LENS_COMPONENT_ORDER } from "./lens";

describe("COMPONENT_DEFS", () => {
  it("carries exactly the six components the formula weights, once each", () => {
    const keys = COMPONENT_DEFS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...Object.keys(CONTRIBUTION_WEIGHTS)].sort());
  });

  it("takes every weight FROM lib/analysis/contribution.ts — never a mirrored literal", () => {
    for (const c of COMPONENT_DEFS) {
      expect(c.weight, c.key).toBe(CONTRIBUTION_WEIGHTS[c.key as keyof typeof CONTRIBUTION_WEIGHTS]);
    }
  });

  it("sums to the published 100 points", () => {
    expect(COMPONENT_DEFS.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it("is ordered by published weight, descending — the breakdown axis readers see", () => {
    const weights = COMPONENT_DEFS.map((c) => c.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("gives every component a non-empty label and its own psp.cz citation (the brand rule)", () => {
    for (const c of COMPONENT_DEFS) {
      expect(c.label.length, `${c.key}.label`).toBeGreaterThan(0);
      expect(c.source, `${c.key}.source`).toContain("psp.cz");
    }
    // Two components citing the same dataset would mean one of them is not really cited.
    const sources = COMPONENT_DEFS.map((c) => c.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("is Czech — labels and sources render verbatim to readers (language gate)", () => {
    for (const c of COMPONENT_DEFS) {
      expect(looksEnglish(c.label), `${c.key}.label`).toBe(false);
      expect(looksEnglish(c.source), `${c.key}.source`).toBe(false);
    }
  });
});

describe("componentDefs()", () => {
  it("hands out an independent copy — a caller must not be able to edit the published defs", () => {
    const a = componentDefs();
    a[0].label = "změněno";
    expect(componentDefs()[0].label).toBe(COMPONENT_DEFS[0].label);
  });
});

describe("LENS_COMPONENT_ORDER", () => {
  // It used to be a hand-retyped copy of the same six keys, with a comment saying the
  // real list could not be imported past `server-only`. It can now: the defs left the
  // loader. The URL encoding `?vahy=25-20-20-15-10-10` positionally depends on this.
  it("IS the published order, not a second copy of it", () => {
    expect(LENS_COMPONENT_ORDER).toEqual(COMPONENT_DEFS.map((c) => c.key as ComponentKey));
  });
});
