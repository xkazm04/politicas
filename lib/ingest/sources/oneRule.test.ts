import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

const PSP = read("lib/ingest/sources/psp.ts");
const ACT = read("lib/ingest/sources/psp-activity.ts");
const LEG = read("lib/ingest/sources/psp-legislation.ts");

describe("one definition per shared psp rule (2026-09-06, parity-auditor)", () => {
  it("unlOf lives once (lib/ingest/unlMembers.ts); the three adapters import it", () => {
    // Three byte-identical copies of „decode + parse one UNL member, missing → []".
    for (const [name, src] of [["psp.ts", PSP], ["psp-activity.ts", ACT], ["psp-legislation.ts", LEG]] as const) {
      expect(src, name).not.toMatch(/function unlOf\(/);
      expect(src, name).toMatch(/import \{ unlOf \} from "\.\.\/unlMembers"/);
    }
  });

  it("the MP-authored-bill universe is filtered once (mpAuthoredBillIds)", () => {
    // billsAndWrittenInterp and splitBillAuthorship each spelled the druh/navrh/term
    // filter; the test that their counts agree guarded the drift, the code invited it.
    expect(ACT.match(/MP_ORIGIN_NAVRH\.has\(/g)?.length ?? 0).toBe(1);
    expect(ACT.match(/mpAuthoredBillIds\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("the ORGAN<n> term-code fallback is termCode()'s, not re-spelled", () => {
    expect(PSP).not.toMatch(/`ORGAN\$\{/);
    expect(PSP.match(/termCode\(null, /g)?.length ?? 0).toBe(2);
  });
});
