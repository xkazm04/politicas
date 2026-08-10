// The /zakony public wire, pinned — the discipline features/money/publicWire.test.ts and
// features/dashboard/publicWire.test.ts established. The `satisfies Record<keyof …>` in
// publicWire.ts is what stops a NEW field from shipping unclassified; this file is what
// stops a CLASSIFIED field from being classified `public` and then quietly dropped by the
// mapper (or the reverse — an `internal` field re-appearing on the wire).
import { describe, expect, it } from "vitest";

import type { LawBillView, LawData } from "./getLawData";
import {
  BILL_WIRE,
  DERIVED_BILL_KEYS,
  LAW_WIRE,
  PUBLIC_BILL_KEYS,
  PUBLIC_LAW_KEYS,
  TOP_LAWS_RENDERED,
  toLawWatchWire,
  toPublicBill,
} from "./publicWire";

function bill(overrides: Partial<LawBillView> = {}): LawBillView {
  return {
    tiskId: 43111,
    cislo: 11,
    title: "Novela zákona o pojistném",
    summary: "Mění sazby pojistného.",
    summarySource: "psp.cz text tisku",
    origin: "government",
    submitter: "Ministerstvo financí",
    sponsors: [{ pspId: 6881, name: "Petr Hladík", role: "predkladatel", rank: 1, joinedLater: false }],
    rapporteurs: [{ pspId: 6150, name: "Andrej Babiš", scopes: ["plenum"] }],
    speakers: [{ pspId: 6165, name: "Radek Vondráček", turns: 3 }],
    amendmentAuthors: [{ pspId: 6487, name: "Patrik Nacher", count: 2 }],
    stav: "projednáváno",
    fateSb: null,
    fatePublishedOn: null,
    sponsorMinContribution: 61.2,
    amendedLaws: [
      { urn: "law:sb:589-1992", ref: "589/1992", label: "zákon č. 589/1992 Sb. — o pojistném", title: "Zákon o pojistném" },
    ],
    committees: [
      { organUrn: "psp:organ:1", organLabel: "rozpočtový výbor", role: "garancni", status: "prikazano", assignedOn: "2026-03-01" },
    ],
    flaggedConflict: true,
    sponsorContractCzk: 23_570_594_009.66,
    sponsorMoneyCompanies: 4,
    forensic: {
      severity: "medium",
      confidence: 3,
      reviewState: "pending_review",
      statedReasoning: "Důvodová zpráva uvádí sjednocení sazeb.",
      researchedContext: null,
      conflictAssessment: null,
      unstatedEffects: [],
      citations: [],
      pass: 54,
      provenanceRef: "law-forensics",
      computedAt: "2026-08-05T11:22:33.000Z",
      withheldFields: 1,
    },
    paragraphDiffs: [
      {
        law: "589/1992",
        source: "e-Sbírka SPARQL",
        fetchedAt: "2026-08-01",
        from: { date: "2025-01-01", effectiveFrom: null, effectiveTo: null, eli: "eli/from" },
        to: { date: "2026-01-01", effectiveFrom: null, effectiveTo: null, eli: "eli/to" },
        parScope: "§ 14",
        hunks: [{ fragment: "§ 14", op: "modified", before: "staré znění", after: "nové znění" }],
      },
    ],
    amendedLawsFull: ["589/1992", "586/1992"],
    amendsUndercount: 1,
    sectorAttributionFlags: [
      {
        company: "IF Holding a.s.",
        sector: "economy",
        sponsor: "Radim Fiala",
        viaLawRef: "589/1992",
        viaLawTitle: "zákon č. 589/1992 Sb.",
        operativeParagraphs: ["14"],
        citedOnlyParagraphs: null,
        partitionFallback: false,
        diagnosticsClean: true,
        verdictDisposition: "archivovaný posudek shodu uzavřel jako shodu okolností",
        dispositionWithheld: false,
        companyIco: "46347534",
      },
    ],
    ...overrides,
  };
}

function lawData(overrides: Partial<LawData> = {}): LawData {
  const bills = [bill()];
  return {
    bills,
    topLaws: Array.from({ length: 31 }, (_, i) => ({
      urn: `law:sb:${i}-1992`,
      ref: `${i}/1992`,
      label: `zákon č. ${i}/1992 Sb.`,
      title: null,
      billCount: 31 - i,
    })),
    originCounts: { government: 1 },
    totalBills: 1,
    totalLaws: 31,
    totalAmends: 1,
    flaggedCount: 1,
    forensicCount: 1,
    forensicIndex: {
      totalBills: 1,
      verdictCount: 1,
      complete: true,
      groups: [],
      reviewStates: [],
      withheldVerdictCount: 1,
      withheldFieldCount: 1,
      unlinkableCount: 0,
      passes: [54],
      uniformPass: 54,
      uniformRef: "law-forensics",
      uniformComputedAt: "2026-08-05T11:22:33.000Z",
    },
    summaryCount: 1,
    forensicWithheldCount: 1,
    paragraphDiffCount: 1,
    committeeRoutedBills: 1,
    censusBillCount: 1,
    censusUndercountTotal: 1,
    sectorAttributionBillCount: 1,
    sectorAttributionFlagCount: 1,
    pass: 54,
    ...overrides,
  };
}

