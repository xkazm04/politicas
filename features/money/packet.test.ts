// Důkazní paket (4E) — kontrakt kompilace: citační brána pouští VÝHRADNĚ
// lidsky ověřený materiál, pořadí je deterministické, vyloučení se přiznávají
// a kandidáti střetů (4C) do paketu z konstrukce nikdy nevstupují.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MoneyMpDetail, MoneyTieDetail } from "./moneyTypes";
import type { ReviewState } from "./reviewTypes";
import {
  compileEvidencePacket,
  exclusionNotesCs,
  pendingExclusionNoteCs,
  rejectedExclusionNoteCs,
} from "./packet";

/* ── fixtures ────────────────────────────────────────────────────────────── */

let seq = 0;
function mkTie(over: Partial<MoneyTieDetail> = {}): MoneyTieDetail {
  seq++;
  return {
    companyId: `company:ico:${10000000 + seq}`,
    ico: String(10000000 + seq),
    company: `Firma ${seq} s.r.o.`,
    role: "jednatel",
    reviewState: "verified" as ReviewState,
    source: "hlidac:osoby/test-osoba · 2016-01-01–ongoing",
    contractCount: 2,
    contractCzk: 1_000_000,
    subsidiesCount: 0,
    subsidiesCzk: 0,
    donatedToPartyCzk: null,
    donationRecipientParty: null,
    corroboration: "registry-confirmed",
    roleValidFrom: "2016-01-01",
    roleValidTo: null,
    temporalStatus: "current",
    corroborationSource: null,
    corroborationProvenance: { pass: null, method: null, ref: null, computedAt: null },
    tieClass: "owner-operator",
    tieClassOrigin: "stored",
    tieClassHeuristic: "owner-operator",
    triangle: false,
    nearThresholdCount: 0,
    deMinimis: false,
    signalScore: 10,
    reviewTier: 0,
    reviewRank: seq,
    reviewOrderOrigin: "derived",
    reviewNote: null,
    reviewerNote: null,
    lastDecision: "confirm",
    lastReviewer: "recenzent",
    lastReviewedAt: "2026-07-20T10:00:00Z",
    ownerStakePct: null,
    priorTerm: null,
    falseEdgeSuspected: false,
    flags: [],
    contracts: [],
    contractsMoreCount: 0,
    ...over,
  };
}

function mkDetail(ties: MoneyTieDetail[]): MoneyMpDetail {
  return {
    pspId: 6543,
    name: "Testovací Poslanec",
    club: "KLUB",
    absenteeManagerLead: false,
    ties,
    money: {
      attributable: { companies: 0, contractCount: 0, contractCzk: 0, subsidiesCzk: 0, donatedToPartyCzk: 0 },
      steward: { companies: 0, contractCount: 0, contractCzk: 0, subsidiesCzk: 0, donatedToPartyCzk: 0 },
      totalCzk: 0,
      companies: 0,
      coverage: { perCompanyCap: null, companiesAtCap: 0, isFloor: false },
    },
    source: "registr smluv ⋈ ares ⋈ hlídač státu",
    pass: 30,
  };
}

const AT = { compiledAt: "2026-07-30" };

/* ── citační brána: jen verified, nic jiného ─────────────────────────────── */

describe("compileEvidencePacket — verified-only gate", () => {
  it("admits only reviewState === 'verified'; pending and rejected are excluded and counted", () => {
    const p = compileEvidencePacket(
      mkDetail([
        mkTie({ reviewState: "verified" }),
        mkTie({ reviewState: "pending_review" }),
        mkTie({ reviewState: "pending_review" }),
        mkTie({ reviewState: "rejected" }),
      ]),
      AT,
    );
    expect(p.ties).toHaveLength(1);
    expect(p.exclusions).toEqual({ pending: 2, rejected: 1 });
  });

  it("a packet with zero verified ties is an honest empty packet, not an error", () => {
    const p = compileEvidencePacket(
      mkDetail([mkTie({ reviewState: "pending_review" }), mkTie({ reviewState: "rejected" })]),
      AT,
    );
    expect(p.ties).toHaveLength(0);
    expect(p.timeline).toHaveLength(0);
    expect(p.exclusions).toEqual({ pending: 1, rejected: 1 });
    expect(p.hash).toMatch(/^[0-9a-f]{8}$/); // otisk existuje i pro prázdný paket
  });

  it("parity discipline: anything that is not the literal 'verified' never enters", () => {
    // mapLinkedToTie normalizuje neznámý stav na pending_review; brána je
    // navíc striktní rovnost — i kdyby parita selhala, cizí literál neprojde.
    const weird = mkTie({ reviewState: "schvaleno" as ReviewState });
    const p = compileEvidencePacket(mkDetail([weird]), AT);
    expect(p.ties).toHaveLength(0);
  });

  it("packet module never imports the collisions surface (4C candidates are unverified by definition)", () => {
    const src = readFileSync(path.join(__dirname, "packet.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["'][^"']*collisions/);
  });
});

/* ── pořadí ──────────────────────────────────────────────────────────────── */

