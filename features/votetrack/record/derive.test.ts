import { describe, expect, it } from "vitest";
import { parseVoteAnchor, voteAnchorId, votePspUrl } from "./anchor";
import {
  bucketOf,
  chamberCohesion,
  deriveVoteRecord,
  disciplineOf,
  lineOf,
  riceOf,
  type BallotIn,
  type EventIn,
} from "./derive";
import type { ClubTally, ClubVoteStat } from "./types";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

// mandates 10/11/12 → club A (persons 1/2/3); 20/21 → club B (persons 4/5);
// mandate 30 (person 6) has NO club — nezařazený.
const CLUB = new Map<number, string>([
  [10, "A"],
  [11, "A"],
  [12, "A"],
  [20, "B"],
  [21, "B"],
]);
const PERSON = new Map<number, number>([
  [10, 1],
  [11, 2],
  [12, 3],
  [20, 4],
  [21, 5],
  [30, 6],
]);
const NAME = new Map<number, string>([
  [1, "Alena Adamová"],
  [2, "Bohumil Beneš"],
  [3, "Cyril Czerný"],
  [4, "Dana Dvořáková"],
  [5, "Emil Erben"],
  [6, "Filip Fiala"],
]);

const ev = (pspId: number, votedOn: string, over: Partial<EventIn> = {}): EventIn => ({
  pspId,
  votedOn,
  votedAt: `${votedOn}T10:0${pspId % 10}:00.000Z`,
  sessionNo: 1,
  voteNo: pspId,
  outcome: "accepted",
  voided: false,
  titleLong: `Hlasování ${pspId}`,
  titleShort: null,
  titleNorm: `hlasovani ${pspId}`,
  sourceUrl: `https://www.psp.cz/sqw/hlasy.sqw?g=${pspId}`,
  ...over,
});

const b = (votePspId: number, mandatePspId: number, choice: string): BallotIn => ({ votePspId, mandatePspId, choice });

const derive = (events: EventIn[], ballots: BallotIn[]) =>
  deriveVoteRecord(
    { events, ballots, clubByMandate: CLUB, personByMandate: PERSON, nameByPerson: NAME },
    { minClubPositional: 2, minEligible: 1, ledgerWindow: 3 },
  );

/* ── primitives ────────────────────────────────────────────────────────────── */

describe("bucketOf", () => {
  it("classifies the store vocabulary into the four display buckets", () => {
    expect(bucketOf("yes")).toBe("yes");
    expect(bucketOf("no")).toBe("no");
    expect(bucketOf("abstain")).toBe("k");
    expect(bucketOf("not_voting")).toBe("k");
    expect(bucketOf("abstain_or_not_voting")).toBe("k");
    expect(bucketOf("not_logged_in")).toBe("away");
    expect(bucketOf("excused")).toBe("away");
    expect(bucketOf("pre_oath")).toBe("away");
    expect(bucketOf("unknown")).toBe("away");
  });
});

describe("lineOf / disciplineOf / riceOf", () => {
  const t = (yes: number, no: number, k = 0, away = 0): ClubTally => ({ yes, no, k, away });

  it("strict majority sets the line; a tie yields NO line (never a default)", () => {
    expect(lineOf(t(3, 1))).toBe("yes");
    expect(lineOf(t(1, 3))).toBe("no");
    expect(lineOf(t(2, 2))).toBeNull();
    expect(lineOf(t(0, 0, 5, 2))).toBeNull();
  });

  it("discipline is the on-line share of positional votes only — K never counts", () => {
    expect(disciplineOf(t(3, 1, 10, 10))).toBe(0.75);
    expect(disciplineOf(t(0, 0, 8))).toBeNull();
  });

  it("Rice index: unanimous = 1, even split = 0, no positional = null", () => {
    expect(riceOf(t(4, 0))).toBe(1);
    expect(riceOf(t(2, 2))).toBe(0);
    expect(riceOf(t(3, 1))).toBe(0.5);
    expect(riceOf(t(0, 0, 3, 1))).toBeNull();
  });
});