describe("BILL_WIRE / toPublicBill", () => {
  it("ships exactly the public keys plus the four measured ones — nothing else", () => {
    const wired = toPublicBill(bill());
    expect(Object.keys(wired).sort()).toEqual([...PUBLIC_BILL_KEYS, ...DERIVED_BILL_KEYS].sort());
  });

  it("ships no field classified internal", () => {
    const wired = toPublicBill(bill()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(BILL_WIRE)) {
      if (v === "internal") expect(Object.hasOwn(wired, k), k).toBe(false);
    }
  });

  it("leaves the WHOLE forensic verdict on the server — the index only needs its existence", () => {
    // This is the payload this wire exists for: 141 prints × the full gated verdict.
    const wired = toPublicBill(bill()) as Record<string, unknown>;
    expect(wired.forensic).toBeUndefined();
    expect(wired.hasForensic).toBe(true);
    expect(toPublicBill(bill({ forensic: null })).hasForensic).toBe(false);
  });

  it("leaves the verbatim e-Sbírka §-diff text on the server", () => {
    const wired = toPublicBill(bill()) as Record<string, unknown>;
    expect(wired.paragraphDiffs).toBeUndefined();
    expect(wired.hasParagraphDiff).toBe(true);
    expect(toPublicBill(bill({ paragraphDiffs: [] })).hasParagraphDiff).toBe(false);
  });

  it("leaves the sector-attribution flags and the sponsor roster on the server", () => {
    const wired = toPublicBill(bill()) as Record<string, unknown>;
    expect(wired.sectorAttributionFlags).toBeUndefined();
    expect(wired.sponsors).toBeUndefined();
    expect(wired.speakers).toBeUndefined();
    expect(wired.amendmentAuthors).toBeUndefined();
  });

  it("carries statute REFS (searched + counted), never the node labels beside them", () => {
    const wired = toPublicBill(bill());
    expect(wired.amendedLawRefs).toEqual(["589/1992"]);
    expect((wired as Record<string, unknown>).amendedLaws).toBeUndefined();
  });

  it("measures committee routing without shipping it", () => {
    expect(toPublicBill(bill()).hasCommittees).toBe(true);
    expect(toPublicBill(bill({ committees: [] })).hasCommittees).toBe(false);
  });

  it("keeps a bill with no print number addressable by its internal id", () => {
    const wired = toPublicBill(bill({ cislo: null }));
    expect(wired.cislo).toBeNull();
    expect(wired.tiskId).toBe(43111);
  });
});

describe("LAW_WIRE / toLawWatchWire", () => {
  it("ships exactly the public keys — nothing else", () => {
    expect(Object.keys(toLawWatchWire(lawData())).sort()).toEqual([...PUBLIC_LAW_KEYS].sort());
  });

  it("ships no field classified internal", () => {
    const wired = toLawWatchWire(lawData()) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(LAW_WIRE)) {
      if (v === "internal") expect(Object.hasOwn(wired, k), k).toBe(false);
    }
  });

  it("keeps the forensic INDEX — it is the §03 register, and it is already an aggregation", () => {
    // The 2026-08-10 wire diet must not undo the 2026-08-09 corpus index.
    expect(toLawWatchWire(lawData()).forensicIndex.verdictCount).toBe(1);
    expect(toLawWatchWire(lawData()).forensicIndex.withheldVerdictCount).toBe(1);
  });

  it("cuts topLaws to what §02 draws, and leaves the honest total in totalLaws", () => {
    const wired = toLawWatchWire(lawData());
    expect(wired.topLaws).toHaveLength(TOP_LAWS_RENDERED);
    expect(wired.totalLaws).toBe(31);
    // The cut keeps the loader's own ordering (most-amended first) — never re-sorts.
    expect(wired.topLaws.map((l) => l.billCount)).toEqual(
      lawData().topLaws.slice(0, TOP_LAWS_RENDERED).map((l) => l.billCount),
    );
  });

  it("narrows every bill in the list, not just the first", () => {
    const wired = toLawWatchWire(lawData({ bills: [bill(), bill({ cislo: 12, forensic: null })] }));
    expect(wired.bills.map((b) => b.hasForensic)).toEqual([true, false]);
    for (const b of wired.bills) expect((b as Record<string, unknown>).forensic).toBeUndefined();
  });

  it("is pure — the loader's own object is never mutated", () => {
    const data = lawData();
    toLawWatchWire(data);
    expect(data.bills[0].forensic).not.toBeNull();
    expect(data.topLaws).toHaveLength(31);
  });
});
