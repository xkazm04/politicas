// Kniha vazeb najde firmu, i když čtenář nepíše s diakritikou.
//
// Do 2026-08-12 se v `TiesLedger` porovnávalo syrové `toLowerCase()`, takže
// „teplarny" MINULO Teplárny Brno — na ploše, jejíž jediné vyhledávací pole
// slouží k tomu, aby čtenář našel jednu z 211 vazeb. Tyhle testy nejdřív
// selhaly nad původním pravidlem (`raw.toLowerCase().includes(q)`), a to je
// jejich jediný důvod k existenci.

import { describe, expect, it } from "vitest";

import { foldTieQuery, tieMatches, tieSearchFold } from "./ledgerSearch";

/** Pravidlo, které tu stálo do 2026-08-12 — jen kvůli důkazu, co neuměla. */
const legacyMatch = (mp: string, company: string, ico: string, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    !needle ||
    mp.toLowerCase().includes(needle) ||
    company.toLowerCase().includes(needle) ||
    ico.includes(needle)
  );
};

const ROWS = [
  { mp: "Petr Hladík", company: "Teplárny Brno, a.s.", ico: "46347534" },
  { mp: "Josef Řezníček", company: "Vodovody a kanalizace Vsetín, a.s.", ico: "47674652" },
  { mp: "Andrej Babiš", company: "AGROFERT, a.s.", ico: "26185610" },
  { mp: "Marie Žáčková", company: "Nadační fond Čtyřlístek", ico: "02867681" },
];

const hits = (q: string) =>
  ROWS.filter((r) => tieMatches(tieSearchFold(r.mp, r.company, r.ico), foldTieQuery(q))).map(
    (r) => r.company,
  );

describe("hledání v knize vazeb — skládá se diakritika na OBOU stranách", () => {
  it.each([
    ["teplarny", "Teplárny Brno, a.s."],
    ["Teplárny", "Teplárny Brno, a.s."],
    ["reznicek", "Vodovody a kanalizace Vsetín, a.s."],
    ["vsetin", "Vodovody a kanalizace Vsetín, a.s."],
    ["zackova", "Nadační fond Čtyřlístek"],
    ["ctyrlistek", "Nadační fond Čtyřlístek"],
    ["babis", "AGROFERT, a.s."],
  ])("dotaz %s najde %s", (query, expected) => {
    expect(hits(query)).toContain(expected);
  });

  it("staré pravidlo tytéž řádky minulo — proto ta změna", () => {
    for (const q of ["teplarny", "reznicek", "zackova", "ctyrlistek", "babis"]) {
      const legacy = ROWS.filter((r) => legacyMatch(r.mp, r.company, r.ico, q));
      expect(legacy, `staré pravidlo mělo minout ${q}`).toHaveLength(0);
    }
  });

  it("IČO se hledá dál, i jako podřetězec", () => {
    expect(hits("46347534")).toEqual(["Teplárny Brno, a.s."]);
    expect(hits("2618")).toEqual(["AGROFERT, a.s."]);
  });

  it("prázdný a jen bílý dotaz nefiltruje nic", () => {
    expect(hits("")).toHaveLength(ROWS.length);
    expect(hits("   ")).toHaveLength(ROWS.length);
  });

  it("dotaz se ořezává, takže „ teplarny \" je týž dotaz", () => {
    expect(foldTieQuery("  TEPLÁRNY  ")).toBe("teplarny");
    expect(hits("  TEPLÁRNY  ")).toEqual(["Teplárny Brno, a.s."]);
  });

  it("složený tvar nese všechna tři pole a počítá se jednou na řádek", () => {
    expect(tieSearchFold("Petr Hladík", "Teplárny Brno, a.s.", "46347534")).toBe(
      "petr hladik teplarny brno, a.s. 46347534",
    );
  });
});
