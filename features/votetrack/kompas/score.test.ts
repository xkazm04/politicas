import { describe, expect, it } from "vitest";
import { MIN_ANSWERS, scoreAlignment, type Answer } from "./score";
import type { ClubTally } from "../record/types";
import type { KompasBallots, KompasClubLines, KompasMp, KompasQuestion } from "./types";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const tally = (yes: number, no: number, k = 0, away = 0): ClubTally => ({ yes, no, k, away });

const q = (votePspId: number): KompasQuestion => ({
  votePspId,
  title: `Hlasování ${votePspId}`,
  theme: "zdravotnictvi",
  votedOn: "2026-01-05",
  sessionNo: 1,
  voteNo: votePspId,
  outcome: "accepted",
  total: tally(100, 80, 10, 10),
  margin: 0.111,
  sourceUrl: `https://example.org/${votePspId}`,
  // Scoring nezajímá, jestli hlasování leží v okně deníku — ten příznak řídí jen
  // to, jestli řádek smí odkázat na kotvu `#h-…`, nebo musí na psp.cz.
  inLedger: true,
});

const MPS: KompasMp[] = [
  { personPspId: 1, name: "Alena Adamová", club: "A" },
  { personPspId: 2, name: "Bohumil Beneš", club: "A" },
  { personPspId: 3, name: "Cyril Czerný", club: "B" },
  { personPspId: 4, name: "Filip Fiala", club: null }, // nezařazený
];

const answers = (entries: Array<[number, Answer]>): Map<number, Answer> => new Map(entries);

/* ── the documented agreement / abstain / absent rule ──────────────────────── */

describe("scoreAlignment — MP rule", () => {
  const QUESTIONS = [q(101), q(102), q(103), q(104)];
  // MP1: pro, pro, proti, K       MP2: proti on everything MP1 is pro on
  // MP3: K, K, away, away         MP4: pro, away, away, away
  const BALLOTS: KompasBallots = {
    101: { 1: "yes", 2: "no", 3: "k", 4: "yes" },
    102: { 1: "yes", 2: "no", 3: "k" },
    103: { 1: "no", 2: "yes" },
    104: { 1: "k", 2: "no" },
  };

  it("scores agreement over comparable (positional) votes only", () => {
    // Reader: pro 101, pro 102, proti 103, pro 104 → answered 4.
    const r = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([[101, "pro"], [102, "pro"], [103, "proti"], [104, "pro"]]));
    expect(r.answered).toBe(4);
    const mp1 = r.mps.find((m) => m.personPspId === 1)!;
    // MP1: comparable 101/102/103 (K on 104 excluded) — matches all 3.
    expect(mp1).toMatchObject({ comparable: 3, matches: 3, kCount: 1, awayCount: 0, rate: 1, rankable: true });
    const mp2 = r.mps.find((m) => m.personPspId === 2)!;
    // MP2: positional on all 4, opposite on 101/102/103, "no" on 104 vs reader "pro" → 0 matches.
    expect(mp2).toMatchObject({ comparable: 4, matches: 0, rate: 0, rankable: true });
  });

  it("never counts abstain (K) or absence as agreement or disagreement", () => {
    const r = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([[101, "pro"], [102, "pro"], [103, "pro"], [104, "pro"]]));
    const mp3 = r.mps.find((m) => m.personPspId === 3)!;
    expect(mp3).toMatchObject({ comparable: 0, matches: 0, kCount: 2, awayCount: 2, rate: null, rankable: false });
  });

  it("ranks only MPs with positional ballots on ≥ half the answered questions", () => {
    // answered = 4 → minComparable = 2; MP4 has 1 positional (101) → unrankable, rate still shown.
    const r = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([[101, "pro"], [102, "pro"], [103, "pro"], [104, "pro"]]));
    const mp4 = r.mps.find((m) => m.personPspId === 4)!;
    expect(mp4).toMatchObject({ comparable: 1, matches: 1, rate: 1, rankable: false, awayCount: 3 });
    // Rankable rows sort above unrankable ones regardless of rate.
    const rankFlags = r.mps.map((m) => m.rankable);
    expect(rankFlags.slice(0, 2).every(Boolean)).toBe(true);
    expect(rankFlags.slice(2).some(Boolean)).toBe(false);
  });

  it("ignores answers to votes outside the question set", () => {
    const r = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([[101, "pro"], [999, "proti"]]));
    expect(r.answered).toBe(1);
  });

  it("is deterministic and order-stable: rate desc, comparable desc, Czech name", () => {
    const r1 = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([[101, "pro"], [103, "proti"]]));
    const r2 = scoreAlignment(QUESTIONS, [...MPS].reverse(), BALLOTS, {}, answers([[101, "pro"], [103, "proti"]]));
    expect(r1.mps.map((m) => m.personPspId)).toEqual(r2.mps.map((m) => m.personPspId));
  });

  it("with zero answers nothing is rankable and MIN_ANSWERS gates the UI", () => {
    const r = scoreAlignment(QUESTIONS, MPS, BALLOTS, {}, answers([]));
    expect(r.answered).toBe(0);
    expect(r.mps.every((m) => !m.rankable && m.comparable === 0)).toBe(true);
    expect(MIN_ANSWERS).toBe(3);
  });
});

/* ── club-line rule ────────────────────────────────────────────────────────── */

describe("scoreAlignment — club rule", () => {
  const QUESTIONS = [q(101), q(102), q(103)];
  const LINES: KompasClubLines = {
    101: { A: "yes", B: "no" },
    102: { A: "no" }, // B tied → no line → not comparable for B
  };

  it("scores clubs against their line; a vote without a line is not comparable", () => {
    const r = scoreAlignment(
      QUESTIONS,
      MPS,
      {},
      LINES,
      answers([[101, "pro"], [102, "pro"], [103, "pro"]]),
    );
    const a = r.clubs.find((c) => c.club === "A")!;
    // A: line yes on 101 (match), no on 102 (differ), none on 103 → 1/2.
    expect(a).toMatchObject({ comparable: 2, matches: 1, rate: 0.5, rankable: true });
    const b = r.clubs.find((c) => c.club === "B")!;
    // B: only 101 has a line (no vs reader pro) → 0/1; 1 < ceil(3/2)=2 → unrankable.
    expect(b).toMatchObject({ comparable: 1, matches: 0, rate: 0, rankable: false });
    // Unaffiliated MPs never form a club row.
    expect(r.clubs.map((c) => c.club).sort()).toEqual(["A", "B"]);
  });
});
