// The wire may not become a comment that lies about what ships.
//
// Two invariants matter beyond the key sets: the exhibit address is computed
// from the WIRE slice on the page and from the FULL slice on the server, so the
// two must agree byte for byte; and the working set the ledger was built from
// must not be reachable from the wire at all.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sliceExhibitId } from "./exhibit";
import { buildDatedFacts, FEED_ROWS, type FactContract } from "./datedFacts";
import { MONEY_WIRE, PUBLIC_MONEY_KEYS, toDashboardWire, toPublicMoney } from "./publicWire";
import { buildStateSlice, type SliceInput } from "./stateSlice";
import type { DashboardData, DashboardMoney } from "./getDashboardData";

const money = (): DashboardMoney => ({
  attributableCzk: 8_711_232.5,
  stewardCzk: 139_100_000_000,
  mpsWithTies: 63,
  companiesLinked: 196,
  totalTies: 211,
  review: { phase: "all-pending", total: 211, decided: 0, verified: 0, rejected: 0, pending: 211 },
  pass: 10,
  isFloor: false,
  perCompanyCap: null,
  companiesAtCap: 0,
});

const sliceInput = (): SliceInput => ({
  chamberTotal: 207,
  mps: [
    {
      pspId: 100,
      name: "Stovka Stovková",
      ties: [
        {
          companyId: "company:ico:00000100",
          ico: "00000100",
          company: "Firma 00000100",
          role: "jednatel",
          tieClass: "owner-operator",
          reviewState: "pending_review",
          contractCzk: 1_000_000,
          contractCount: 4,
          donatedToPartyCzk: null,
          donationRecipientParty: null,
          roleValidFrom: "2019-03-01",
          roleValidTo: null,
        },
      ],
    },
  ],
  bills: [
    {
      cislo: 50,
      title: "Návrh na změnu zákona o DPH",
      sponsors: [{ pspId: 100, name: "Stovka Stovková" }],
      amendedLaws: [
        { urn: "law:sb:586-1992", ref: "586/1992", label: "z. 586/1992", title: "o daních z příjmů" },
      ],
      committees: [{ organLabel: "rozpočtový výbor", role: "garanční", assignedOn: "2026-02-10" }],
      fateSb: "12/2026",
      fatePublishedOn: "2026-05-01",
    },
  ],
});

const dashboardData = (): DashboardData => {
  const slice = buildStateSlice(sliceInput());
  if (!slice) throw new Error("fixture must build a slice");
  return {
    top: [],
    summary: { avg: 60.1, median: 61, sigma: 12.4, count: 207 },
    histogram: [],
    attendanceAvgPct: 88.2,
    provenance: {
      state: "uniform",
      pass: 42,
      computedAt: "2026-08-04",
      distinctCount: 1,
      covered: 207,
      total: 207,
      formulaMatch: true,
      storedRef: "contribution-committee-dedupe",
      declaredRef: "contribution-committee-dedupe",
    },
    money: money(),
    laws: null,
    slice,
    feed: null,
    builtOn: "2026-08-04",
  };
};

describe("MONEY_WIRE", () => {
  it("classifies every DashboardMoney field", () => {
    // The `satisfies` clause proves exhaustiveness at compile time; this proves
    // the runtime list agrees with the mapper.
    expect([...PUBLIC_MONEY_KEYS].sort()).toEqual(
      [
        "attributableCzk",
        "companiesAtCap",
        "isFloor",
        "pass",
        "perCompanyCap",
        "review",
        "stewardCzk",
      ].sort(),
    );
    expect(Object.keys(toPublicMoney(money())).sort()).toEqual([...PUBLIC_MONEY_KEYS].sort());
  });

  it("keeps /penize's own aggregates off the wire", () => {
    const p = toPublicMoney(money()) as Record<string, unknown>;
    for (const key of ["mpsWithTies", "companiesLinked", "totalTies"]) {
      expect(MONEY_WIRE[key as keyof typeof MONEY_WIRE]).toBe("internal");
      expect(key in p).toBe(false);
    }
  });
});

describe("toDashboardWire", () => {
  it("ships the picture and its rule, never the ledger's working set", () => {
    const data = dashboardData();
    const wire = toDashboardWire(data);
    expect(Object.keys(wire.slice!).sort()).toEqual(["graph", "rule"]);
    expect(JSON.stringify(wire)).not.toContain("subjectRef");
    expect(JSON.stringify(wire)).not.toContain("roleValidFrom");
  });

  it("computes the SAME exhibit address as the full slice", () => {
    const data = dashboardData();
    const wire = toDashboardWire(data);
    expect(sliceExhibitId(wire.slice!)).toBe(sliceExhibitId(data.slice!));
  });

  it("passes every other layer through unchanged", () => {
    const data = dashboardData();
    const wire = toDashboardWire(data);
    expect(wire.summary).toEqual(data.summary);
    expect(wire.provenance).toEqual(data.provenance);
    expect(wire.builtOn).toBe(data.builtOn);
    expect(wire.feed).toBeNull();
  });

  it("keeps a dark layer dark", () => {
    const wire = toDashboardWire({ ...dashboardData(), money: null, slice: null });
    expect(wire.money).toBeNull();
    expect(wire.slice).toBeNull();
  });
});

// The exhibit resolves a citation against the FULL ledger of dated facts (a row
// behind the 12-row window is not a lost record — features/dashboard/datedFacts.ts,
// rule 6). That full book must never reach a browser: it is the whole contract
// working set of the drawn companies, and the panel renders twelve rows.
describe("the feed on the wire stays the front-page WINDOW", () => {
  const contracts: FactContract[] = Array.from({ length: FEED_ROWS + 8 }, (_, i) => ({
    id: String(i).padStart(2, "0"),
    title: `Smlouva ${i}`,
    signedOn: `2025-01-${String(i + 1).padStart(2, "0")}`,
    amountCzk: 1_000,
    company: "Firma 00000100",
    refs: ["c:00000100"],
    subjectRef: "c:00000100",
    pending: true,
  }));

  it("ships exactly FEED_ROWS rows for a ledger built the way the page builds it", () => {
    const feed = buildDatedFacts({ contracts, ties: [], bills: [], today: "2026-08-04" });
    const wire = toDashboardWire({ ...dashboardData(), feed });
    expect(wire.feed!.facts).toHaveLength(FEED_ROWS);
    expect(wire.feed!.considered).toBe(contracts.length);
    // The rows the window cut are not reachable from the wire in any other field.
    const oldest = buildDatedFacts(
      { contracts, ties: [], bills: [], today: "2026-08-04" },
      { limit: null },
    ).facts.at(-1)!;
    expect(JSON.stringify(wire)).not.toContain(oldest.id);
  });

  // The bound is the CALL SITE, not the projection: `toDashboardWire` passes the
  // ledger through, so what keeps the full book on the server is that the page
  // asks for the window and only the exhibit loader asks for everything.
  it("the page asks for the window; only the exhibit loader asks for the full book", () => {
    const page = readFileSync("app/dashboard/page.tsx", "utf8");
    expect(page).toContain("getDashboardData()");
    expect(page).not.toContain("factLedger");
    const exhibit = readFileSync("features/dashboard/getExhibitData.ts", "utf8");
    expect(exhibit).toContain('factLedger: "full"');
  });
});
