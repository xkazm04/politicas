// Copy panelu vývoje se 2026-08-05 přestěhovala do katalogů (`civicscore.trend*`),
// ale její čeští buildeři tu žili dál jako „referenční kopie" bez jediného volajícího.
// Pět mrtvých vět a testy nad nimi vypadaly jako pokrytí té plochy — přitom
// nekontrolovaly nic, co by se čtenáři vykreslilo. Smazáno 2026-08-12; jazyková
// brána nad ŽIVÝM zněním běží v ./messages.test.ts (blok „trend*"), takže se
// pokrytí neztratilo, jen přesunulo tam, kde je copy doopravdy.

import { describe, expect, it } from "vitest";

import { priorTermVoteDump } from "./trendCopy";

describe("priorTermVoteDump", () => {
  it("jmenuje dump jen pro období, které ho má", () => {
    expect(priorTermVoteDump("PSP9")).toBe("hl-2021ps.zip");
  });

  it("pro ostatní období si žádný soubor nevymyslí", () => {
    // Věta v panelu na null reaguje tím, že dump vůbec nezmíní — nikdy odhadem
    // odvozeným z čísla období (např. „hl-2017ps.zip"), který na psp.cz nemusí být.
    for (const term of ["PSP8", "PSP10", "", "psp9"]) {
      expect(priorTermVoteDump(term), term).toBeNull();
    }
  });
});
