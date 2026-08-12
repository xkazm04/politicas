import { describe, expect, it } from "vitest";
import {
  LEDGER_CHIP_CAP,
  PUBLIC_TIE_KEYS,
  TIE_WIRE,
  reachInput,
  toLedgerData,
  toPublicTie,
} from "./publicWire";
import { tieReach } from "./reachableMoney";
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
      // Nic na /penize tuhle částku nevykresluje: kniha vazeb má sloupce poslanec ·
      // firma · třída · stav · dosah, dar mezi nimi není, a obrázek nad ní bere svou
      // stranickou figuru z `MoneyGraphData`, ne odsud.
      "donatedToPartyCzk",
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

  // Dvě pole, o kterých průchod 2026-08-12 rozhodl jinak, než tabulka tvrdila. Obě
  // seděla pod komentářem „`tieReach()` inputs" — a ten o obou LHAL: `contractCount`
  // je vstup dosahu jen v tom smyslu, že ho `reachableMoney` sčítá do rozpočtu, ale
  // na drát patří proto, že se VYKRESLUJE („{count} smluv" pod buňkou dosahu);
  // `donatedToPartyCzk` se nevykresluje nikde a v korunách dosahu není vůbec.
  it("rules on the two fields the 2026-08-12 pass reclassified", () => {
    expect(TIE_WIRE.contractCount, "the row prints the contract count under the reach cell").toBe(
      "public",
    );
    expect(TIE_WIRE.donatedToPartyCzk, "no /penize surface renders the donation").toBe("internal");
    expect(PUBLIC_TIE_KEYS).toContain("contractCount");
    expect(PUBLIC_TIE_KEYS as readonly string[]).not.toContain("donatedToPartyCzk");
  });

  // Tohle je ta věta, kterou `reachInput`'s doc comment slibuje: `null` tam není
  // dosazená hodnota, ale NEPŘÍTOMNOST pole, které aritmetika nekonzultuje. Kdyby
  // ho `bucketReachCzk` nebo `tieReach` četly, dosah řádku by se po zúžení drátu
  // změnil — a kniha vazeb by tiskla jiné číslo než spis poslance nad týmž grafem.
  it("reachInput's null is an ABSENCE: the reach arithmetic never consults the donation", () => {
    const full = tie({ contractCzk: 8_711_232, subsidiesCzk: 37_793_745, donatedToPartyCzk: 4_000_000 });
    const withDonation = tieReach(full);
    const overTheWire = tieReach(reachInput(toPublicTie(full)));

    expect(overTheWire.czk).toBe(withDonation.czk);
    expect(overTheWire.attributable).toBe(withDonation.attributable);
    // …a ne proto, že by dar náhodou byl nula: v `full` jsou 4 mil. Kč, a v součtu
    // nejsou ani na jedné straně.
    expect(full.donatedToPartyCzk).toBeGreaterThan(0);
    expect(withDonation.czk).toBe(full.contractCzk + full.subsidiesCzk);
  });

  it("reachInput leaves every field the arithmetic DOES read untouched", () => {
    const p = toPublicTie(tie({ contractCount: 12, contractCzk: 7, subsidiesCzk: 5 }));
    const r = reachInput(p);
    expect(r.donatedToPartyCzk).toBeNull();
    expect(r.companyId).toBe(p.companyId);
    expect(r.tieClass).toBe(p.tieClass);
    expect(r.contractCount).toBe(12);
    expect(r.contractCzk).toBe(7);
    expect(r.subsidiesCzk).toBe(5);
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
    stats: { mandatesTotal: 200 } as MoneyData["stats"],
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

  // `stats` prochází celé a jedno z jeho polí je od 2026-08-12 JMENOVATEL dlaždice
  // „poslanci s vazbou" — do té doby to byl literál „207" v katalogu. Kdyby ho drát
  // ořízl, věta by tiše spadla do bezjmenovatelové varianty a nikdo by si toho na
  // ploše nevšiml (obě varianty se čtou dobře).
  it("ships stats.mandatesTotal — the denominator the MPs tile actually renders", () => {
    expect(toLedgerData(data(0)).stats.mandatesTotal).toBe(200);
  });
});
