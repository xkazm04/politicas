import { describe, expect, it } from "vitest";
import type { ClubTally, VoteIndexEntry } from "../record/types";
import {
  EXCLUDED_THEMES,
  MIN_POSITIONAL,
  MIN_TAG_CONFIDENCE,
  selectQuestions,
  type SelectOptions,
} from "./select";

/* ── fixtures ──────────────────────────────────────────────────────────────── */

/* Vstupem výběru je od 2026-08-11 rejstřík ZÁZNAMU (record/types.ts
 * `VoteIndexEntry`), ne syrové události plus mapa tally: obojí si dřív kompas
 * počítal vlastním průchodem 406 000 hlasy, přestože to derivace záznamu už
 * spočítala. Rejstřík je z definice JEN z platných hlasování — zmatečná do něj
 * record/derive.ts nedává, a proto tady žádný test na `voided` není; drží to
 * `kompasIndex.test.ts` nad reálnou derivací. */
const vi = (pspId: number, votedOn: string, over: Partial<VoteIndexEntry> = {}): VoteIndexEntry => ({
  pspId,
  title: `Hlasování ${pspId}`,
  votedOn,
  sessionNo: 1,
  voteNo: pspId,
  outcome: "accepted",
  sourceUrl: `https://example.org/${pspId}`,
  total: null,
  clubLines: {},
  inLedger: false,
  ...over,
});

const tally = (yes: number, no: number, k = 0, away = 0): ClubTally => ({ yes, no, k, away });

function run(
  rows: Array<{ vote: VoteIndexEntry; theme?: string; total?: ClubTally; confidence?: number | null }>,
  opts: SelectOptions = {},
) {
  return selectQuestions(
    {
      votes: rows.map((r) => ({ ...r.vote, total: r.total ?? null })),
      themeByVote: new Map(rows.filter((r) => r.theme).map((r) => [r.vote.pspId, r.theme!])),
      confidenceByVote: new Map(
        rows.filter((r) => "confidence" in r).map((r) => [r.vote.pspId, r.confidence ?? null]),
      ),
    },
    opts,
  );
}

/* ── floors ────────────────────────────────────────────────────────────────── */

describe("selectQuestions floors", () => {
  it("excludes untagged, excluded-theme and low-participation votes", () => {
    const rows = [
      { vote: vi(1, "2026-01-05"), theme: "zdravotnictvi", total: tally(80, 70) }, // in
      { vote: vi(3, "2026-01-05"), total: tally(80, 70) }, // no tag
      { vote: vi(4, "2026-01-05"), theme: "procedura", total: tally(80, 70) },
      { vote: vi(5, "2026-01-05"), theme: "jine", total: tally(80, 70) },
      { vote: vi(6, "2026-01-05"), theme: "zdravotnictvi", total: tally(60, 59) }, // 119 positional < 120
    ];
    const { selected, candidates } = run(rows);
    expect(candidates).toBe(1);
    expect(selected.map((s) => s.vote.pspId)).toEqual([1]);
    // The default exclusion list is part of the published rule — pin it.
    expect(EXCLUDED_THEMES).toEqual(["procedura", "jine"]);
    expect(MIN_POSITIONAL).toBe(120);
  });
});

/* ── každý práh se počítá ──────────────────────────────────────────────────── */

