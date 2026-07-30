import { describe, expect, it } from "vitest";
import type { EventIn } from "../record/derive";
import type { ClubTally } from "../record/types";
import { EXCLUDED_THEMES, MIN_POSITIONAL, selectQuestions, type SelectOptions } from "./select";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const ev = (pspId: number, votedOn: string, over: Partial<EventIn> = {}): EventIn => ({
  pspId,
  votedOn,
  votedAt: `${votedOn}T10:00:00.000Z`,
  sessionNo: 1,
  voteNo: pspId,
  outcome: "accepted",
  voided: false,
  titleLong: `Hlasování ${pspId}`,
  titleShort: null,
  titleNorm: `hlasovani ${pspId}`,
  sourceUrl: `https://example.org/${pspId}`,
  ...over,
});

const tally = (yes: number, no: number, k = 0, away = 0): ClubTally => ({ yes, no, k, away });

function run(
  rows: Array<{ event: EventIn; theme?: string; total?: ClubTally }>,
  opts: SelectOptions = {},
) {
  return selectQuestions(
    {
      events: rows.map((r) => r.event),
      totals: new Map(rows.filter((r) => r.total).map((r) => [r.event.pspId, r.total!])),
      themeByVote: new Map(rows.filter((r) => r.theme).map((r) => [r.event.pspId, r.theme!])),
    },
    opts,
  );
}

/* ── floors ────────────────────────────────────────────────────────────────── */

describe("selectQuestions floors", () => {
  it("excludes voided, untagged, excluded-theme and low-participation votes", () => {
    const rows = [
      { event: ev(1, "2026-01-05"), theme: "zdravotnictvi", total: tally(80, 70) }, // in
      { event: ev(2, "2026-01-05", { voided: true }), theme: "zdravotnictvi", total: tally(80, 70) },
      { event: ev(3, "2026-01-05"), total: tally(80, 70) }, // no tag
      { event: ev(4, "2026-01-05"), theme: "procedura", total: tally(80, 70) },
      { event: ev(5, "2026-01-05"), theme: "jine", total: tally(80, 70) },
      { event: ev(6, "2026-01-05"), theme: "zdravotnictvi", total: tally(60, 59) }, // 119 positional < 120
    ];
    const { selected, candidates } = run(rows);
    expect(candidates).toBe(1);
    expect(selected.map((s) => s.event.pspId)).toEqual([1]);
    // The default exclusion list is part of the published rule — pin it.
    expect(EXCLUDED_THEMES).toEqual(["procedura", "jine"]);
    expect(MIN_POSITIONAL).toBe(120);
  });
});

/* ── per-theme ranking ─────────────────────────────────────────────────────── */

describe("selectQuestions ranking", () => {
  it("ranks within a theme by margin asc, then positional desc, date desc, id desc", () => {
    const rows = [
      { event: ev(1, "2026-01-05"), theme: "t", total: tally(100, 60) }, // margin 0.25
      { event: ev(2, "2026-01-05"), theme: "t", total: tally(80, 80) }, // margin 0 — closest
      { event: ev(3, "2026-01-06"), theme: "t", total: tally(90, 90) }, // margin 0, more positional
      { event: ev(4, "2026-01-07"), theme: "t", total: tally(70, 70) }, // margin 0, fewer positional
    ];
    const { selected } = run(rows, { perThemeCap: 4, questionsCap: 4 });
    expect(selected.map((s) => s.event.pspId)).toEqual([3, 2, 4, 1]);
    expect(selected[0].margin).toBe(0);
    expect(selected[3].margin).toBe(0.25);
  });

  it("breaks a full tie by newer date then higher pspId", () => {
    const rows = [
      { event: ev(1, "2026-01-05"), theme: "t", total: tally(70, 70) },
      { event: ev(2, "2026-01-06"), theme: "t", total: tally(70, 70) },
      { event: ev(3, "2026-01-06"), theme: "t", total: tally(70, 70) },
    ];
    const { selected } = run(rows, { perThemeCap: 3, questionsCap: 3 });
    expect(selected.map((s) => s.event.pspId)).toEqual([3, 2, 1]);
  });
});

/* ── round-robin draw + caps ───────────────────────────────────────────────── */

describe("selectQuestions draw", () => {
  it("orders themes by candidate count desc and draws round-robin", () => {
    const rows = [
      // theme "big": 3 candidates; theme "small": 1 candidate
      { event: ev(1, "2026-01-05"), theme: "big", total: tally(80, 79) },
      { event: ev(2, "2026-01-05"), theme: "big", total: tally(100, 60) },
      { event: ev(3, "2026-01-05"), theme: "big", total: tally(90, 89) },
      { event: ev(4, "2026-01-05"), theme: "small", total: tally(70, 70) },
    ];
    const { selected } = run(rows, { perThemeCap: 2, questionsCap: 20 });
    // round 1: big's closest (3: margin ~0.006? — compute: |90-89|/179≈0.006; 1: 1/159≈0.006…)
    // margins: id1 = 1/159 = 0.006, id3 = 1/179 = 0.006 → equal after 3dp rounding;
    // positional decides: id3 has 179 > id1's 159.
    // round-robin: big #1, small #1, big #2 — small has no #2.
    expect(selected.map((s) => s.event.pspId)).toEqual([3, 4, 1]);
  });

  it("caps per theme and in total", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      event: ev(i + 1, "2026-01-05"),
      theme: `t${i % 3}`,
      total: tally(70 + i, 70),
    }));
    const { selected } = run(rows, { perThemeCap: 1, questionsCap: 2 });
    expect(selected).toHaveLength(2);
    const themes = new Set(selected.map((s) => s.theme));
    expect(themes.size).toBe(2);
  });

  it("is deterministic: same input, same output, input order irrelevant", () => {
    const rows = [
      { event: ev(1, "2026-01-05"), theme: "a", total: tally(80, 75) },
      { event: ev(2, "2026-01-06"), theme: "b", total: tally(90, 88) },
      { event: ev(3, "2026-01-07"), theme: "a", total: tally(70, 70) },
      { event: ev(4, "2026-01-08"), theme: "b", total: tally(65, 60) },
    ];
    const a = run(rows).selected.map((s) => s.event.pspId);
    const b = run([...rows].reverse()).selected.map((s) => s.event.pspId);
    expect(a).toEqual(b);
    expect(run(rows).selected.map((s) => s.event.pspId)).toEqual(a);
  });

  it("returns empty selection over an empty ledger", () => {
    expect(run([])).toEqual({ selected: [], candidates: 0 });
  });
});
