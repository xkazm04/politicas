/*
 * ROK PODPISU MÁ TUTÉŽ HRANICI JAKO ZBYTEK APLIKACE.
 *
 * `supplierTrail.yearOf` si držel vlastní mez `y > 1900 && y < 2100`, přestože
 * `lib/analysis/plausible-date.ts` existuje s odůvodněním „aby hranice byla
 * v celé aplikaci jedna a stejná". Důsledek nebyl teoretický: ZAPSANÁ dávka
 * `municipalSuppliers.generated.ts` nese řádek `00279676 × Československá
 * obchodní banka` s rozsahem `2009|2043`, a `/rozpocty` ho vysázelo jako
 * „2009–2043“ vedle Σ hodnoty smluv obce.
 *
 * Testuje se to, co plocha OPRAVDU čte — tedy dekódování zapsané dávky —,
 * ne jen generátorová větev, která se při této změně nespustí.
 */

import { describe, expect, it } from "vitest";

import { PLAUSIBLE_FROM } from "@/lib/analysis/plausible-date";
import { SUPPLIERS_PACKED, SUPPLIERS_RETRIEVED_ON } from "./data/municipalSuppliers.generated";
import {
  getSupplierTable,
  isPlausibleSignatureYear,
  parseSupplierRows,
  rowTotalCzk,
  townSupplierSummary,
  type SupplierRow,
} from "./supplierTrail";

const TOWN = "00123456";
const SUP = "00654321";
const row = (firstYear: string, lastYear: string) =>
  `${TOWN}|${SUP}|Firma a.s.|2|100000|1|50000|${firstYear}|${lastYear}`;

describe("isPlausibleSignatureYear — mez je sdílená, ne soukromá", () => {
  it("dolní hranicí je rok vzniku ČR z lib/analysis/plausible-date", () => {
    const from = Number(PLAUSIBLE_FROM.slice(0, 4));
    expect(isPlausibleSignatureYear(from, SUPPLIERS_RETRIEVED_ON)).toBe(true);
    expect(isPlausibleSignatureYear(from - 1, SUPPLIERS_RETRIEVED_ON)).toBe(false);
    // Stará soukromá mez pouštěla všechno nad 1900 — tohle je ten rozdíl.
    expect(isPlausibleSignatureYear(1901, SUPPLIERS_RETRIEVED_ON)).toBe(false);
  });

  it("horní hranicí je den, ke kterému se registr ČETL — ne rok 2100", () => {
    const upper = Number(SUPPLIERS_RETRIEVED_ON.slice(0, 4));
    expect(isPlausibleSignatureYear(upper, SUPPLIERS_RETRIEVED_ON)).toBe(true);
    expect(isPlausibleSignatureYear(upper + 1, SUPPLIERS_RETRIEVED_ON)).toBe(false);
    // Roky, které stará mez pouštěla a korpus je opravdu nese:
    expect(isPlausibleSignatureYear(2027, "2026-07-27")).toBe(false);
    expect(isPlausibleSignatureYear(2029, "2026-07-27")).toBe(false);
    expect(isPlausibleSignatureYear(2043, "2026-07-27")).toBe(false);
  });
});

describe("parseSupplierRows — nemožný rok se potlačí, řádek zůstane", () => {
  it("běžný řádek prochází beze změny a nic nezamlčuje", () => {
    const [r] = parseSupplierRows(row("2009", "2019"));
    expect(r).toMatchObject({ firstYear: 2009, lastYear: 2019 });
    expect(r.yearsWithheld).toBeUndefined();
  });

  it("potlačí OBĚ meze, když je jedna nemožná — druhá by byla odhad", () => {
    const [r] = parseSupplierRows(row("2009", "2043"));
    expect(r.firstYear).toBeNull();
    expect(r.lastYear).toBeNull();
    expect(r.yearsWithheld).toBe(true);
    // Peníze ani počty se nezahazují: vadný je údaj o roce, ne smlouvy.
    expect(rowTotalCzk(r)).toBe(150000);
    expect(r.paidCount).toBe(2);
  });

  it("vadná STRUKTURA pořád hází — fail-loud kodeku se nemění", () => {
    expect(() => parseSupplierRows("vadny|radek")).toThrow(/vadný řádek/);
    // …ale vada DAT (nemožný rok) sekci dodavatelů neshodí.
    expect(() => parseSupplierRows(row("2009", "2043"))).not.toThrow();
  });

  it("řádek bez roku není řádek s potlačeným rokem", () => {
    const [r] = parseSupplierRows(row("", ""));
    expect(r.firstYear).toBeNull();
    expect(r.yearsWithheld).toBeUndefined();
  });
});