describe("selectQuestions counts every floor's casualties", () => {
  // Do 2026-08-11 se počítal JEDINÝ práh (jistota tématu); vyloučená témata a
  // účast zahazovaly kandidáty bez čísla — na ploše, jejíž slib je, že pravidlo
  // se dá zkontrolovat.
  it("counts theme exclusions, missing ballots and the participation floor apart", () => {
    const r = run([
      { vote: vi(1, "2026-01-05"), theme: "zdravotnictvi", total: tally(80, 70) }, // candidate
      { vote: vi(2, "2026-01-05"), theme: "procedura", total: tally(80, 70) },
      { vote: vi(3, "2026-01-05"), theme: "jine", total: tally(80, 70) },
      { vote: vi(4, "2026-01-05"), theme: "zdravotnictvi" }, // no stored ballots at all
      { vote: vi(5, "2026-01-05"), theme: "zdravotnictvi", total: tally(60, 59) },
      { vote: vi(6, "2026-01-05"), total: tally(80, 70) }, // untagged — not a casualty
    ]);
    expect(r.candidates).toBe(1);
    expect(r.droppedByTheme).toBe(2);
    expect(r.withoutBallots).toBe(1);
    expect(r.droppedByPositional).toBe(1);
  });

  it("„nedržíme hlasy“ není totéž co „hlasovalo málo poslanců“", () => {
    // Nulové tally by z chybějícího údaje udělalo měření účasti — přesně převod,
    // který si repozitář zakazuje (a který kontrola proti zveřejněným součtům
    // řeší stejně: hlasování bez hlasů je NEPOROVNANÉ, ne nulové).
    const none = run([{ vote: vi(1, "2026-01-05"), theme: "t" }]);
    expect(none.withoutBallots).toBe(1);
    expect(none.droppedByPositional).toBe(0);
    const zero = run([{ vote: vi(1, "2026-01-05"), theme: "t", total: tally(0, 0) }]);
    expect(zero.withoutBallots).toBe(0);
    expect(zero.droppedByPositional).toBe(1);
  });

  it("hlasování vyřazené dřívějším prahem se do dalšího počtu nezapočítá", () => {
    // Prahy se vyhodnocují v pořadí; jinak by součty popisovaly překryv, ne ztrátu.
    const r = run([{ vote: vi(1, "2026-01-05"), theme: "procedura", total: tally(1, 0), confidence: 0.1 }]);
    expect(r.droppedByTheme).toBe(1);
    expect(r.droppedByPositional).toBe(0);
    expect(r.droppedByConfidence).toBe(0);
  });
});

/* ── práh jistoty klasifikátoru ────────────────────────────────────────────── */

describe("selectQuestions confidence floor", () => {
  const themed = (pspId: number, confidence?: number | null) => ({
    vote: vi(pspId, "2026-01-05"),
    theme: "zdravotnictvi",
    total: tally(80, 70),
    ...(confidence === undefined ? {} : { confidence }),
  });

  it("vyřadí tag, který sám hlásí jistotu POD prahem — a spočítá ho", () => {
    const r = run([themed(1, 0.95), themed(2, 0.4)], { minConfidence: 0.7 });
    expect(r.selected.map((s) => s.vote.pspId)).toEqual([1]);
    expect(r.candidates).toBe(1);
    expect(r.droppedByConfidence).toBe(1);
  });

  it("hranice prahu PROCHÁZÍ (práh je „aspoň“, ne „víc než“)", () => {
    // Boundary: exactly at the floor is IN; one epsilon below is OUT. A floor that
    // dropped its own stated value would publish a rule the page does not follow.
    const at = run([themed(1, 0.7)], { minConfidence: 0.7 });
    expect(at.selected.map((s) => s.vote.pspId)).toEqual([1]);
    expect(at.droppedByConfidence).toBe(0);
    const below = run([themed(2, 0.6999)], { minConfidence: 0.7 });
    expect(below.selected).toEqual([]);
    expect(below.droppedByConfidence).toBe(1);
  });

  it("chybějící jistota kandidáta NEVYŘAZUJE, ale počítá se zvlášť", () => {
    // A null confidence claims nothing; reading it as „low" would turn a missing
    // value into a verdict. It stays in and is disclosed on its own counter.
    const r = run([themed(1, null), themed(2)], { minConfidence: 0.7 });
    // Order is the ranking rule's business (a full tie breaks by higher id) — this
    // test only claims that neither row was dropped.
    expect(r.selected.map((s) => s.vote.pspId).sort()).toEqual([1, 2]);
    expect(r.withoutConfidence).toBe(2);
    expect(r.droppedByConfidence).toBe(0);
  });

  it("prahem neprojde hlasování, které stejně nesplnilo účast — nepočítá se dvakrát", () => {
    const r = run([{ vote: vi(1, "2026-01-05"), theme: "t", total: tally(60, 59), confidence: 0.1 }]);
    expect(r.candidates).toBe(0);
    expect(r.droppedByConfidence).toBe(0);
    expect(r.droppedByPositional).toBe(1);
  });

  it("výchozí práh je zveřejněná konstanta", () => {
    expect(MIN_TAG_CONFIDENCE).toBe(0.7);
    const r = run([themed(1, MIN_TAG_CONFIDENCE), themed(2, MIN_TAG_CONFIDENCE - 0.01)]);
    expect(r.selected.map((s) => s.vote.pspId)).toEqual([1]);
    expect(r.droppedByConfidence).toBe(1);
  });
});

