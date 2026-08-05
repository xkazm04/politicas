// Deník republiky — slovník druhů zápisu je DATA a testuje se jako data:
// úplnost (žádný druh bez klíče), tvar klíčů, a pravidlo o neznámém druhu.
// Copy samotné žije v messages/{cs,en}.json pod `denik.*` (2026-08-05) —
// modul vrací klíče, plocha překládá (vzor features/overeni/gateVocabulary.ts).

import { describe, expect, it } from "vitest";
import {
  DENIK_KIND_COPY_KEYS,
  DENIK_KIND_LABEL_KEYS,
  DENIK_KIND_UNMAPPED_KEY,
  denikKindInfo,
  TIME_BASIS_LABEL_KEYS,
  TIME_BASIS_TITLE_KEYS,
} from "./kindLabels";
import { DENIK_CHANGE_TYPES } from "./deriveDenik";

describe("slovník druhů", () => {
  it("každý druh má klíč do katalogu a žádný klíč není strojový token sám", () => {
    for (const [kind, key] of Object.entries(DENIK_KIND_LABEL_KEYS)) {
      expect(key).toMatch(/^kind\.[a-zA-Z]+$/);
      expect(key).not.toBe(kind);
    }
    // Klíče jsou navzájem různé — dva druhy nesmí sdílet jednu větu.
    expect(new Set(Object.values(DENIK_KIND_LABEL_KEYS)).size).toBe(
      Object.keys(DENIK_KIND_LABEL_KEYS).length,
    );
  });

  it("mandátové a orgánové proudy mají vlastní klíč, ne „zápis do grafu“", () => {
    // Devět change typů, tři druhy — a zánik mandátu se nesmí schovat pod
    // technickou událost úložiště.
    expect(DENIK_CHANGE_TYPES.length).toBe(9);
    expect(DENIK_KIND_LABEL_KEYS.mandate).not.toBe(DENIK_KIND_LABEL_KEYS.change);
    expect(DENIK_KIND_LABEL_KEYS.organRole).not.toBe(DENIK_KIND_LABEL_KEYS.change);
    expect(DENIK_KIND_LABEL_KEYS.organRole).not.toBe(DENIK_KIND_LABEL_KEYS.roleStart);
  });

  it("neznámý druh dostane unmapped klíč a nese svůj token DOSLOVA — nikdy nezmizí", () => {
    expect(denikKindInfo("contract")).toEqual({
      token: "contract",
      known: true,
      labelKey: "kind.contract",
    });
    expect(denikKindInfo("budouciDruh")).toEqual({
      token: "budouciDruh",
      known: false,
      labelKey: DENIK_KIND_UNMAPPED_KEY,
    });
  });

  it("obě časové osy mají štítek i výklad a klíče se nepřekrývají", () => {
    expect(TIME_BASIS_LABEL_KEYS.ucinne).not.toBe(TIME_BASIS_LABEL_KEYS.zaznamenano);
    expect(TIME_BASIS_TITLE_KEYS.ucinne).not.toBe(TIME_BASIS_LABEL_KEYS.ucinne);
    expect(TIME_BASIS_TITLE_KEYS.zaznamenano).not.toBe(TIME_BASIS_LABEL_KEYS.zaznamenano);
  });

  it("soupis klíčů pro katalog je úplný a bez duplicit", () => {
    expect(new Set(DENIK_KIND_COPY_KEYS).size).toBe(DENIK_KIND_COPY_KEYS.length);
    expect(DENIK_KIND_COPY_KEYS).toContain("kind.unmapped");
    expect(DENIK_KIND_COPY_KEYS).toContain("timeBasis.ucinneTitle");
  });
});
