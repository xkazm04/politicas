import { describe, expect, it } from "vitest";
import {
  buildCompanyIcoResolver,
  buildSectorAttributionIndex,
  groupSectorAttributionFlags,
  projectSectorAttributionFlag,
  type SectorAttributionRaw,
} from "./sectorAttribution";

const VALID_DISPOSITION =
  "archivovaný posudek k tisku 11 shodu sektoru uzavřel jako shodu okolností bez mechanické vazby na předmět novely";

function row(overrides: Partial<SectorAttributionRaw> = {}): SectorAttributionRaw {
  return {
    cislo: 11,
    company: "IF Holding a.s.",
    sector: "economy",
    sponsor: "Radim Fiala",
    viaLawRef: "589/1992",
    viaLawTitle: "zákon č. 589/1992 Sb.",
    operativeParagraphs: ["14"],
    citedOnlyParagraphs: ["5b"],
    partitionFallback: false,
    diagnosticsClean: true,
    verdictDisposition: VALID_DISPOSITION,
    ...overrides,
  };
}

describe("projectSectorAttributionFlag", () => {
  it("projects a well-formed row", () => {
    const flag = projectSectorAttributionFlag(row());
    expect(flag).not.toBeNull();
    expect(flag).toMatchObject({
      company: "IF Holding a.s.",
      sector: "economy",
      sponsor: "Radim Fiala",
      viaLawRef: "589/1992",
      operativeParagraphs: ["14"],
      citedOnlyParagraphs: ["5b"],
      partitionFallback: false,
      verdictDisposition: VALID_DISPOSITION,
    });
  });

  it("carries null operativeParagraphs through as null, never an invented empty finding", () => {
    const flag = projectSectorAttributionFlag(row({ operativeParagraphs: null, citedOnlyParagraphs: null }));
    expect(flag?.operativeParagraphs).toBeNull();
    expect(flag?.citedOnlyParagraphs).toBeNull();
  });

  it("collapses an empty §-array to null (never renders an empty §-list)", () => {
    const flag = projectSectorAttributionFlag(row({ operativeParagraphs: [] }));
    expect(flag?.operativeParagraphs).toBeNull();
  });

  it("discloses rather than drops a row with no verdictDisposition (2026-08-06)", () => {
    // The company/sector/sponsor/statute adjacency is real regardless of whether the
    // disposition prose renders — dropping the whole row erased that adjacency, which is
    // stricter than the readForensic() precedent this module withholds a FIELD, not a record.
    for (const bad of [undefined, ""] as const) {
      const flag = projectSectorAttributionFlag(row({ verdictDisposition: bad }));
      expect(flag).not.toBeNull();
      expect(flag?.company).toBe("IF Holding a.s.");
      expect(flag?.verdictDisposition).toBeNull();
      expect(flag?.dispositionWithheld).toBe(true);
    }
  });

  it("discloses rather than drops a row whose disposition fails the Czech-language gate", () => {
    const flag = projectSectorAttributionFlag(
      row({ verdictDisposition: "the archived verdict on print 11 closed this as coincidence" }),
    );
    expect(flag).not.toBeNull();
    expect(flag?.dispositionWithheld).toBe(true);
    expect(flag?.verdictDisposition).toBeNull();
  });

  it("discloses rather than drops a row whose disposition fails the pipeline-jargon gate", () => {
    const flag = projectSectorAttributionFlag(
      row({ verdictDisposition: "archivovaný posudek k tisku 11 — dávka 12 uzavřela sektorAdjacency jako shodu okolností" }),
    );
    expect(flag).not.toBeNull();
    expect(flag?.dispositionWithheld).toBe(true);
    expect(flag?.verdictDisposition).toBeNull();
  });

  it("never returns dispositionWithheld: true alongside a non-null verdictDisposition", () => {
    const withheld = projectSectorAttributionFlag(row({ verdictDisposition: undefined }));
    const clean = projectSectorAttributionFlag(row());
    expect(withheld?.dispositionWithheld).toBe(true);
    expect(clean?.dispositionWithheld).toBe(false);
    expect(clean?.verdictDisposition).toBe(VALID_DISPOSITION);
  });

  it("drops a row missing a required field (malformed, not fabricated)", () => {
    expect(projectSectorAttributionFlag(row({ company: undefined }))).toBeNull();
    expect(projectSectorAttributionFlag(row({ cislo: undefined }))).toBeNull();
    expect(projectSectorAttributionFlag(row({ sector: "" }))).toBeNull();
  });

  it("reads partitionFallback and diagnosticsClean as strict booleans", () => {
    expect(projectSectorAttributionFlag(row({ partitionFallback: "true" as unknown }))?.partitionFallback).toBe(false);
    expect(projectSectorAttributionFlag(row({ diagnosticsClean: false }))?.diagnosticsClean).toBe(false);
  });
});

