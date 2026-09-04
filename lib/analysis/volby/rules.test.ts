import { describe, expect, it } from "vitest";
import { nodeClaimRef } from "@/features/shared/provenance/claimRef";
import {
  CIRCLE_HIGH,
  CONFLICT_HIGH_CZK,
  MIN_DATED_WINS,
  N1_DEPENDENCE_MIN,
  N1_MULTIPLE_HIGH,
  N1_MULTIPLE_MEDIUM,
  N2_CIRCLE_MIN,
  N2_SWITCH_MAX,
  N3_SWITCH_MIN,
  N4_MIN_LOTS,
  N4_MULTIPLE,
  P1_MAX_MULTIPLE,
  P1_MIN_LOTS,
  RAPPORTEUR_MIN,
  RULE_REF,
  composeAuthorityFindings,
  composeMpFindings,
  dedupeByObject,
  dedupeCurrentHolders,
  listSlug,
  nodeRef,
  outcomeTimeline,
  rollupLedger,
  type AuthorityInput,
  type AuthorityLot,
  type MpInput,
  type SponsoredBill,
} from "./rules";
import type { Finding } from "./types";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const BASELINE = {
  flaggedShare: 0.1,
  shortDeadlineShare: 0.05,
  label: "průměr arény",
  source: "claim:tender:census:komunalni",
};

/** `n` lots inside the komunální window, `flaggedN` flagged, `shortN` with short_deadline. */
function lots(n: number, flaggedN: number, shortN = 0, opts: { winner?: string; date?: string | null } = {}): AuthorityLot[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `tender:${i}`,
    decidedOn: opts.date === undefined ? "2025-03-01" : opts.date,
    endedOn: null,
    flags: [...(i < flaggedN ? ["single_bid"] : []), ...(i < shortN ? ["short_deadline"] : [])],
    winnerIco: opts.winner ?? null,
  }));
}

function authority(over: Partial<AuthorityInput> = {}): AuthorityInput {
  return {
    ico: "00297488",
    arena: "komunalni",
    lots: [],
    winnerDependence: {},
    circle: null,
    baseline: BASELINE,
    ...over,
  };
}

const kinds = (fs: Finding[]) => fs.map((f) => f.kind);

function assertWellFormed(fs: Finding[]) {
  for (const f of fs) {
    expect(f.ruleRef).toBe(RULE_REF[f.kind]);
    expect(f.ruleRef).toMatch(/^volby:/);
    expect(f.evidence.length).toBeGreaterThanOrEqual(1);
    for (const e of f.evidence) expect(e.ref.length).toBeGreaterThan(0);
    expect(f.id.startsWith(`${f.kind}:${f.subjectId}`)).toBe(true);
  }
}

/* ── N1 ───────────────────────────────────────────────────────────────────── */

