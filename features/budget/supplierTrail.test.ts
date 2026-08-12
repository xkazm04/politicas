import { describe, expect, it } from "vitest";

import {
  asCzk,
  deriveMunicipalSupplierRows,
  getSupplierTable,
  icoFromCompanyId,
  normalizeIco,
  packSupplierRows,
  parseSupplierRows,
  peerSupplierTotals,
  rowTotalCzk,
  supplierCoverage,
  supplierPeerStats,
  townSupplierSummary,
  type ContractNodeLike,
  type SuppliesEdgeLike,
  type SupplierRow,
} from "./supplierTrail";
import { SUPPLIERS_PACKED } from "./data/municipalSuppliers.generated";

/* ── Pomocníci fixtur ─────────────────────────────────────────────────────── */

const TOWN = "00300100"; // fiktivní obec v rejstříku fixtury
const TOWN2 = "00300200";
const SUP = "45274649"; // fiktivní firma grafu
const SUP2 = "25596641";

const munis = new Set([TOWN, TOWN2]);
const labels = new Map([
  [SUP, "ČEZ, a. s."],
  [SUP2, "Stavby s.r.o."],
]);

const contract = (
  id: string,
  props: Record<string, unknown> | null,
): ContractNodeLike => ({ id, props });

const edge = (supIco: string, contractId: string, weight: unknown): SuppliesEdgeLike => ({
  src: `company:ico:${supIco}`,
  dst: contractId,
  weight,
});

const derive = (contracts: ContractNodeLike[], supplies: SuppliesEdgeLike[]) =>
  deriveMunicipalSupplierRows({ contracts, supplies, companyLabelByIco: labels, municipalIcs: munis });

/* ── Normalizace vstupů ───────────────────────────────────────────────────── */

describe("normalizeIco / icoFromCompanyId / asCzk", () => {
  it("pads short IČO to 8 digits and rejects anything non-numeric", () => {
    expect(normalizeIco("64581")).toBe("00064581");
    expect(normalizeIco(64581)).toBe("00064581");
    expect(normalizeIco("00064581")).toBe("00064581");
    expect(normalizeIco("6458a")).toBeNull();
    expect(normalizeIco("123456789")).toBeNull(); // 9 číslic není IČO
    expect(normalizeIco(null)).toBeNull();
    expect(normalizeIco("")).toBeNull();
  });

  it("extracts the IČO only from a well-formed company node id", () => {
    expect(icoFromCompanyId("company:ico:00064581")).toBe("00064581");
    expect(icoFromCompanyId("psp:person:123")).toBeNull();
    expect(icoFromCompanyId("company:ico:64581")).toBeNull();
  });

  it("parses numeric strings and treats absence as 0, never NaN", () => {
    expect(asCzk(1500)).toBe(1500);
    expect(asCzk("1500")).toBe(1500);
    expect(asCzk(null)).toBe(0);
    expect(asCzk("smlouva")).toBe(0);
  });
});

/* ── Odvození spojení IČO ─────────────────────────────────────────────────── */