describe("buildCompanyIcoResolver", () => {
  // The rule is EXACT-AND-UNIQUE or nothing. Every refusal below leaves the company
  // rendered by name and unlinked — a near-miss address about a NAMED firm on a conflict
  // surface is the failure features/dashboard/entityLinks.ts's shape refusal exists to stop.
  it("resolves a label carried by exactly one company node", () => {
    const r = buildCompanyIcoResolver([{ id: "company:ico:46347534", label: "Teplárny Brno, a.s." }]);
    expect(r("Teplárny Brno, a.s.")).toBe("46347534");
  });

  it("pads a short IČO to the canonical 8 digits (never a second parser of our ids)", () => {
    const r = buildCompanyIcoResolver([{ id: "company:ico:2867681", label: "Krátké IČO s.r.o." }]);
    expect(r("Krátké IČO s.r.o.")).toBe("02867681");
  });

  it("refuses an AMBIGUOUS label — two nodes, one name, no knowable firm", () => {
    const r = buildCompanyIcoResolver([
      { id: "company:ico:11111111", label: "Stejné jméno a.s." },
      { id: "company:ico:22222222", label: "Stejné jméno a.s." },
    ]);
    expect(r("Stejné jméno a.s.")).toBeNull();
  });

  it("refuses an UNKNOWN label", () => {
    const r = buildCompanyIcoResolver([{ id: "company:ico:46347534", label: "Teplárny Brno, a.s." }]);
    expect(r("Firma, kterou graf nezná")).toBeNull();
  });

  it("refuses a NON-CANONICAL node id — a trailing number is not an IČO", () => {
    const r = buildCompanyIcoResolver([
      { id: "psp:person:6751", label: "Karel Haas" },
      { id: "c:3", label: "Ukázková firma" },
      { id: "company:ico:123456789", label: "Devět číslic s.r.o." },
      { id: "company:ico:", label: "Bez IČO s.r.o." },
    ]);
    expect(r("Karel Haas")).toBeNull();
    expect(r("Ukázková firma")).toBeNull();
    expect(r("Devět číslic s.r.o.")).toBeNull();
    expect(r("Bez IČO s.r.o.")).toBeNull();
  });

  it("does not let an id-refused node make a resolvable label ambiguous", () => {
    // The refused node never carried an address, so it cannot take one away.
    const r = buildCompanyIcoResolver([
      { id: "company:ico:46347534", label: "Teplárny Brno, a.s." },
      { id: "bill:tisk:43111", label: "Teplárny Brno, a.s." },
    ]);
    expect(r("Teplárny Brno, a.s.")).toBe("46347534");
  });

  it("resolves nothing over an empty node set", () => {
    expect(buildCompanyIcoResolver([])("Cokoli")).toBeNull();
  });
});

