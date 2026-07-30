// Deterministic question selection for the Volební kompas naruby — the
// DISCLOSED rule, rendered verbatim in the UI (copy.ts selectionRule). No
// editorial hand touches the set: the same ledger always yields the same
// questions.
//
// The rule:
//   1. Candidates are valid (non-voided) PSP10 roll calls that carry a
//      Silver-layer theme tag, excluding the themes `procedura` and `jine`
//      (procedural motions and unclassifiable titles make poor positions),
//      with at least MIN_POSITIONAL positional ballots (pro + proti) — high
//      participation.
//   2. Within each theme, candidates rank by closeness: margin
//      |pro − proti| / (pro + proti) ascending (the most divided first);
//      ties break by more positional ballots, newer date, higher psp.cz id.
//   3. Themes order by their candidate count descending (ties: Czech
//      collation of the slug); the set is drawn round-robin — every theme's
//      1st pick, then every theme's 2nd — up to PER_THEME_CAP per theme and
//      QUESTIONS_CAP total.
//
// Pure + fixture-tested in select.test.ts; the loader (getKompas.ts) is a
// thin IO shell.

import type { EventIn } from "../record/derive";
import type { ClubTally } from "../record/types";

export const QUESTIONS_CAP = 20;
export const PER_THEME_CAP = 2;
export const MIN_POSITIONAL = 120;
export const EXCLUDED_THEMES: readonly string[] = ["procedura", "jine"];

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface SelectOptions {
  questionsCap?: number;
  perThemeCap?: number;
  minPositional?: number;
  excludedThemes?: readonly string[];
}

export interface SelectedVote {
  event: EventIn;
  theme: string;
  total: ClubTally;
  /** |yes − no| / (yes + no), 3dp. */
  margin: number;
}

export interface SelectionResult {
  selected: SelectedVote[];
  /** Candidates that passed all floors (before the caps). */
  candidates: number;
}

export function selectQuestions(
  input: {
    events: readonly EventIn[];
    /** Bucketed 200-ballot tallies per vote (record/derive.ts bucketOf rule). */
    totals: ReadonlyMap<number, ClubTally>;
    /** Silver-layer theme per vote. */
    themeByVote: ReadonlyMap<number, string>;
  },
  opts: SelectOptions = {},
): SelectionResult {
  const questionsCap = opts.questionsCap ?? QUESTIONS_CAP;
  const perThemeCap = opts.perThemeCap ?? PER_THEME_CAP;
  const minPositional = opts.minPositional ?? MIN_POSITIONAL;
  const excluded = new Set(opts.excludedThemes ?? EXCLUDED_THEMES);

  /* 1 — candidate floor */
  const byTheme = new Map<string, SelectedVote[]>();
  let candidates = 0;
  for (const event of input.events) {
    if (event.voided) continue;
    const theme = input.themeByVote.get(event.pspId);
    if (theme === undefined || excluded.has(theme)) continue;
    const total = input.totals.get(event.pspId);
    if (!total) continue;
    const pos = total.yes + total.no;
    if (pos < minPositional) continue;
    candidates++;
    const margin = round3(Math.abs(total.yes - total.no) / pos);
    let list = byTheme.get(theme);
    if (!list) {
      list = [];
      byTheme.set(theme, list);
    }
    list.push({ event, theme, total, margin });
  }

  /* 2 — per-theme rank: margin asc, positional desc, newest, higher id */
  for (const list of byTheme.values()) {
    list.sort(
      (a, b) =>
        a.margin - b.margin ||
        b.total.yes + b.total.no - (a.total.yes + a.total.no) ||
        (b.event.votedOn ?? "").localeCompare(a.event.votedOn ?? "") ||
        b.event.pspId - a.event.pspId,
    );
  }

  /* 3 — theme order by candidate count desc, then round-robin draw */
  const themes = [...byTheme.keys()].sort(
    (a, b) => byTheme.get(b)!.length - byTheme.get(a)!.length || a.localeCompare(b, "cs"),
  );
  const selected: SelectedVote[] = [];
  for (let round = 0; round < perThemeCap && selected.length < questionsCap; round++) {
    for (const theme of themes) {
      if (selected.length >= questionsCap) break;
      const pick = byTheme.get(theme)![round];
      if (pick) selected.push(pick);
    }
  }
  return { selected, candidates };
}
