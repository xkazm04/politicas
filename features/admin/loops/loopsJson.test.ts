// Round-trip kodeku /admin/loops.json (6E) — co encodeLoopsDoc vydá,
// parseLoopsDoc přečte beze ztráty; cizí/rozbité dokumenty vrací null.

import { describe, expect, it } from "vitest";
import { deriveLoopState, LOOPS_SCHEMA } from "./loopState";
import { DRIVE_CHAIN_NOTE_CS, encodeLoopsDoc, parseLoopsDoc, type LoopsDoc } from "./loopsJson";

function fixtureDoc(): LoopsDoc {
  const { loops, alerts } = deriveLoopState({
    now: "2026-07-30T12:00:00.000Z",
    loopsPaused: true,
    caseLoops: [
      {
        id: "money",
        labelCs: "Peníze (FollowTheMoney)",
        batchesCompleted: 12,
        unitsProcessed: 211,
        unitsTotal: 211,
        openFrontier: 2,
      },
    ],
    casePasses: [{ pass: 41, track: "money", title: "batch 012", date: "2026-07-27" }],
    ingestRuns: [
      {
        source: "psp-hlasovani",
        startedAt: "2026-07-10T02:00:00.000Z",
        finishedAt: "2026-07-10T02:05:00.000Z",
        status: "ok",
        rowsWritten: 100,
        note: null,
      },
    ],
  });
  return {
    schema: LOOPS_SCHEMA,
    generatedAt: "2026-07-30T12:00:00.000Z",
    pausedNoteCs: "loopy pozastaveny — manifestační fáze",
    loops,
    alerts: alerts.map((a) => ({ ...a, acknowledged: false, acknowledgedAt: null })),
    drive: {
      pending: [{ seq: 1, target: "case:money", note: "batch 013", requestedAt: "2026-07-30T09:00:00.000Z" }],
      log: {
        path: ".data/loop-drive.jsonl",
        entries: 1,
        skipped: 0,
        chainOk: true,
        chainNoteCs: DRIVE_CHAIN_NOTE_CS,
      },
    },
  };
}

describe("loops.json kodek", () => {
  it("round-trip beze ztráty (včetně odvozené výstrahy — zdroj je 20 dní starý)", () => {
    const doc = fixtureDoc();
    expect(doc.alerts.length).toBeGreaterThan(0); // fixture má opravdu stalled zdroj
    const parsed = parseLoopsDoc(encodeLoopsDoc(doc));
    expect(parsed).toEqual(doc);
  });

  it("cizí schéma, rozbitý JSON a špatné tvary vrací null, nikdy výjimku", () => {
    expect(parseLoopsDoc("{ tohle není JSON")).toBeNull();
    expect(parseLoopsDoc(JSON.stringify({ schema: "jine/1" }))).toBeNull();
    const doc = fixtureDoc();
    expect(parseLoopsDoc(JSON.stringify({ ...doc, loops: "ne-pole" }))).toBeNull();
    expect(parseLoopsDoc(JSON.stringify({ ...doc, drive: undefined }))).toBeNull();
    const badAlert = { ...doc, alerts: [{ id: 1 }] };
    expect(parseLoopsDoc(JSON.stringify(badAlert))).toBeNull();
  });
});
