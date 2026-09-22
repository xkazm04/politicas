import { describe, expect, it } from "vitest";
import { isMunicipalOrSoe, sectorOf } from "./company-sectors";

/* The sector heuristic feeds the sector-adjacency conflict signal (triage-core.ts) and, through
 * the batch-017 payload, a public surface (/zakony sector attribution). Its own P42 doctrine —
 * "never bare substring on Czech" — was broken by one alternative: `IT\b` under the /i flag is
 * a SUFFIX match, so every label ending in "-it" (audit, kredit, profit, transit) read as
 * digital. 0 realised hits over the 156 corpus labels (probed 2026-09-07), 1 reproduced below. */

describe("sectorOf — keyword net", () => {
  it("IT is a whole word, not a suffix", () => {
    expect(sectorOf("IT Systems s.r.o.")).toBe("digital");
    expect(sectorOf("AUDIT PARTNER s.r.o.")).toBeNull();
    expect(sectorOf("Kredit Plus a.s.")).toBeNull();
  });

  it("explicit overrides win over the keyword net", () => {
    expect(sectorOf("NEXNET, a.s.")).toBe("digital");
    expect(sectorOf("Robert Bosch, spol. s r.o.")).toBe("economy");
    expect(sectorOf("SynBiol, a.s.")).toBe("environment");
  });

  it("an unrecognised name is null, never guessed", () => {
    expect(sectorOf("Alfa Omega s.r.o.")).toBeNull();
  });
});

describe("isMunicipalOrSoe — public ownership excludes from the signal", () => {
  it("explicit list and keyword net", () => {
    expect(isMunicipalOrSoe("ČEPRO, a.s.")).toBe(true);
    expect(isMunicipalOrSoe("SOMPO, a.s.")).toBe(true);
    expect(isMunicipalOrSoe("Vodovody a kanalizace Brno, a.s.")).toBe(true);
    expect(isMunicipalOrSoe("Dopravní podnik hl. m. Prahy, a.s.")).toBe(true);
    expect(isMunicipalOrSoe("AGROFERT, a.s.")).toBe(false);
  });
});
