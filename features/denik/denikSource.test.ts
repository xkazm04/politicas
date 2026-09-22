import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the deník loader (scan-sweep 2026-09-08, civic-chronicle). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the deník loader reads shared grammars, not copies", () => {
  it("entity keys are parsed by deriveDenik.pspIdFromEntityKey, not a local regex", () => {
    const s = src("features/denik/getDenikData.ts");
    expect(s).toMatch(/\bpspIdFromEntityKey\b/);
    expect(s).not.toMatch(/poslanec:\\d\+/);
  });
  it("the tie review ladder is reviewStateOf, not a hand-spelled comparison", () => {
    const s = src("features/denik/getDenikData.ts");
    expect(s).toMatch(/import \{ reviewStateOf \} from "@\/features\/money\/reviewTypes"/);
    expect(s).not.toMatch(/payload\.review_state !== "verified"/);
  });
});
