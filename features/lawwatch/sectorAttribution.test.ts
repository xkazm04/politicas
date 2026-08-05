import { describe, expect, it } from "vitest";
import {
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