describe("deriveMunicipalSupplierRows", () => {
  it("joins a two-party town-publisher contract and proves payment direction", () => {
    const contracts = [
      contract("contract:1", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [{ ico: SUP, nazev: "ČEZ", platce: false, prijemce: true }],
        partyDirections: { [SUP]: "recipient" },
        signedOn: "2023-05-01",
      }),
    ];
    const { rows, stats } = derive(contracts, [edge(SUP, "contract:1", 100_000)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      townIc: TOWN,
      supplierIco: SUP,
      supplierName: "ČEZ, a. s.",
      companyId: `company:ico:${SUP}`,
      paidCount: 1,
      paidCzk: 100_000,
      otherCount: 0,
      otherCzk: 0,
      firstYear: 2023,
      lastYear: 2023,
    });
    expect(stats).toMatchObject({ municipalContracts: 1, paidContracts: 1 });
  });

  it("keeps unknown-direction contracts in the 'other' bucket — never infers payment", () => {
    const contracts = [
      contract("contract:2", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [{ ico: SUP, nazev: "ČEZ", platce: false, prijemce: false }],
        partyDirections: { [SUP]: "unknown" },
        signedOn: "2021-01-02",
      }),
    ];
    const { rows, stats } = derive(contracts, [edge(SUP, "contract:2", 50_000)]);
    expect(rows[0]).toMatchObject({ paidCount: 0, paidCzk: 0, otherCount: 1, otherCzk: 50_000 });
    expect(stats.paidContracts).toBe(0);
  });

  it("demotes recipient direction to 'other' when the contract has more than two sides", () => {
    // Firma je příjemcem, ale strany jsou tři — kdo platí, záznam nedokládá.
    const contracts = [
      contract("contract:3", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [
          { ico: SUP, nazev: "ČEZ", platce: false, prijemce: true },
          { ico: null, nazev: "Bytové družstvo", platce: false, prijemce: false },
        ],
        partyDirections: { [SUP]: "recipient" },
        signedOn: "2022-03-03",
      }),
    ];
    const { rows } = derive(contracts, [edge(SUP, "contract:3", 70_000)]);
    expect(rows[0]).toMatchObject({ paidCount: 0, otherCount: 1, otherCzk: 70_000 });
  });

  it("drops payers outside the municipal registry instead of guessing the founder", () => {
    // Příspěvkovka (IČO mimo rejstřík obcí) NENÍ obec — smlouva se nepřipíše.
    const contracts = [
      contract("contract:4", {
        publisher: { ico: "70890001", nazev: "Technické služby obce" },
        parties: [{ ico: SUP, nazev: "ČEZ", platce: false, prijemce: true }],
        partyDirections: { [SUP]: "recipient" },
        signedOn: "2022-01-01",
      }),
    ];
    const { rows, stats } = derive(contracts, [edge(SUP, "contract:4", 999_999)]);
    expect(rows).toHaveLength(0);
    expect(stats.municipalContracts).toBe(0);
  });

  it("finds the town when it appears among parties (published by the other side)", () => {
    const contracts = [
      contract("contract:5", {
        publisher: { ico: SUP, nazev: "ČEZ" },
        parties: [{ ico: TOWN, nazev: "Obec", platce: false, prijemce: false }],
        partyDirections: { [SUP]: "unknown" },
        signedOn: "2024-06-06",
      }),
    ];
    const { rows } = derive(contracts, [edge(SUP, "contract:5", 10_000)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].townIc).toBe(TOWN);
  });

  it("skips the town contracting with itself (towns exist in the graph as companies)", () => {
    const contracts = [
      contract("contract:6", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [{ ico: TOWN, nazev: "Obec", platce: false, prijemce: true }],
        partyDirections: { [TOWN]: "recipient" },
        signedOn: "2022-01-01",
      }),
    ];
    const { rows, stats } = derive(contracts, [edge(TOWN, "contract:6", 5_000)]);
    expect(rows).toHaveLength(0);
    expect(stats.municipalContracts).toBe(0);
  });

  it("credits a multi-town contract to each town whole and counts the disclosure stat", () => {
    const contracts = [
      contract("contract:7", {
        publisher: { ico: TOWN, nazev: "Obec A" },
        parties: [
          { ico: TOWN2, nazev: "Obec B", platce: false, prijemce: false },
          { ico: SUP, nazev: "ČEZ", platce: false, prijemce: false },
        ],
        partyDirections: { [SUP]: "unknown" },
        signedOn: "2023-01-01",
      }),
    ];
    const { rows, stats } = derive(contracts, [edge(SUP, "contract:7", 40_000)]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.townIc).sort()).toEqual([TOWN, TOWN2]);
    expect(rows.every((r) => r.otherCzk === 40_000)).toBe(true);
    expect(stats.multiTownContracts).toBe(1);
  });

  it("is deterministic: towns ascending, total CZK descending, IČO as tiebreak", () => {
    const contracts = [
      contract("contract:8", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [{ ico: SUP, nazev: "ČEZ", platce: false, prijemce: false }],
        partyDirections: { [SUP]: "unknown" },
        signedOn: "2020-01-01",
      }),
      contract("contract:9", {
        publisher: { ico: TOWN, nazev: "Obec" },
        parties: [{ ico: SUP2, nazev: "Stavby", platce: false, prijemce: false }],
        partyDirections: { [SUP2]: "unknown" },
        signedOn: "2025-01-01",
      }),
    ];
    const supplies = [edge(SUP, "contract:8", 10_000), edge(SUP2, "contract:9", 90_000)];
    const { rows } = derive(contracts, supplies);
    expect(rows.map((r) => r.supplierIco)).toEqual([SUP2, SUP]);
    // roky se drží po dodavatelích, ne po obci
    expect(rows[1]).toMatchObject({ firstYear: 2020, lastYear: 2020 });
  });
});

/* ── Kodek round-trip ─────────────────────────────────────────────────────── */