describe("zapsaná dávka /rozpocty", () => {
  it("nese přesně jeden řádek s nemožným rokem — a plocha ho už nevysází", () => {
    const rows = parseSupplierRows(SUPPLIERS_PACKED);
    const withheld = rows.filter((r) => r.yearsWithheld);
    expect(withheld).toHaveLength(1);
    expect(withheld[0]).toMatchObject({ townIc: "00279676", supplierIco: "00001350" });
    expect(withheld[0].firstYear).toBeNull();
    expect(withheld[0].lastYear).toBeNull();
    // Rozsah žádného řádku nesahá za den čtení registru.
    for (const r of rows) {
      if (r.lastYear !== null) expect(isPlausibleSignatureYear(r.lastYear, SUPPLIERS_RETRIEVED_ON)).toBe(true);
      if (r.firstYear !== null) expect(isPlausibleSignatureYear(r.firstYear, SUPPLIERS_RETRIEVED_ON)).toBe(true);
    }
  });

  it("obec ten řádek pořád má — jen bez rozsahu, a souhrn to počítá", () => {
    const s = townSupplierSummary("00279676", getSupplierTable());
    expect(s).not.toBeNull();
    expect(s!.yearsWithheldRows).toBe(1);
    // Potlačený řádek rozsah obce NEROZŠIŘUJE ani ho nenuluje.
    expect(s!.lastYear === null || isPlausibleSignatureYear(s!.lastYear, SUPPLIERS_RETRIEVED_ON)).toBe(true);
    expect(s!.rows.some((r) => r.supplierIco === "00001350")).toBe(true);
  });

  it("obec bez potlačeného řádku hlásí nulu, ne mlčení", () => {
    const s = townSupplierSummary("00064581", getSupplierTable()); // Praha
    expect(s!.yearsWithheldRows).toBe(0);
  });
});

describe("townSupplierSummary — potlačené se počítá zvlášť od chybějícího", () => {
  const mk = (over: Partial<SupplierRow>): SupplierRow => ({
    townIc: TOWN,
    supplierIco: SUP,
    supplierName: "Firma a.s.",
    companyId: `company:ico:${SUP}`,
    paidCount: 1,
    paidCzk: 100,
    otherCount: 0,
    otherCzk: 0,
    firstYear: null,
    lastYear: null,
    ...over,
  });

  it("nedatovaný řádek se do počtu potlačených nezapočítá", () => {
    const table = new Map([[TOWN, [mk({}), mk({ supplierIco: "00999999", firstYear: 2020, lastYear: 2021 })]]]);
    const s = townSupplierSummary(TOWN, table)!;
    expect(s.yearsWithheldRows).toBe(0);
    expect(s.firstYear).toBe(2020);
  });

  it("potlačený ano — a rozsah zůstává ze zdravých řádků", () => {
    const table = new Map([
      [TOWN, [mk({ yearsWithheld: true }), mk({ supplierIco: "00999999", firstYear: 2020, lastYear: 2021 })]],
    ]);
    const s = townSupplierSummary(TOWN, table)!;
    expect(s.yearsWithheldRows).toBe(1);
    expect(s).toMatchObject({ firstYear: 2020, lastYear: 2021 });
  });
});
