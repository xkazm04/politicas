// Deterministic question selection for the Volební kompas naruby — the
// DISCLOSED rule, rendered verbatim in the UI (copy.ts selectionRule). No
// editorial hand touches the set: the same ledger always yields the same
// questions.
//
// ── Vstup je REJSTŘÍK ZÁZNAMU (2026-08-11) ─────────────────────────────────
// Dřív sem chodily `EventIn[]` plus mapa celosněmovních tally, kterou si
// getKompas.ts počítal vlastním průchodem 406 000 hlasů. Teď chodí
// `VoteIndexEntry[]` — rejstřík, který derivace záznamu (record/derive.ts)
// stejně vyrábí a memoizuje. Rejstřík je z definice jen z PLATNÝCH hlasování,
// takže tady žádný filtr zmatečnosti není: kdo ho obchází a staví si vstup
// jinudy, musí zmatečná vyřadit sám.
//
// ── KAŽDÝ PRÁH SE POČÍTÁ (2026-08-11) ──────────────────────────────────────
// Do dneška se počítal jen práh jistoty tématu; vyloučená témata a účast
// zahazovaly kandidáty MLČKY — na ploše, jejíž celý slib je, že pravidlo je
// zkontrolovatelné. Prahy se vyhodnocují v pořadí, ve kterém jsou napsané, a
// hlasování vyřazené dřív se do dalšího počtu už nezapočítá; jinak by součty
// popisovaly překryv, ne ztrátu.
//
// The rule:
//   1. Candidates are valid (non-voided) PSP10 roll calls that carry a
//      Silver-layer theme tag, excluding the themes `procedura` and `jine`
//      (procedural motions and unclassifiable titles make poor positions),
//      with at least MIN_POSITIONAL positional ballots (pro + proti) — high
//      participation — and whose tag does NOT report a confidence below
//      MIN_TAG_CONFIDENCE (see the constant for why a MISSING confidence is
//      kept rather than dropped).
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

import type { ClubTally, VoteIndexEntry } from "../record/types";

export const QUESTIONS_CAP = 20;
export const PER_THEME_CAP = 2;
export const MIN_POSITIONAL = 120;
export const EXCLUDED_THEMES: readonly string[] = ["procedura", "jine"];

/**
 * Práh sebehlášené jistoty klasifikátoru (`vote_tag.confidence`, 0–1), pod kterým
 * hlasování do otázek nevstupuje.
 *
 * ── Proč práh vůbec je (2026-08-10) ──────────────────────────────────────────
 * Téma přiřazuje haiku (`sem_classify`, silver vrstva) a KE KAŽDÉMU tagu si zapíše
 * vlastní jistotu. Do dneška ji nikdo nečetl: špatně zařazené hlasování mohlo tiše
 * změnit, kterých ~20 hlasování reprezentuje celé období — a to je celý vstup
 * kompasu. Práh je součástí ZVEŘEJNĚNÉHO pravidla (KompasPage tiskne jeho živou
 * hodnotu i počet vyřazených kandidátů), takže je zkontrolovatelný, ne redakční.
 *
 * ── Proč chybějící jistota NEPADÁ ────────────────────────────────────────────
 * `confidence` je nullable. Tag bez jistoty netvrdí, že si klasifikátor nebyl
 * jistý — netvrdí NIC. Zahodit ho by znamenalo číst chybějící údaj jako nulu,
 * což je přesně ten převod, který si tenhle repozitář zakazuje (precedens
 * „údaj v grafu chybí“). Takový kandidát tedy zůstává a počítá se ZVLÁŠŤ
 * (`withoutConfidence`), aby čtenář viděl, na kolika otázkách práh vůbec nic
 * nerozhodl.
 */
export const MIN_TAG_CONFIDENCE = 0.7;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface SelectOptions {
  questionsCap?: number;
  perThemeCap?: number;
  minPositional?: number;
  minConfidence?: number;
  excludedThemes?: readonly string[];
}

export interface SelectedVote {
  vote: VoteIndexEntry;
  theme: string;
  total: ClubTally;
  /** |yes − no| / (yes + no), 3dp. */
  margin: number;
}