describe("packSupplierRows / parseSupplierRows", () => {
  const row: SupplierRow = {
    townIc: TOWN,
    supplierIco: SUP,
    supplierName: "ČEZ, a. s.",
    companyId: `company:ico:${SUP}`,
    paidCount: 2,
    paidCzk: 150_000,
    otherCount: 1,
    otherCzk: 9_999.6,
    firstYear: 2021,
    lastYear: null,
  };

  it("round-trips rows (CZK rounded to whole crowns by the pack step)", () => {
    const parsed = parseSupplierRows(packSupplierRows([row]));
    expect(parsed).toEqual([{ ...row, otherCzk: 10_000 }]);
  });

  it("fails loud on malformed rows instead of degrading silently", () => {
    expect(() => parseSupplierRows("vadny|radek")).toThrow(/vadný řádek/);
    expect(() => parseSupplierRows(`${TOWN}|${SUP}|X|0|0|0|0||`)).toThrow(/vadný řádek/); // 0 smluv není řádek
    expect(() => packSupplierRows([{ ...row, supplierName: "a|b" }])).toThrow(/nepovolený znak/);
    expect(() => packSupplierRows([{ ...row, townIc: "123" }])).toThrow(/vadné IČO/);
  });

  it("parses the shipped generated batch without a single malformed line", () => {
    const rows = parseSupplierRows(SUPPLIERS_PACKED);
    expect(rows.length).toBeGreaterThan(500);
    expect(supplierCoverage(getSupplierTable()).townsInRecord).toBeGreaterThan(100);
  });
});

/* ── Souhrny a srovnání s vrstevníky ──────────────────────────────────────── */

const table = new Map<string, SupplierRow[]>([
  [
    TOWN,
    [
      {
        townIc: TOWN,
        supplierIco: SUP,
        supplierName: "ČEZ, a. s.",
        companyId: `company:ico:${SUP}`,
        paidCount: 1,
        paidCzk: 100,
        otherCount: 1,
        otherCzk: 50,
        firstYear: 2021,
        lastYear: 2024,
      },
    ],
  ],
  [
    TOWN2,
    [
      {
        townIc: TOWN2,
        supplierIco: SUP,
        supplierName: "ČEZ, a. s.",
        companyId: `company:ico:${SUP}`,
        paidCount: 0,
        paidCzk: 0,
        otherCount: 2,
        otherCzk: 300,
        firstYear: null,
        lastYear: null,
      },
    ],
  ],
]);

describe("townSupplierSummary", () => {
  it("aggregates totals and the proven-payment split", () => {
    const s = townSupplierSummary(TOWN, table);
    expect(s).toMatchObject({
      totalCzk: 150,
      paidCzk: 100,
      contractCount: 2,
      paidContractCount: 1,
      supplierCount: 1,
    });
    expect(rowTotalCzk(s!.rows[0])).toBe(150);
  });

  it("returns null for a town absent from the record — absence is not zero", () => {
    expect(townSupplierSummary("00999999", table)).toBeNull();
  });

  /*
   * The YEAR SPAN of the summed contract value (2026-08-12). Without it the
   * card's Σ — 38,78 mld. Kč for Prague — reads as an annual flow, when it is
   * the value of contracts signed between 1995 and 2026.
   */
  it("spans the signature years of the rows it sums", () => {
    const s = townSupplierSummary(TOWN, table);
    expect(s).toMatchObject({ firstYear: 2021, lastYear: 2024 });
  });

  it("a row with no signature date neither widens the span nor zeroes it", () => {
    // A missing date is not year 0 — the same stance the row itself takes.
    expect(townSupplierSummary(TOWN2, table)).toMatchObject({ firstYear: null, lastYear: null });

    const mixed = new Map<string, SupplierRow[]>([
      [
        TOWN,
        [
          { ...table.get(TOWN)![0], firstYear: null, lastYear: null },
          { ...table.get(TOWN)![0], supplierIco: SUP2, firstYear: 2019, lastYear: 2020 },
        ],
      ],
    ]);
    expect(townSupplierSummary(TOWN, mixed)).toMatchObject({ firstYear: 2019, lastYear: 2020 });
  });
});

describe("supplierPeerStats / peerSupplierTotals", () => {
  it("computes the peer median only over peers that share the supplier", () => {
    expect(supplierPeerStats(SUP, [TOWN2, "00999999"], table)).toEqual({
      medianCzk: 300,
      peerTownCount: 1,
    });
  });

  it("yields null median when no peer shares the supplier (never zero)", () => {
    expect(supplierPeerStats(SUP2, [TOWN2], table)).toEqual({ medianCzk: null, peerTownCount: 0 });
  });

  it("computes peer totals only over peers present in the record", () => {
    expect(peerSupplierTotals([TOWN, TOWN2, "00999999"], table)).toEqual({
      medianCzk: 225,
      sampleSize: 2,
    });
    expect(peerSupplierTotals(["00999999"], table)).toEqual({ medianCzk: null, sampleSize: 0 });
  });
});
