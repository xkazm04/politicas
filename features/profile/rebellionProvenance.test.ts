import { describe, expect, it } from "vitest";
import { summarizeRebellionProvenance } from "./rebellionProvenance";

// Tvar, který na hranu doopravdy zapisuje `scripts/data-analysis/kg-compute.ts`:
// { pass, method: "deterministic", ref: "kg-compute:rebels_against", computedAt }.
const row = (over: Partial<Parameters<typeof summarizeRebellionProvenance>[0][number]> = {}) => ({
  pass: 10,
  ref: "kg-compute:rebels_against",
  computedAt: "2026-07-24T09:00:00.000Z",
  ...over,
});

describe("summarizeRebellionProvenance", () => {
  it("shodné řádky dají jeden datovaný původ (den, ne okamžik)", () => {
    expect(summarizeRebellionProvenance([row(), row()])).toEqual({
      state: "uniform",
      pass: 10,
      ref: "kg-compute:rebels_against",
      computedAt: "2026-07-24",
    });
  });

  it("hrana bez data je pořád hrana se známým průchodem", () => {
    expect(summarizeRebellionProvenance([row({ computedAt: null })])).toEqual({
      state: "uniform",
      pass: 10,
      ref: "kg-compute:rebels_against",
      computedAt: null,
    });
  });

  it("nesmyslné datum není datum a neopravuje se na žádné", () => {
    expect(summarizeRebellionProvenance([row({ computedAt: "kdysi" })])).toEqual({
      state: "uniform",
      pass: 10,
      ref: "kg-compute:rebels_against",
      computedAt: null,
    });
  });

  it("ROZEJITÉ řádky jsou neshoda, NE mezera", () => {
    // Tohle je celý důvod, proč tenhle modul existuje. První podoba agregace
    // (inline ve stránce) vrátila při rozejitých řádcích tentýž stav jako u hrany
    // BEZ původu, a spis pak tiskl „průchod ani den přepočtu hrana neuvádí"
    // o řádcích, které průchod nesou — jen každý jiný.
    const mixed = summarizeRebellionProvenance([row(), row({ pass: 11 })]);
    expect(mixed).toEqual({ state: "mixed", distinctCount: 2 });
    expect(mixed.state).not.toBe("absent");
  });

  it("dva dny téhož průchodu jsou taky neshoda — agregát se nemá čím datovat", () => {
    expect(
      summarizeRebellionProvenance([row(), row({ computedAt: "2026-07-25T09:00:00.000Z" })]),
    ).toEqual({ state: "mixed", distinctCount: 2 });
  });

  it("žádný řádek → citace nemá co pojmenovat", () => {
    expect(summarizeRebellionProvenance([])).toEqual({ state: "absent" });
  });

  it("půl zápisu původu je chybějící zápis původu", () => {
    // Věta zní „průchod {pass} · {ref}". Bez refu by se interpolovala prázdnota,
    // bez passu by se tvrdil ref bez průchodu — obojí je citace, která necituje.
    expect(summarizeRebellionProvenance([row({ ref: null })])).toEqual({ state: "absent" });
    expect(summarizeRebellionProvenance([row({ pass: null })])).toEqual({ state: "absent" });
    expect(summarizeRebellionProvenance([row({ ref: "" })])).toEqual({ state: "absent" });
    expect(summarizeRebellionProvenance([row({ pass: Number.NaN })])).toEqual({ state: "absent" });
  });

  it("je deterministické bez ohledu na pořadí řádků", () => {
    const a = summarizeRebellionProvenance([row(), row({ pass: 11 }), row({ pass: 12 })]);
    const b = summarizeRebellionProvenance([row({ pass: 12 }), row({ pass: 11 }), row()]);
    expect(a).toEqual(b);
  });
});