describe("N1 tender_konvejer", () => {
  it("fires medium at exactly 3× baseline with a dependent winner, not just below", () => {
    // 10 lots, 3 flagged → share 0.3 = 3× baseline 0.1
    const at = composeAuthorityFindings(
      authority({ lots: lots(10, 3, 0, { winner: "11111111" }), winnerDependence: { "11111111": N1_DEPENDENCE_MIN } }),
    );
    expect(kinds(at)).toContain("tender_konvejer");
    const f = at.find((x) => x.kind === "tender_konvejer")!;
    expect(f.severity).toBe("medium");
    expect(f.objectId).toBe("company:ico:11111111");
    expect(f.figures.multiple).toBe(N1_MULTIPLE_MEDIUM);
    expect(f.reviewState).toBe("deterministic");
    assertWellFormed(at);

    // 20 lots, 5 flagged → 0.25 = 2,5× → no N1
    const below = composeAuthorityFindings(
      authority({ lots: lots(20, 5, 0, { winner: "11111111" }), winnerDependence: { "11111111": 1 } }),
    );
    expect(kinds(below)).not.toContain("tender_konvejer");
  });

  it("is high at 6× and stays medium just below", () => {
    const high = composeAuthorityFindings(
      authority({ lots: lots(10, 6, 0, { winner: "11111111" }), winnerDependence: { "11111111": 1 } }),
    );
    expect(high.find((x) => x.kind === "tender_konvejer")?.severity).toBe("high");
    expect(high.find((x) => x.kind === "tender_konvejer")?.figures.multiple).toBe(N1_MULTIPLE_HIGH);
    const medium = composeAuthorityFindings(
      authority({ lots: lots(20, 11, 0, { winner: "11111111" }), winnerDependence: { "11111111": 1 } }),
    );
    expect(medium.find((x) => x.kind === "tender_konvejer")?.severity).toBe("medium");
  });

  it("needs a winner with dependence ≥ 0,9 — 0,89 does not count", () => {
    const none = composeAuthorityFindings(
      authority({ lots: lots(10, 6, 0, { winner: "11111111" }), winnerDependence: { "11111111": 0.89 } }),
    );
    expect(kinds(none)).not.toContain("tender_konvejer");
  });

  it("cites the authority, the dependent winner, the baseline and the flagged lots", () => {
    const [f] = composeAuthorityFindings(
      authority({ lots: lots(10, 6, 0, { winner: "11111111" }), winnerDependence: { "11111111": 1 } }),
    ).filter((x) => x.kind === "tender_konvejer");
    expect(f.evidence.map((e) => e.ref)).toEqual(
      expect.arrayContaining([nodeRef("company:ico:00297488"), nodeRef("company:ico:11111111"), BASELINE.source]),
    );
    expect(f.evidence.filter((e) => e.label === "označená zakázka")).toHaveLength(5);
  });
});

/* ── N2 / N3 ──────────────────────────────────────────────────────────────── */

describe("N2 dvorní dodavatel / N3 rotace", () => {
  const circle = (circle3_share: number, switch_rate: number, dated_wins = MIN_DATED_WINS) => ({
    circle3_share,
    switch_rate,
    dated_wins,
    circle3: [{ ico: "22222222", name: "A", wins: 7 }],
  });

  it("N2 at the edges: circle 0,6 & switch 0,2 & 10 wins → medium; any edge crossed → nothing", () => {
    const at = composeAuthorityFindings(authority({ circle: circle(N2_CIRCLE_MIN, N2_SWITCH_MAX) }));
    expect(kinds(at)).toEqual(["tender_dvorni_dodavatel"]);
    expect(at[0].severity).toBe("medium");
    assertWellFormed(at);
    expect(composeAuthorityFindings(authority({ circle: circle(0.59, 0.2) }))).toEqual([]);
    expect(composeAuthorityFindings(authority({ circle: circle(0.6, 0.21) }))).toEqual([]);
    expect(composeAuthorityFindings(authority({ circle: circle(0.6, 0.2, MIN_DATED_WINS - 1) }))).toEqual([]);
  });

  it("N3 at switch ≥ 0,6; the band 0,2 < switch < 0,6 is neither", () => {
    expect(kinds(composeAuthorityFindings(authority({ circle: circle(0.7, N3_SWITCH_MIN) })))).toEqual([
      "tender_rotace",
    ]);
    expect(composeAuthorityFindings(authority({ circle: circle(0.7, 0.59) }))).toEqual([]);
  });

  it("circle3_share ≥ 0,8 is high for both", () => {
    expect(composeAuthorityFindings(authority({ circle: circle(CIRCLE_HIGH, 0.1) }))[0].severity).toBe("high");
    expect(composeAuthorityFindings(authority({ circle: circle(CIRCLE_HIGH, 0.9) }))[0].severity).toBe("high");
    expect(composeAuthorityFindings(authority({ circle: circle(0.79, 0.9) }))[0].severity).toBe("medium");
  });

  it("cites each circle winner as a u. node ref", () => {
    const [f] = composeAuthorityFindings(authority({ circle: circle(0.9, 0.1) }));
    expect(f.evidence.map((e) => e.ref)).toContain(nodeRef("company:ico:22222222"));
  });
});

