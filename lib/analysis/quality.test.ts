import { describe, expect, it } from "vitest";
import {
  buildContext,
  fracScore,
  scoreBallot,
  scoreSlice,
  scoreVoteEvent,
  volumeScore,
  type RowFlags,
  type ScoringContext,
} from "./quality";
import type { VoteBallotRow, VoteEventRow } from "@/lib/db/types";

const prov = { source: "s", sourceUrl: "u", fetchedAt: "2026-07-23T00:00:00.000Z", ingestRunId: 1 };

function emptyCtx(): ScoringContext {
  return buildContext({ persons: [], organs: [], mandates: [], voteEvents: [], clubByMandate: new Map() });
}

describe("scoring arithmetic (kept identical to the reference scorer)", () => {
  it("maps a fraction to a 1-5 score", () => {
    expect(fracScore(0)).toBe(1);
    expect(fracScore(1)).toBe(5);
    expect(fracScore(0.5)).toBe(3);
  });
  it("bands volume the same as every onboarded corpus", () => {
    expect(volumeScore(1000)).toBe(5);
    expect(volumeScore(200)).toBe(4);
    expect(volumeScore(50)).toBe(3);
    expect(volumeScore(10)).toBe(2);
    expect(volumeScore(3)).toBe(1);
  });
});

describe("scoreVoteEvent", () => {
  function vote(over: Partial<VoteEventRow>): VoteEventRow {
    return {
      id: "psp:hlasovani:1", pspId: 1, termPspId: 174, termCode: "PSP10",
      sessionNo: 1, voteNo: 1, agendaItem: 3, votedAt: "2025-11-03T15:10:00.000Z",
      votedOn: "2025-11-03", yes: 100, no: 50, abstain: 10, notVoting: 5, present: 165,
      quorum: 83, kind: "normal", outcome: "accepted",
      titleLong: "Zákon o něčem", titleShort: "Zákon", titleNorm: "zakon o necem",
      voided: false, ...prov, raw: {}, ...over,
    };
  }
  it("passes validity only when the tally reconciles", () => {
    expect(scoreVoteEvent(vote({})).valid).toBe(true);
    // 100+50+10+5 = 165, but present says 166 → internally inconsistent.
    expect(scoreVoteEvent(vote({ present: 166 })).valid).toBe(false);
  });
  it("caps richness when the short title is empty (the PSP10 reality)", () => {
    expect(scoreVoteEvent(vote({ titleShort: null })).rich).toBe(false);
  });
  it("marks an unknown outcome as uncategorized", () => {
    expect(scoreVoteEvent(vote({ outcome: "void" })).categorized).toBe(false);
  });
});

describe("scoreBallot", () => {
  const ctx = buildContext({
    persons: [], organs: [],
    mandates: [{ id: "m", pspId: 2074, personPspId: 1, termPspId: 174, termCode: "PSP10", regionPspId: null, partyListPspId: null, web: null, email: null, phone: null, pspPhone: null, facebook: null, hasPhoto: false, ...prov, raw: {} }],
    voteEvents: [{ id: "v", pspId: 86327, termPspId: 174, termCode: "PSP10", sessionNo: 1, voteNo: 1, agendaItem: 1, votedAt: null, votedOn: null, yes: null, no: null, abstain: null, notVoting: null, present: null, quorum: null, kind: "normal", outcome: "accepted", titleLong: null, titleShort: null, titleNorm: "", voided: false, ...prov, raw: {} }],
    clubByMandate: new Map(),
  });
  function ballot(over: Partial<VoteBallotRow>): VoteBallotRow {
    return { id: "b", votePspId: 86327, mandatePspId: 2074, code: "A", choice: "yes", ...prov, ...over };
  }
  it("is valid only when both edges of the graph resolve", () => {
    expect(scoreBallot(ballot({}), ctx).valid).toBe(true);
    expect(scoreBallot(ballot({ votePspId: 999999 }), ctx).valid).toBe(false);
    expect(scoreBallot(ballot({ mandatePspId: 999999 }), ctx).valid).toBe(false);
  });
  it("treats the merged K bucket as low richness, not missing", () => {
    const r = scoreBallot(ballot({ code: "K", choice: "abstain_or_not_voting" }), ctx);
    expect(r.categorized).toBe(true); // it IS a documented choice
    expect(r.rich).toBe(false); // but not a distinguishable position
  });
});

describe("scoreSlice", () => {
  it("composites the six criteria as their mean", () => {
    const flags: RowFlags[] = Array.from({ length: 300 }, () => ({
      complete: true, categorized: true, valid: true, rich: true,
    }));
    const row = scoreSlice({
      slice: "s×t×e", source: "s", term: "t", entity: "e", flags,
      syncAgeDays: 0, rowLagDays: 0,
    });
    // all-pass rows + fresh + 300 rows(vol 4) → mean(5,5,5,5,5,4) = 4.8
    expect(row.scores.completeness).toBe(5);
    expect(row.scores.volume).toBe(4);
    expect(row.composite).toBe(4.8);
    expect(row.rowsValid).toBe(300);
  });

  it("uses the empty-ctx builder without throwing", () => {
    expect(emptyCtx().personIds.size).toBe(0);
  });
});
