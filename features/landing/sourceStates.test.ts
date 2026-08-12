// Projekce atlasu na fasádu — tři pravidla, která rubrika „Surový materiál"
// nesmí ztratit: nehodnoceno není nula, pokrytí se nepočítá podruhé, pořadí je
// pořadí atlasu. Testuje se přes SKUTEČNÝ `deriveAtlas`, ne přes ručně psaný
// report: kdyby se tvar skóre v atlasu změnil, tenhle test to má poznat.

import { describe, expect, it } from "vitest";

import { deriveAtlas } from "@/lib/analysis/atlas";
import { landingSourceStates } from "./sourceStates";

const NOW = "2026-08-12T00:00:00.000Z";

describe("landingSourceStates", () => {
  it("nečitelný atlas prochází jako null — fasáda pak nedopisuje kadence", () => {
    expect(landingSourceStates(null)).toBeNull();
  });

  it("nehodnocenou dimenzi překlápí na null, nikdy na 0", () => {
    // Zdroj bez řádků a bez běhu: pokrytí i souhrn jsou bez podkladu.
    const report = deriveAtlas({ now: NOW, entityCoverage: [], runStats: [] });
    const rows = landingSourceStates(report);
    expect(rows).not.toBeNull();
    const psp = rows!.find((r) => r.source === "psp-poslanci");
    expect(psp).toBeDefined();
    expect(psp!.coveragePct).toBeNull();
    expect(psp!.staleness).toBeNull();
    // Úplnost je hodnocená (kontext zdroje existuje), takže souhrn je „částečné"
    // — a rozhodně ne nula za nezměřené dimenze.
    expect(psp!.composite.status).toBe("částečné");
    expect(psp!.composite.evaluated).toBeLessThan(psp!.composite.of);
  });

  it("pokrytí bere ze skóre dimenze, ne z druhého podílu nad řádky", () => {
    const report = deriveAtlas({
      now: NOW,
      entityCoverage: [{ source: "psp-poslanci", entity: "person", rows: 8, rowsWithRun: 2 }],
      runStats: [],
    });
    const psp = landingSourceStates(report)!.find((r) => r.source === "psp-poslanci")!;
    const dim = report.sources.find((s) => s.source === "psp-poslanci")!.dimensions.coverage;
    expect(dim.status).toBe("hodnoceno");
    expect(psp.coveragePct).toBe(dim.status === "hodnoceno" ? dim.score : null);
    expect(psp.rowsTotal).toBe(8);
  });

  it("drží pořadí atlasu (klíč zdroje vzestupně), nepřerovnává podle skóre", () => {
    const report = deriveAtlas({
      now: NOW,
      // Zdroj s vysokým pokrytím schválně jako poslední v abecedě.
      entityCoverage: [
        { source: "zzz-cizi-zdroj", entity: "person", rows: 10, rowsWithRun: 10 },
        { source: "psp-poslanci", entity: "person", rows: 10, rowsWithRun: 1 },
      ],
      runStats: [],
    });
    const rows = landingSourceStates(report)!;
    expect(rows.map((r) => r.source)).toEqual([...rows.map((r) => r.source)].sort());
    expect(rows.at(-1)!.source).toBe("zzz-cizi-zdroj");
  });

  it("nedokumentovaný zdroj se ukáže taky — s poctivým nehodnoceno v úplnosti", () => {
    const report = deriveAtlas({
      now: NOW,
      entityCoverage: [{ source: "zzz-cizi-zdroj", entity: "person", rows: 4, rowsWithRun: 4 }],
      runStats: [],
    });
    const row = landingSourceStates(report)!.find((r) => r.source === "zzz-cizi-zdroj")!;
    expect(row.coveragePct).toBe(100);
    expect(row.composite.status).toBe("částečné");
  });

  it("čerstvost proti deklarované kadenci prochází jako slovo, ne jako číslo", () => {
    const report = deriveAtlas({
      now: NOW,
      entityCoverage: [{ source: "psp-poslanci", entity: "person", rows: 1, rowsWithRun: 1 }],
      runStats: [
        {
          source: "psp-poslanci",
          okFinishedRuns: 2,
          sealedRuns: 1,
          // 3 dny zpět proti deklarované kadenci 7 dní ⇒ „čerstvé".
          lastOkFinishedAt: "2026-08-09T00:00:00.000Z",
        },
      ],
    });
    const row = landingSourceStates(report)!.find((r) => r.source === "psp-poslanci")!;
    expect(row.staleness).toBe("čerstvé");
    expect(row.composite.status).toBe("hodnoceno");
    expect(row.composite.evaluated).toBe(4);
  });
});