describe("projectSectorAttributionFlag — companyIco", () => {
  it("carries the resolved IČO onto the flag", () => {
    const flag = projectSectorAttributionFlag(
      row({ company: "Teplárny Brno, a.s." }),
      buildCompanyIcoResolver([{ id: "company:ico:46347534", label: "Teplárny Brno, a.s." }]),
    );
    expect(flag?.companyIco).toBe("46347534");
  });

  it("defaults to null — a module with no injected resolver mints no address", () => {
    expect(projectSectorAttributionFlag(row())?.companyIco).toBeNull();
  });

  it("keeps the flag (name, sector, statute) when the IČO cannot be resolved", () => {
    // An unresolvable firm loses its LINK, never its row: the adjacency is the finding.
    const flag = projectSectorAttributionFlag(row({ company: "Neznámá firma a.s." }), buildCompanyIcoResolver([]));
    expect(flag?.company).toBe("Neznámá firma a.s.");
    expect(flag?.companyIco).toBeNull();
    expect(flag?.viaLawRef).toBe("589/1992");
  });

  it("carries the resolver through the whole index pipeline", () => {
    const idx = buildSectorAttributionIndex(
      [row({ cislo: 11, company: "Teplárny Brno, a.s." }), row({ cislo: 11, company: "Neznámá firma a.s." })],
      buildCompanyIcoResolver([{ id: "company:ico:46347534", label: "Teplárny Brno, a.s." }]),
    );
    // (bucket order is the module's own cs-collated company name, hence N before T)
    expect(idx.get(11)?.map((f) => [f.company, f.companyIco])).toEqual([
      ["Neznámá firma a.s.", null],
      ["Teplárny Brno, a.s.", "46347534"],
    ]);
  });
});

describe("groupSectorAttributionFlags", () => {
  it("groups by cislo and orders each bucket by company name (cs collation)", () => {
    const a = projectSectorAttributionFlag(row({ company: "Ž firma", sector: "economy" }))!;
    const b = projectSectorAttributionFlag(row({ company: "Alfa a.s.", sector: "health" }))!;
    const grouped = groupSectorAttributionFlags([
      { cislo: 11, flag: a },
      { cislo: 11, flag: b },
    ]);
    expect(grouped.get(11)?.map((f) => f.company)).toEqual(["Alfa a.s.", "Ž firma"]);
  });

  it("keeps different print numbers in separate buckets", () => {
    const a = projectSectorAttributionFlag(row({ cislo: 11 }))!;
    const b = projectSectorAttributionFlag(row({ cislo: 67 }))!;
    const grouped = groupSectorAttributionFlags([
      { cislo: 11, flag: a },
      { cislo: 67, flag: b },
    ]);
    expect([...grouped.keys()].sort()).toEqual([11, 67]);
  });
});

describe("buildSectorAttributionIndex", () => {
  it("runs the full raw→grouped pipeline over a payload's rows array", () => {
    const idx = buildSectorAttributionIndex([row({ cislo: 11 }), row({ cislo: 11, company: "Jiná firma" }), row({ cislo: 67 })]);
    expect(idx.get(11)).toHaveLength(2);
    expect(idx.get(67)).toHaveLength(1);
  });

  it("silently drops only STRUCTURALLY malformed rows without breaking the index", () => {
    const idx = buildSectorAttributionIndex([row({ cislo: 11 }), row({ cislo: 11, company: undefined })]);
    expect(idx.get(11)).toHaveLength(1);
  });

  it("keeps a gate-failing row in the index, disclosed rather than dropped (2026-08-06)", () => {
    const idx = buildSectorAttributionIndex([row({ cislo: 11 }), row({ cislo: 11, company: "Jiná firma", verdictDisposition: undefined })]);
    expect(idx.get(11)).toHaveLength(2);
    expect(idx.get(11)?.some((f) => f.dispositionWithheld)).toBe(true);
  });

  it("returns an empty index for an empty payload", () => {
    expect(buildSectorAttributionIndex([]).size).toBe(0);
  });
});