/* ── N4 ───────────────────────────────────────────────────────────────────── */

describe("N4 tender_kratke_lhuty", () => {
  it("fires medium at 3× the short_deadline baseline over ≥ 10 lots", () => {
    // 20 lots, 3 short → 0.15 = 3× 0.05
    const at = composeAuthorityFindings(authority({ lots: lots(20, 0, 3) }));
    expect(kinds(at)).toContain("tender_kratke_lhuty");
    const f = at.find((x) => x.kind === "tender_kratke_lhuty")!;
    expect(f.figures.multiple).toBe(N4_MULTIPLE);
    expect(f.severity).toBe("medium");
    assertWellFormed(at);
    // 40 lots, 5 short → 0.125 = 2,5×
    expect(kinds(composeAuthorityFindings(authority({ lots: lots(40, 0, 5) })))).not.toContain("tender_kratke_lhuty");
  });
  it("refuses under 10 lots even at a huge multiple", () => {
    const fs = composeAuthorityFindings(authority({ lots: lots(N4_MIN_LOTS - 1, 0, 9) }));
    expect(kinds(fs)).not.toContain("tender_kratke_lhuty");
    const ok = composeAuthorityFindings(authority({ lots: lots(N4_MIN_LOTS, 0, 10) }));
    expect(kinds(ok)).toContain("tender_kratke_lhuty");
  });
});

/* ── P1 ───────────────────────────────────────────────────────────────────── */

describe("P1 tender_cisty_radar", () => {
  it("positive low at 20 lots and flagged share ≤ 0,5× baseline; 19 lots or 0,55× refuses", () => {
    // 20 lots, 1 flagged → 0.05 = 0.5×
    const at = composeAuthorityFindings(authority({ lots: lots(P1_MIN_LOTS, 1) }));
    expect(kinds(at)).toEqual(["tender_cisty_radar"]);
    expect(at[0].valence).toBe("positive");
    expect(at[0].severity).toBe("low");
    expect(at[0].figures.multiple).toBe(P1_MAX_MULTIPLE);
    assertWellFormed(at);
    expect(composeAuthorityFindings(authority({ lots: lots(P1_MIN_LOTS - 1, 0) }))).toEqual([]);
    // 20 lots, 2 flagged → 0.1 = 1×
    expect(composeAuthorityFindings(authority({ lots: lots(20, 2) }))).toEqual([]);
  });
});

/* ── term window / arena ──────────────────────────────────────────────────── */

describe("term window and arena", () => {
  it("counts undated lots separately and excludes them from every share", () => {
    const fs = composeAuthorityFindings(
      authority({ lots: [...lots(20, 0), ...lots(30, 30, 30, { date: null })] }),
    );
    // only the 20 dated in-window lots count → 0 flagged → P1 fires with undated=30
    expect(kinds(fs)).toEqual(["tender_cisty_radar"]);
    expect(fs[0].figures.undated).toBe(30);
    expect(fs[0].figures.lots).toBe(20);
  });

  it("falls back to endedOn when decidedOn is null", () => {
    const l = lots(20, 0, 0, { date: null }).map((x) => ({ ...x, endedOn: "2025-01-01" }));
    const fs = composeAuthorityFindings(authority({ lots: l }));
    expect(fs[0]?.figures.undated).toBe(0);
    expect(fs[0]?.figures.lots).toBe(20);
  });

  it("drops lots decided before the ballot's window (komunální 2022-10-01, krajské 2024-10-12)", () => {
    const old = lots(20, 0, 0, { date: "2022-09-30" });
    expect(composeAuthorityFindings(authority({ lots: old }))).toEqual([]);
    const krajOld = lots(20, 0, 0, { date: "2024-10-11" });
    expect(composeAuthorityFindings(authority({ arena: "krajske", lots: krajOld }))).toEqual([]);
    const krajOk = lots(20, 0, 0, { date: "2024-10-12" });
    expect(kinds(composeAuthorityFindings(authority({ arena: "krajske", lots: krajOk })))).toEqual([
      "tender_cisty_radar",
    ]);
  });

  it("statni / nejasne: no term filter (figures.termFiltered = 0), no N1/P1, but N4 and N2 still run", () => {
    for (const arena of ["statni", "nejasne"] as const) {
      const fs = composeAuthorityFindings(
        authority({
          arena,
          lots: [...lots(10, 10, 10, { date: "2015-01-01", winner: "11111111" }), ...lots(10, 0, 0, { date: "2019-01-01" })],
          winnerDependence: { "11111111": 1 },
        }),
      );
      expect(kinds(fs)).toEqual(["tender_kratke_lhuty"]);
      expect(fs[0].figures.termFiltered).toBe(0);
      expect(fs[0].figures.lots).toBe(20);
    }
  });

  it("a zero baseline never divides — nothing fires on the baseline rules", () => {
    const fs = composeAuthorityFindings(
      authority({
        lots: lots(20, 20, 20, { winner: "1" }),
        winnerDependence: { "1": 1 },
        baseline: { ...BASELINE, flaggedShare: 0, shortDeadlineShare: 0 },
      }),
    );
    expect(fs).toEqual([]);
  });
});

