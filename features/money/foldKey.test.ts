// JEDNO SCHÉMA SKLÁDÁNÍ DIAKRITIKY, ne dvě.
//
// `reviewTypes.foldKey` bylo do 2026-08-12 druhé, money-lokální skládání
// (`normalize("NFD")` + odstranění kombinujících znamének) vedle `asciiFold()`,
// které při ingestu plní `person.name_norm`. Dvě schémata nad jedním korpusem
// jsou pozvánka k tomu, aby jedna plocha našla to, co druhá ne — a rozcházejí
// se přesně tam, kde se kanonický rozklad nekoná (`đ`, `ø`, `ß`, `æ`, `œ`).
//
// `foldKey` teď volá `asciiFold`. Protože na něm stojí HEURISTIKA `classifyTie`
// — tedy třída vazby, kterou plocha vykresluje, když ji na hraně nikdo
// nezaznamenal — musí být záměna prokazatelně beze změny chování, ne
// pravděpodobně beze změny. Tenhle test to drží ze dvou stran:
//   1. na českých znacích, které NFD rozkládá (ď/ť/ň/ř/ů/š/č/ž/é/í),
//      dávají obě schémata týž výsledek;
//   2. `classifyTie` vrací pro reprezentativní vstupy živého korpusu
//      (i pro ty, kde se stará třída se zapsanou rozchází) tutéž třídu.

import { describe, expect, it } from "vitest";

import { asciiFold } from "@/lib/ingest/normalize";
import { classifyTie, foldKey } from "./reviewTypes";

/** Schéma, které tu stálo do 2026-08-12 — jen kvůli důkazu shody. */
function legacyFoldKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

describe("foldKey — jedna funkce, ta ingestová", () => {
  it("je doslova asciiFold", () => {
    for (const s of ["Teplárny Brno, a.s.", "  DVĚ   MEZERY  ", "IČO 46347534"]) {
      expect(foldKey(s)).toBe(asciiFold(s));
    }
  });

  // Písmena, na kterých heuristika skutečně stojí: `předseda představenstva`,
  // `pověřený vlastník`, `Vodovody a kanalizace Vsetín`, `Společenství vlastníků`.
  it.each([
    "ďábel",
    "ťuknout",
    "ňadro",
    "Řehoř",
    "Žáček",
    "Půjčovna Ústí",
    "předseda představenstva",
    "pověřený vlastník",
    "Vodovody a kanalizace Vsetín, a.s.",
    "Společenství vlastníků Vlastislavova 605/20, Praha 4",
    "Pojišťovna VZP, a.s.",
    "Komwag, podnik čistoty a údržby města, a.s.",
    "Městská nemocnice Ostrava, příspěvková organizace",
    "Dopravní podnik města Brna, a.s.",
  ])("na českém vstupu %s dává týž tvar jako staré NFD schéma", (input) => {
    expect(foldKey(input)).toBe(legacyFoldKey(input));
  });

  it("skládá i znaky, které se kanonicky NEROZKLÁDAJÍ — tam se schémata lišila", () => {
    // Přesně ten důvod, proč zůstává tabulka a ne NFD: staré schéma je nechalo projít.
    expect(foldKey("Đorđević")).toBe("dordevic");
    expect(legacyFoldKey("Đorđević")).not.toBe("dordevic");
    expect(foldKey("Straße")).toBe("strasse");
  });
});

describe("classifyTie — záměna schématu nemění ani jednu vykreslenou třídu", () => {
  // Vstupy jsou role × název firmy tak, jak je nese živý korpus; očekávané
  // třídy jsou tytéž, jaké pinuje tieClass.test.ts nad zapsanými hodnotami.
  it.each([
    ["jednatel", "Alfa s.r.o.", "owner-operator"],
    ["společník", "Beta Trade s.r.o.", "owner-operator"],
    ["pověřený vlastník", "Společenství vlastníků Vlastislavova 605/20, Praha 4", "owner-operator"],
    ["člen představenstva", "Komwag, podnik čistoty a údržby města, a.s.", "manager"],
    ["člen představenstva", "Pojišťovna VZP, a.s.", "manager"],
    ["předseda představenstva", "Vodovody a kanalizace Vsetín, a.s.", "steward"],
    ["člen dozorčí rady", "Městská nemocnice Ostrava, příspěvková organizace", "steward"],
    ["člen představenstva", "Dopravní podnik města Brna, a.s.", "steward"],
    ["místopředseda dozorčí rady", "Nadační fond Řehoře", "steward"],
    ["jednatel", "Vodovody a kanalizace Vyškov,a.s.", "steward"],
  ] as const)("%s × %s → %s", (role, company, expected) => {
    expect(classifyTie(role, company)).toBe(expected);
  });
});