export interface SelectionResult {
  selected: SelectedVote[];
  /** Candidates that passed all floors (before the caps). */
  candidates: number;
  /** Tagged roll calls whose theme is on the excluded list (`EXCLUDED_THEMES`) —
   *  counted, so the exclusion is a stated loss rather than a silent one. */
  droppedByTheme: number;
  /** Tagged, non-excluded roll calls for which the record holds NO ballot at all:
   *  participation could not be measured, so the floor never judged them. Kept
   *  apart from `droppedByPositional` — "we have no ballots" and "too few voted"
   *  are two different statements. */
  withoutBallots: number;
  /** Would-be candidates below the participation floor (`MIN_POSITIONAL`). */
  droppedByPositional: number;
  /** Would-be candidates whose tag REPORTS a confidence below the floor — dropped
   *  and disclosed, so the floor is never a silent loss. */
  droppedByConfidence: number;
  /** Candidates whose tag reports no confidence at all: kept (a missing value is
   *  not a low value) and counted, so the reader sees where the floor decided
   *  nothing. */
  withoutConfidence: number;
}

export function selectQuestions(
  input: {
    /** The record's own per-VALID-vote index (record/types.ts) — carries the
     *  chamber tally and the club lines derive.ts already computed. Voided roll
     *  calls are absent from it by construction. */
    votes: readonly VoteIndexEntry[];
    /** Silver-layer theme per vote. */
    themeByVote: ReadonlyMap<number, string>;
    /** Classifier self-reported confidence per vote (`vote_tag.confidence`, 0–1).
     *  A vote absent from the map is treated exactly like a stored `null`. */
    confidenceByVote?: ReadonlyMap<number, number | null>;
  },
  opts: SelectOptions = {},
): SelectionResult {
  const questionsCap = opts.questionsCap ?? QUESTIONS_CAP;
  const perThemeCap = opts.perThemeCap ?? PER_THEME_CAP;
  const minPositional = opts.minPositional ?? MIN_POSITIONAL;
  const minConfidence = opts.minConfidence ?? MIN_TAG_CONFIDENCE;
  const excluded = new Set(opts.excludedThemes ?? EXCLUDED_THEMES);

  /* 1 — candidate floor */
  const byTheme = new Map<string, SelectedVote[]>();
  let candidates = 0;
  let droppedByTheme = 0;
  let withoutBallots = 0;
  let droppedByPositional = 0;
  let droppedByConfidence = 0;
  let withoutConfidence = 0;
  for (const vote of input.votes) {
    const theme = input.themeByVote.get(vote.pspId);
    // Netagované hlasování NENÍ obětí prahu — pravidlo o něm nerozhoduje, jen o něm
    // nic neví. Kolik jich je, říká `coverage.tagged`.
    if (theme === undefined) continue;
    if (excluded.has(theme)) {
      droppedByTheme++;
      continue;
    }
    const total = vote.total;
    if (!total) {
      withoutBallots++;
      continue;
    }
    const pos = total.yes + total.no;
    if (pos < minPositional) {
      droppedByPositional++;
      continue;
    }
    // Poslední práh SCHVÁLNĚ: `droppedByConfidence` má být počet kandidátů, které
    // vzala jistota — ne směs s hlasováními, která stejně neprošla účastí.
    const confidence = input.confidenceByVote?.get(vote.pspId) ?? null;
    if (confidence === null || !Number.isFinite(confidence)) {
      withoutConfidence++;
    } else if (confidence < minConfidence) {
      droppedByConfidence++;
      continue;
    }
    candidates++;
    const margin = round3(Math.abs(total.yes - total.no) / pos);
    let list = byTheme.get(theme);
    if (!list) {
      list = [];
      byTheme.set(theme, list);
    }
    list.push({ vote, theme, total, margin });
  }

  /* 2 — per-theme rank: margin asc, positional desc, newest, higher id */
  for (const list of byTheme.values()) {
    list.sort(
      (a, b) =>
        a.margin - b.margin ||
        b.total.yes + b.total.no - (a.total.yes + a.total.no) ||
        (b.vote.votedOn ?? "").localeCompare(a.vote.votedOn ?? "") ||
        b.vote.pspId - a.vote.pspId,
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
  return {
    selected,
    candidates,
    droppedByTheme,
    withoutBallots,
    droppedByPositional,
    droppedByConfidence,
    withoutConfidence,
  };
}