/* ── MP ───────────────────────────────────────────────────────────────────── */

const bill = (over: Partial<SponsoredBill> = {}): SponsoredBill => ({
  tisk: "42",
  forensicSeverity: null,
  forensicRecordedAt: null,
  flaggedConflict: false,
  sponsorContractCzk: null,
  sponsorMoneyCompanies: null,
  fateSb: null,
  fatePublishedOn: null,
  sponsoredOn: "2025-11-01",
  finalVoteOn: null,
  ...over,
});
const mp = (over: Partial<MpInput> = {}): MpInput => ({
  pspId: 6000,
  sponsoredBills: [],
  effortWorkhorse: false,
  effortRapporteurLoad: 0,
  effortRecordedAt: "2026-08-01",
  moneyTieCount: 0,
  ...over,
});

describe("composeMpFindings", () => {
  it("law_posudek carries the forensic severity, pending_review, dated by the verdict", () => {
    const fs = composeMpFindings(
      mp({ sponsoredBills: [bill({ forensicSeverity: "high", forensicRecordedAt: "2026-02-02" })] }),
    );
    expect(fs).toHaveLength(1);
    expect(fs[0]).toMatchObject({
      kind: "law_posudek",
      severity: "high",
      valence: "negative",
      reviewState: "pending_review",
      decidedOn: "2025-11-01",
      laterOn: "2026-02-02",
      laterKind: "forensic_verdict",
      objectId: "bill:42",
      id: "law_posudek:person:6000:bill:42",
    });
    expect(fs[0].evidence.map((e) => e.ref)).toContain(nodeRef("bill:42"));
    assertWellFormed(fs);
  });

  it("law_sponsor_conflict: medium below 100 mil., high at exactly 100 mil.", () => {
    const med = composeMpFindings(
      mp({ sponsoredBills: [bill({ flaggedConflict: true, sponsorContractCzk: CONFLICT_HIGH_CZK - 1, sponsorMoneyCompanies: 2 })] }),
    );
    expect(med[0]).toMatchObject({ kind: "law_sponsor_conflict", severity: "medium" });
    expect(med[0].figures).toEqual({ sponsor_contract_czk: CONFLICT_HIGH_CZK - 1, sponsor_money_companies: 2 });
    const high = composeMpFindings(
      mp({ sponsoredBills: [bill({ flaggedConflict: true, sponsorContractCzk: CONFLICT_HIGH_CZK })] }),
    );
    expect(high[0].severity).toBe("high");
    assertWellFormed([...med, ...high]);
  });

  it("law_became_law_clean only when fate_sb is set AND the sponsor is not flagged", () => {
    const clean = composeMpFindings(
      mp({ sponsoredBills: [bill({ fateSb: "123/2026 Sb.", fatePublishedOn: "2026-05-05" })] }),
    );
    expect(clean[0]).toMatchObject({
      kind: "law_became_law_clean",
      valence: "positive",
      severity: "low",
      laterOn: "2026-05-05",
      laterKind: "fate_sb",
    });
    const dirty = composeMpFindings(
      mp({ sponsoredBills: [bill({ fateSb: "123/2026 Sb.", fatePublishedOn: "2026-05-05", flaggedConflict: true })] }),
    );
    expect(kinds(dirty)).toEqual(["law_sponsor_conflict"]);
  });

  it("law_final_vote is a RECORD row: dated, unrated, and never scored", () => {
    const fs = composeMpFindings(mp({ sponsoredBills: [bill({ finalVoteOn: "2026-04-10" })] }));
    expect(kinds(fs)).toEqual(["law_final_vote"]);
    expect(fs[0]).toMatchObject({
      kind: "law_final_vote",
      valence: "unrated",
      severity: "low",
      laterOn: "2026-04-10",
      laterKind: "final_vote",
      // The vote is a LATER fact about the bill, not the sponsor's choice — so it
      // must never fill `decidedOn`, which stays null until a sponsorship date exists.
      decidedOn: null,
    });
    // `unrated` keeps it out of the scored total while still being counted and shown.
    const ledger = rollupLedger(fs, null);
    expect(ledger.total).toBe(0);
    expect(ledger.counts.unrated.low).toBe(1);
    assertWellFormed(fs);
  });

  it("no decides edge → no record row, and nothing is inferred from the fate date", () => {
    expect(kinds(composeMpFindings(mp({ sponsoredBills: [bill({ finalVoteOn: null, fateSb: "1/2026 Sb." })] })))).toEqual([
      "law_became_law_clean",
    ]);
  });

  it("effort badges: workhorse flag, rapporteur ≥ 3 (2 refuses)", () => {
    const fs = composeMpFindings(mp({ effortWorkhorse: true, effortRapporteurLoad: RAPPORTEUR_MIN }));
    expect(kinds(fs)).toEqual(["effort_workhorse", "effort_rapporteur"]);
    expect(fs.every((f) => f.valence === "positive" && f.decidedOn === "2026-08-01")).toBe(true);
    expect(kinds(composeMpFindings(mp({ effortRapporteurLoad: RAPPORTEUR_MIN - 1 })))).toEqual([]);
    assertWellFormed(fs);
  });

  it("money ties: unrated count, only when > 0", () => {
    expect(composeMpFindings(mp({ moneyTieCount: 0 }))).toEqual([]);
    const [f] = composeMpFindings(mp({ moneyTieCount: 4 }));
    expect(f).toMatchObject({ kind: "money_ties_unrated", valence: "unrated", figures: { ties: 4 } });
    assertWellFormed([f]);
  });
});

