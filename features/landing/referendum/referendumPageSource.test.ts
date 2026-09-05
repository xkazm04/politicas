import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* /referendum — stavy urny, které stránka musí umět vyslovit. Grep přes zdroj
 * (repozitář nemá jsdom; precedens hardcodedCopy.test.ts vedle). */

const src = readFileSync("features/landing/referendum/ReferendumPage.tsx", "utf8");

describe("ReferendumPage — urna", () => {
  it("vektor bez čočky (součet 0) urnu zavírá týmž pravidlem jako agregát a řekne to", () => {
    expect(src).toMatch(/carriesLens\(lens\.weights\)/);
    expect(src).toMatch(/disabled=\{[^}]*emptyLens[^}]*\}/);
    expect(src).toMatch(/emptyLens\s*\?\s*"[^"]*součet[^"]*"/);
  });

  it("zamítnutý slib serverové akce končí ve stavu `failed`, ne v tichu", () => {
    expect(src).toMatch(/try \{\s*const res = await submitLensVector\(/);
    expect(src).toMatch(/catch \(err\) \{[\s\S]*?setSessionBallot\("failed"\)/);
  });
});
