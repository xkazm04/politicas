import { describe, expect, it } from "vitest";
import { LEDGER_CHIP_CAP, PUBLIC_TIE_KEYS, TIE_WIRE, toLedgerData, toPublicTie } from "./publicWire";
import type { MoneyData, MoneyMpStub, MoneyTie } from "./moneyTypes";

const tie = (over: Partial<MoneyTie> = {}): MoneyTie => ({
  companyId: "company:ico:26185610",
  receiptRef: "h.a.b.c",
  ico: "26185610",
  company: "AGROFERT, a.s.",
  role: "předseda představenstva",
  reviewState: "pending_review",
  source: "hlidacstatu.cz/osoba/andrej-babis",
  contractCount: 12,
  contractCzk: 8_711_232,
  subsidiesCount: 19,
  subsidiesCzk: 37_793_745,
  donatedToPartyCzk: null,
  donationRecipientParty: null,
  corroboration: "registry-confirmed",
  roleValidFrom: "2013-01-01",
  roleValidTo: null,
  temporalStatus: "current",
  corroborationSource: "https://ares.gov.cz/…",
  corroborationProvenance: { pass: 2, method: "ares-vr", ref: "money-002", computedAt: "2026-07-27" },
  tieClass: "manager",
  tieClassOrigin: "stored",
  tieClassHeuristic: "owner-operator",
  triangle: false,
  nearThresholdCount: 0,
  deMinimis: false,
  signalScore: 41,
  reviewTier: 1,
  reviewRank: 1_004,
  reviewOrderOrigin: "stored",
  reviewNote: null,
  reviewerNote: "ARES VR potvrzuje funkci; smlouvy nalezeny.",
  lastDecision: null,
  lastReviewer: null,
  lastReviewedAt: null,
  ownerStakePct: null,
  priorTerm: null,
  falseEdgeSuspected: false,
  flags: ["stale-ongoing-in-graph"],
  ...over,
});

describe("toPublicTie", () => {
  it("carries every field the ledger renders, sorts or links by", () => {
    const p = toPublicTie(tie());
    expect(Object.keys(p).sort()).toEqual(
      [
        "companyId",
        "company",
        "contractCount",
        "contractCzk",
        "corroboration",
        "donatedToPartyCzk",
        "ico",
        "receiptRef",
        "reviewRank",
        "reviewState",
        "roleValidTo",
        "subsidiesCzk",
        "temporalStatus",
        "tieClass",
        "tieClassOrigin",
      ].sort(),
    );
  });

  it("drops the analyst/review evidence the case file and console own", () => {
    const p = toPublicTie(tie()) as Record<string, unknown>;
    for (const dead of [
      "reviewerNote",
      "corroborationProvenance",
      "corroborationSource",
      "source",
      "flags",
      "signalScore",
      "reviewTier",
      "tieClassHeuristic",
      "triangle",
      "nearThresholdCount",
      "deMinimis",
      "reviewNote",
      "lastDecision",
      "lastReviewer",
      "lastReviewedAt",
      "ownerStakePct",
      "priorTerm",
      "role",
      "falseEdgeSuspected",
    ]) {
      expect(p, `${dead} must not reach the public wire`).not.toHaveProperty(dead);
    }
  });

  it("ships exactly the fields TIE_WIRE classifies as public — the table cannot lie", () => {
    expect(Object.keys(toPublicTie(tie())).sort()).toEqual([...PUBLIC_TIE_KEYS].sort());
  });

  it("classifies every MoneyTie field — nothing is unclassified by omission", () => {
    const classified = Object.keys(TIE_WIRE).sort();
    expect(Object.keys(tie()).sort()).toEqual(classified);
  });

  it("preserves the values it does carry, verbatim", () => {
    const t = tie();
    const p = toPublicTie(t);
    expect(p.contractCzk).toBe(t.contractCzk);
    expect(p.tieClass).toBe(t.tieClass);
    expect(p.corroboration).toBe(t.corroboration);
    expect(p.receiptRef).toBe(t.receiptRef);
  });
});

const stub = (n: number): MoneyMpStub => ({ pspId: n, name: `MP ${n}`, club: null });

const data = (stubs: number): MoneyData =>
  ({
    mps: [
      {
        pspId: 6150,
        name: "Andrej Babiš",
        club: "ANO2011",
        absenteeManagerLead: false,
        ties: [tie()],
        verifiedCount: 0,
        pendingCount: 1,
        attributableReachCzk: 46_504_977,
        stewardReachCzk: 0,
      },
    ],
    mpsWithoutTies: Array.from({ length: stubs }, (_, i) => stub(i + 1)),
    graph: null,
    stats: {} as MoneyData["stats"],
    source: "registr smluv",
    pass: 10,
  }) as MoneyData;

describe("toLedgerData", () => {
  it("trims the no-tie chips to what renders but keeps the TRUE count", () => {
    const w = toLedgerData(data(144));
    expect(w.mpsWithoutTies).toHaveLength(LEDGER_CHIP_CAP);
    expect(w.mpsWithoutTiesCount).toBe(144);
  });

  it("does not pad when there are fewer stubs than the cap", () => {
    const w = toLedgerData(data(5));
    expect(w.mpsWithoutTies).toHaveLength(5);
    expect(w.mpsWithoutTiesCount).toBe(5);
  });

  it("keeps the MP identity the rows link by and drops the loader's working fields", () => {
    const mp = toLedgerData(data(0)).mps[0] as Record<string, unknown>;
    expect(mp.pspId).toBe(6150);
    expect(mp.name).toBe("Andrej Babiš");
    expect(mp.club).toBe("ANO2011");
    expect(mp).not.toHaveProperty("attributableReachCzk");
    expect(mp).not.toHaveProperty("verifiedCount");
  });

  it("passes stats/graph/source/pass through untouched — the tiles cite them", () => {
    const src = data(0);
    const w = toLedgerData(src);
    expect(w.pass).toBe(src.pass);
    expect(w.source).toBe(src.source);
    expect(w.stats).toBe(src.stats);
  });
});