describe("chamberCohesion", () => {
  const s = (yes: number, no: number): ClubVoteStat => ({
    yes,
    no,
    k: 0,
    away: 0,
    line: lineOf({ yes, no, k: 0, away: 0 }),
    discipline: disciplineOf({ yes, no, k: 0, away: 0 }),
    rice: riceOf({ yes, no, k: 0, away: 0 }),
  });

  it("weights per-club Rice by positional voters", () => {
    // A: 4 positional, rice 1 · B: 4 positional, rice 0 → mean 0.5
    expect(chamberCohesion({ A: s(4, 0), B: s(2, 2) }, 2)).toBe(0.5);
    // A: 6 positional rice 1 · B: 2 positional rice 0 → (6·1+2·0)/8
    expect(chamberCohesion({ A: s(6, 0), B: s(1, 1) }, 2)).toBe(0.75);
  });

  it("ignores clubs below the positional floor; null when none qualifies", () => {
    expect(chamberCohesion({ A: s(4, 0), B: s(1, 0) }, 2)).toBe(1);
    expect(chamberCohesion({ A: s(1, 0), B: s(0, 1) }, 2)).toBeNull();
    expect(chamberCohesion({}, 2)).toBeNull();
  });
});

/* ── the full derivation ───────────────────────────────────────────────────── */