/* ── ledger / timeline / keys ─────────────────────────────────────────────── */

describe("rollupLedger", () => {
  it("never counts unrated in total, but shows it under counts.unrated", () => {
    const fs = [
      ...composeMpFindings(mp({ moneyTieCount: 9, effortWorkhorse: true })),
      ...composeMpFindings(
        mp({ pspId: 1, sponsoredBills: [bill({ forensicSeverity: "medium" }), bill({ tisk: "7", forensicSeverity: "medium" })] }),
      ),
    ];
    const l = rollupLedger(fs, { label: "medián sněmovny", share: 0.2, source: "claim:x" });
    expect(l.counts.negative).toEqual({ low: 0, medium: 2, high: 0 });
    expect(l.counts.positive).toEqual({ low: 1, medium: 0, high: 0 });
    expect(l.counts.unrated).toEqual({ low: 1, medium: 0, high: 0 });
    expect(l.total).toBe(3);
    expect(l.baseline?.share).toBe(0.2);
    expect(rollupLedger([], null)).toEqual({
      counts: { negative: { low: 0, medium: 0, high: 0 }, positive: { low: 0, medium: 0, high: 0 }, unrated: { low: 0, medium: 0, high: 0 } },
      total: 0,
      baseline: null,
    });
  });
});

describe("outcomeTimeline", () => {
  it("keeps only dated later facts, newest first, ties by id", () => {
    const fs = composeMpFindings(
      mp({
        sponsoredBills: [
          bill({ tisk: "1", forensicSeverity: "medium", forensicRecordedAt: "2026-01-01" }),
          bill({ tisk: "2", fateSb: "1/2026", fatePublishedOn: "2026-03-01" }),
          bill({ tisk: "3", forensicSeverity: "medium", forensicRecordedAt: "2026-03-01" }),
          bill({ tisk: "4", forensicSeverity: "medium" }), // undated verdict → not on the timeline
        ],
        moneyTieCount: 1,
      }),
    );
    const t = outcomeTimeline(fs);
    expect(t.map((f) => f.objectId)).toEqual(["bill:2", "bill:3", "bill:1"]);
    expect(t.every((f) => f.laterOn !== null)).toBe(true);
  });
});

