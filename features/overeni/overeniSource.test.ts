import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the claim gate's own files (scan-sweep 2026-09-08, claim-verifier). */

const src = (p: string) => readFileSync(p, "utf8");

describe("identifiers reach the catalog as strings, never as numbers next-intl would group", () => {
  it("the graph pass and the guide step number are passed as String(...)", () => {
    const s = src("features/overeni/OvereniPage.tsx");
    expect(s).not.toMatch(/\{ pass: then\.provenance\.pass \}/);
    expect(s).not.toMatch(/\{ pass: r\.provenance\.pass \}/);
    expect(s).not.toMatch(/\{ no: step\.no \}/);
    expect(s.match(/pass: String\((then|r)\.provenance\.pass\)/g)?.length).toBe(2);
    expect(s).toMatch(/no: String\(step\.no\)/);
  });
});

describe("the live re-derivation dates itself by the Prague day, not the UTC day", () => {
  it("liveFigures imports pragueDay and keeps no toISOString().slice(0, 10) of its own", () => {
    const s = src("features/overeni/liveFigures.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});