describe("compileEvidencePacket — deterministic ordering", () => {
  it("orders verified ties by reviewRank ascending regardless of input order", () => {
    const a = mkTie({ reviewRank: 30, company: "C" });
    const b = mkTie({ reviewRank: 10, company: "A" });
    const c = mkTie({ reviewRank: 20, company: "B" });
    const p = compileEvidencePacket(mkDetail([a, b, c]), AT);
    expect(p.ties.map((t) => t.company)).toEqual(["A", "B", "C"]);
  });

  it("breaks reviewRank ties by companyId so the order is total", () => {
    const a = mkTie({ reviewRank: 5, companyId: "company:ico:2", ico: "2" });
    const b = mkTie({ reviewRank: 5, companyId: "company:ico:1", ico: "1" });
    const p = compileEvidencePacket(mkDetail([a, b]), AT);
    expect(p.ties.map((t) => t.ico)).toEqual(["1", "2"]);
  });

  it("timeline is date-ascending with a fixed kind order on equal dates", () => {
    const tie = mkTie({
      roleValidFrom: "2016-01-01",
      roleValidTo: "2020-06-30",
      lastReviewedAt: "2020-06-30T09:00:00Z",
      contracts: [
        { id: "k2", label: "Smlouva B", amountCzk: 500_000, signedOn: "2018-03-01" },
        { id: "k1", label: "Smlouva A", amountCzk: 200_000, signedOn: "2017-01-15" },
      ],
    });
    const p = compileEvidencePacket(mkDetail([tie]), AT);
    expect(p.timeline.map((e) => `${e.date}:${e.kind}`)).toEqual([
      "2016-01-01:role-start",
      "2017-01-15:contract",
      "2018-03-01:contract",
      "2020-06-30:review", // review před role-end na stejném dni (pevné pořadí druhů)
      "2020-06-30:role-end",
    ]);
  });

  it("undated contracts are counted, never silently dropped from the record", () => {
    const tie = mkTie({
      contracts: [
        { id: "k1", label: "S datem", amountCzk: 100, signedOn: "2019-01-01" },
        { id: "k2", label: "Bez data", amountCzk: 100, signedOn: null },
      ],
    });
    const p = compileEvidencePacket(mkDetail([tie]), AT);
    expect(p.timeline.filter((e) => e.kind === "contract")).toHaveLength(1);
    expect(p.undatedContracts).toBe(1);
  });

  it("contracts beyond the top-N slice are disclosed as a count", () => {
    const p = compileEvidencePacket(mkDetail([mkTie({ contractsMoreCount: 7 })]), AT);
    expect(p.contractsOmitted).toBe(7);
  });
});

/* ── přiznání vyloučení ──────────────────────────────────────────────────── */

describe("exclusion disclosure copy", () => {
  it("pluralizes 'nález' correctly, matching the 5+ canonical phrase", () => {
    expect(pendingExclusionNoteCs(1)).toBe("1 nález čeká na ověření — nezahrnut");
    expect(pendingExclusionNoteCs(3)).toBe("3 nálezy čekají na ověření — nezahrnuty");
    expect(pendingExclusionNoteCs(11)).toBe("11 nálezů čeká na ověření — nezahrnuto");
    expect(rejectedExclusionNoteCs(1)).toBe("1 nález byl při kontrole zamítnut — nezahrnut");
    expect(rejectedExclusionNoteCs(2)).toBe("2 nálezy byly při kontrole zamítnuty — nezahrnuty");
    expect(rejectedExclusionNoteCs(5)).toBe("5 nálezů bylo při kontrole zamítnuto — nezahrnuto");
  });

  it("emits one note per non-empty exclusion bucket, in a fixed order", () => {
    expect(exclusionNotesCs({ pending: 2, rejected: 1 })).toEqual([
      "2 nálezy čekají na ověření — nezahrnuty",
      "1 nález byl při kontrole zamítnut — nezahrnut",
    ]);
    expect(exclusionNotesCs({ pending: 0, rejected: 0 })).toEqual([]);
  });
});

/* ── otisk a citace ──────────────────────────────────────────────────────── */

describe("content hash + cite blocks", () => {
  it("hash is deterministic over content and ignores compiledAt", () => {
    const ties = [mkTie({ reviewRank: 1 })];
    const p1 = compileEvidencePacket(mkDetail(ties), { compiledAt: "2026-07-30" });
    const p2 = compileEvidencePacket(mkDetail(ties), { compiledAt: "2026-08-15" });
    expect(p1.hash).toBe(p2.hash);
    expect(p1.hashAlgorithm).toBe("fnv-1a/32");
  });

  it("hash changes when the verified content changes", () => {
    const base = mkTie({ reviewRank: 1 });
    const p1 = compileEvidencePacket(mkDetail([base]), AT);
    const p2 = compileEvidencePacket(mkDetail([{ ...base, contractCzk: base.contractCzk + 1 }]), AT);
    expect(p1.hash).not.toBe(p2.hash);
  });

  it("every verified tie carries a Czech cite block with source, verification and anchor", () => {
    const tie = mkTie({ ico: "12345678", company: "Alfa s.r.o." });
    const p = compileEvidencePacket(mkDetail([tie]), AT);
    const cite = p.ties[0].citeCs;
    expect(cite).toContain("Testovací Poslanec (KLUB)");
    expect(cite).toContain("Alfa s.r.o., IČO 12345678");
    expect(cite).toContain("Lidsky ověřeno");
    expect(cite).toContain("Zdroj:");
    expect(cite).toContain("/penize/6543/paket#p-12345678");
  });

  it("a steward cite block carries the P29 rule verbatim — the big number may not travel without it", () => {
    const tie = mkTie({ tieClass: "steward", contractCzk: 5_000_000_000 });
    const p = compileEvidencePacket(mkDetail([tie]), AT);
    expect(p.ties[0].citeCs).toContain("ne obohacením poslance");
  });

  it("a derived (unstored) class is admitted only with its origin disclosed in the cite", () => {
    const tie = mkTie({ tieClassOrigin: "derived" });
    const p = compileEvidencePacket(mkDetail([tie]), AT);
    expect(p.ties[0].citeCs).toContain("třída odvozená heuristicky");
  });
});