describe("listSlug", () => {
  it("is deterministic and stable on coalition labels", () => {
    expect(listSlug("ANO 2011")).toBe("ano-2011");
    expect(listSlug("SPOLU – ODS, KDU-ČSL a TOP 09")).toBe("spolu-ods-kdu-csl-a-top-09");
    expect(listSlug("SPOLU – ODS, KDU-ČSL a TOP 09")).toBe(listSlug("SPOLU – ODS, KDU-ČSL a TOP 09"));
    expect(listSlug("Piráti")).toBe("pirati");
    expect(listSlug("Stačilo!")).toBe("stacilo");
  });
});

describe("nodeRef", () => {
  it("matches the claimRef `u.` encoding on three ids", () => {
    for (const id of ["company:ico:00297488", "person:6000", "bill:42"]) {
      expect(nodeRef(id)).toBe(nodeClaimRef(id));
      expect(nodeRef(id).startsWith("u.")).toBe(true);
    }
  });
});

describe("dedupeCurrentHolders", () => {
  it("keeps every distinct person once, on their latest mandate id; distinct persons both survive", () => {
    const rows = [
      { pspId: 1, partyListPspId: 10, mandateId: 100 },
      { pspId: 1, partyListPspId: 10, mandateId: 107 },
      { pspId: 2, partyListPspId: 11, mandateId: 101 }, // predecessor
      { pspId: 3, partyListPspId: 11, mandateId: 205 }, // náhradník — a different person, kept
    ];
    const out = dedupeCurrentHolders(rows);
    expect(out.map((r) => r.pspId).sort()).toEqual([1, 2, 3]);
    expect(out.find((r) => r.pspId === 1)?.mandateId).toBe(107);
    expect(dedupeCurrentHolders([])).toEqual([]);
  });
});

describe("posudek floor + list dedupe (2026-08-27 recalibration)", () => {
  it("a low posudek is not a finding; medium and high are", () => {
    const low = composeMpFindings(mp({ sponsoredBills: [bill({ forensicSeverity: "low" })] }));
    expect(low.filter((f) => f.kind === "law_posudek")).toHaveLength(0);
    const med = composeMpFindings(mp({ sponsoredBills: [bill({ forensicSeverity: "medium" })] }));
    expect(med.filter((f) => f.kind === "law_posudek")).toHaveLength(1);
  });
  it("dedupeByObject keeps one finding per (kind, object) and every objectless finding", () => {
    const a = composeMpFindings(mp({ pspId: 1, sponsoredBills: [bill({ forensicSeverity: "high" })], effortWorkhorse: true }));
    const b = composeMpFindings(mp({ pspId: 2, sponsoredBills: [bill({ forensicSeverity: "high" })], effortWorkhorse: true }));
    const merged = dedupeByObject([...a, ...b]);
    expect(merged.filter((f) => f.kind === "law_posudek")).toHaveLength(1);
    expect(merged.filter((f) => f.kind === "effort_workhorse")).toHaveLength(2);
    expect(merged[0].subjectId).toBe("person:1");
  });
});