describe("deriveVoteRecord", () => {
  const events = [
    ev(101, "2026-01-05"),
    ev(102, "2026-01-05", { outcome: "rejected" }),
    ev(103, "2026-01-12"),
    ev(104, "2026-01-12", { voided: true }),
  ];
  // vote 101: A splits 2:1 (line yes, Cyril rebels no), B unanimous no, Filip (no club) yes
  // vote 102: A unanimous yes (one K), B ties 1:1 (no line → no rebellion possible)
  // vote 103: everyone yes — perfectly calm
  // vote 104: VOIDED — ballots must be ignored entirely
  const ballots = [
    b(101, 10, "yes"),
    b(101, 11, "yes"),
    b(101, 12, "no"),
    b(101, 20, "no"),
    b(101, 21, "no"),
    b(101, 30, "yes"),
    b(102, 10, "yes"),
    b(102, 11, "yes"),
    b(102, 12, "abstain_or_not_voting"),
    b(102, 20, "yes"),
    b(102, 21, "no"),
    b(103, 10, "yes"),
    b(103, 11, "yes"),
    b(103, 12, "yes"),
    b(103, 20, "yes"),
    b(103, 21, "yes"),
    b(104, 10, "yes"),
    b(104, 11, "no"),
  ];

  it("excludes voided votes from every surface and counts coverage honestly", () => {
    const r = derive(events, ballots);
    expect(r.coverage).toMatchObject({ events: 4, valid: 3, voided: 1, from: "2026-01-05", to: "2026-01-12" });
    expect(r.coverage.ballots).toBe(16); // vote 104's two ballots not counted
    expect(r.ledger.map((l) => l.pspId)).toEqual([103, 102, 101]); // newest first, no 104
  });

  it("derives per-club line, discipline and rebels for a split vote", () => {
    const r = derive(events, ballots);
    const v101 = r.ledger.find((l) => l.pspId === 101)!;
    expect(v101.stat.byClub.A).toMatchObject({ yes: 2, no: 1, line: "yes", discipline: 0.667 });
    expect(v101.stat.byClub.B).toMatchObject({ yes: 0, no: 2, line: "no", discipline: 1, rice: 1 });
    expect(v101.rebels).toEqual([
      { personPspId: 3, name: "Cyril Czerný", club: "A", choice: "no", line: "yes" },
    ]);
    expect(v101.stat.rebelCount).toBe(1);
    // nezařazený Filip renders in the unaffiliated bucket, never as a rebel
    expect(v101.stat.unaffiliated).toEqual({ yes: 1, no: 0, k: 0, away: 0 });
  });

  it("a tied club has no line — its members can never be rebels on that vote", () => {
    const r = derive(events, ballots);
    const v102 = r.ledger.find((l) => l.pspId === 102)!;
    expect(v102.stat.byClub.B.line).toBeNull();
    expect(v102.rebels).toEqual([]);
    // K ballot is non-positional: A's discipline stays 1 on 2 positional votes
    expect(v102.stat.byClub.A).toMatchObject({ yes: 2, no: 0, k: 1, discipline: 1 });
  });

  it("chamber cohesion per vote is the weighted Rice mean; the seismogram buckets by day", () => {
    const r = derive(events, ballots);
    // 101: A rice |2−1|/3 → 0.333 (w3) + B rice 1 (w2) → (0.333·3+1·2)/5 = 0.6
    const v101 = r.ledger.find((l) => l.pspId === 101)!;
    expect(v101.stat.cohesion).toBe(0.6);
    // 102: A rice 1 (w2) + B tie rice 0 (w2) → 0.5
    expect(r.ledger.find((l) => l.pspId === 102)!.stat.cohesion).toBe(0.5);
    expect(r.seismogram.map((d) => d.date)).toEqual(["2026-01-05", "2026-01-12"]);
    const day1 = r.seismogram[0];
    expect(day1.votes).toBe(2);
    expect(day1.rebels).toBe(1);
    // worst of the day is vote 102 (0.5 < vote 101's 0.6)
    expect(day1.worst).toMatchObject({ pspId: 102, cohesion: 0.5, inLedger: true });
    // a voided-only day never appears; day 2 has a single calm vote
    expect(r.seismogram[1]).toMatchObject({ votes: 1, meanCohesion: 1, rebels: 0 });
  });

  it("club aggregates average over line votes; seats come from the newest roll call", () => {
    const r = derive(events, ballots);
    const a = r.clubs.find((c) => c.club === "A")!;
    const bClub = r.clubs.find((c) => c.club === "B")!;
    expect(a.seats).toBe(3);
    expect(bClub.seats).toBe(2);
    expect(a.lineVotes).toBe(3);
    expect(a.avgDiscipline).toBe(round3mean([2 / 3, 1, 1]));
    expect(bClub.lineVotes).toBe(2); // the tied vote 102 drops out
    expect(bClub.avgDiscipline).toBe(1);
  });

  it("ranks rebels by rate over eligible votes and caps the chronicle newest-first", () => {
    const r = derive(events, ballots);
    expect(r.topRebels[0]).toMatchObject({ personPspId: 3, rebelVotes: 1, club: "A" });
    // vote 102 he voted K (non-positional) → not eligible there: 2 of 3 votes count
    expect(r.topRebels[0].eligibleVotes).toBe(2);
    expect(r.topRebels[0].rate).toBe(0.5);
    expect(r.chronicle).toHaveLength(1);
    expect(r.chronicle[0]).toMatchObject({ votePspId: 101, personPspId: 3, votedOn: "2026-01-05" });
    // an MP below the eligibility floor is never ranked
    const strict = deriveVoteRecord(
      { events, ballots, clubByMandate: CLUB, personByMandate: PERSON, nameByPerson: NAME },
      { minClubPositional: 2, minEligible: 10 },
    );
    expect(strict.topRebels).toEqual([]);
  });

  it("is deterministic: same input twice → identical output", () => {
    expect(derive(events, ballots)).toEqual(derive(events, ballots));
  });
});

const round3mean = (xs: number[]) => {
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return r3(xs.map(r3).reduce((s, v) => s + v, 0) / xs.length);
};

/* ── anchors ───────────────────────────────────────────────────────────────── */

describe("vote anchors", () => {
  it("derives the id and parses it back (round-trip)", () => {
    expect(voteAnchorId(92793)).toBe("h-92793");
    expect(parseVoteAnchor(voteAnchorId(92793))).toBe(92793);
    expect(parseVoteAnchor("#h-92793")).toBe(92793);
  });

  it("derives the public psp.cz roll-call address from the vote id", () => {
    expect(votePspUrl(88356)).toBe("https://www.psp.cz/sqw/hlasy.sqw?g=88356");
  });

  it("rejects section anchors and malformed fragments", () => {
    expect(parseVoteAnchor("#denik")).toBeNull();
    expect(parseVoteAnchor("#h-")).toBeNull();
    expect(parseVoteAnchor("h-12x")).toBeNull();
    expect(parseVoteAnchor("#h--5")).toBeNull();
    expect(parseVoteAnchor("#h-0")).toBeNull();
    expect(parseVoteAnchor("")).toBeNull();
  });
});