/* ── per-theme ranking ─────────────────────────────────────────────────────── */

describe("selectQuestions ranking", () => {
  it("ranks within a theme by margin asc, then positional desc, date desc, id desc", () => {
    const rows = [
      { vote: vi(1, "2026-01-05"), theme: "t", total: tally(100, 60) }, // margin 0.25
      { vote: vi(2, "2026-01-05"), theme: "t", total: tally(80, 80) }, // margin 0 — closest
      { vote: vi(3, "2026-01-06"), theme: "t", total: tally(90, 90) }, // margin 0, more positional
      { vote: vi(4, "2026-01-07"), theme: "t", total: tally(70, 70) }, // margin 0, fewer positional
    ];
    const { selected } = run(rows, { perThemeCap: 4, questionsCap: 4 });
    expect(selected.map((s) => s.vote.pspId)).toEqual([3, 2, 4, 1]);
    expect(selected[0].margin).toBe(0);
    expect(selected[3].margin).toBe(0.25);
  });

  it("breaks a full tie by newer date then higher pspId", () => {
    const rows = [
      { vote: vi(1, "2026-01-05"), theme: "t", total: tally(70, 70) },
      { vote: vi(2, "2026-01-06"), theme: "t", total: tally(70, 70) },
      { vote: vi(3, "2026-01-06"), theme: "t", total: tally(70, 70) },
    ];
    const { selected } = run(rows, { perThemeCap: 3, questionsCap: 3 });
    expect(selected.map((s) => s.vote.pspId)).toEqual([3, 2, 1]);
  });
});

/* ── round-robin draw + caps ───────────────────────────────────────────────── */

describe("selectQuestions draw", () => {
  it("orders themes by candidate count desc and draws round-robin", () => {
    const rows = [
      // theme "big": 3 candidates; theme "small": 1 candidate
      { vote: vi(1, "2026-01-05"), theme: "big", total: tally(80, 79) },
      { vote: vi(2, "2026-01-05"), theme: "big", total: tally(100, 60) },
      { vote: vi(3, "2026-01-05"), theme: "big", total: tally(90, 89) },
      { vote: vi(4, "2026-01-05"), theme: "small", total: tally(70, 70) },
    ];
    const { selected } = run(rows, { perThemeCap: 2, questionsCap: 20 });
    // round 1: big's closest (3: margin ~0.006? — compute: |90-89|/179≈0.006; 1: 1/159≈0.006…)
    // margins: id1 = 1/159 = 0.006, id3 = 1/179 = 0.006 → equal after 3dp rounding;
    // positional decides: id3 has 179 > id1's 159.
    // round-robin: big #1, small #1, big #2 — small has no #2.
    expect(selected.map((s) => s.vote.pspId)).toEqual([3, 4, 1]);
  });

  it("caps per theme and in total", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      vote: vi(i + 1, "2026-01-05"),
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
      { vote: vi(1, "2026-01-05"), theme: "a", total: tally(80, 75) },
      { vote: vi(2, "2026-01-06"), theme: "b", total: tally(90, 88) },
      { vote: vi(3, "2026-01-07"), theme: "a", total: tally(70, 70) },
      { vote: vi(4, "2026-01-08"), theme: "b", total: tally(65, 60) },
    ];
    const a = run(rows).selected.map((s) => s.vote.pspId);
    const b = run([...rows].reverse()).selected.map((s) => s.vote.pspId);
    expect(a).toEqual(b);
    expect(run(rows).selected.map((s) => s.vote.pspId)).toEqual(a);
  });

  it("returns empty selection over an empty ledger", () => {
    expect(run([])).toEqual({
      selected: [],
      candidates: 0,
      droppedByTheme: 0,
      withoutBallots: 0,
      droppedByPositional: 0,
      droppedByConfidence: 0,
      withoutConfidence: 0,
    });
  });
});
