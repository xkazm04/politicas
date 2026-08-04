/**
 * Czech prose citations of an MP's contribution SCORE.
 *
 * WHY THIS EXISTS, and why its first version was wrong. Batch 010 built a scan for prose
 * that pass 42 had made stale. Its score lens matched only „N bodu" — the shape a score
 * citation OUGHT to take — found 6 hits, hand-read all 6 as false (a prior-term score, a
 * point delta, a component's own points), and retired the lens as 100 % noise.
 *
 * That was a measurement of the PATTERN, not of the corpus. The analyst army does not
 * write „90,5 bodu"; it writes „Nejvyšší kontribuční skóre z trojice (90,5)" and „Skóre
 * vzrostlo z 66 na 80,5" — a bare decimal in parentheses or after „skóre". Matching THAT
 * found **16 stale citations on 16 of the 33 MPs whose score moved**. A lens that fires
 * zero times has not proven the corpus clean; it has proven the lens blind, and the two
 * are indistinguishable without reading the corpus itself.
 *
 * So this module matches the score by its VALUE in context, not by a unit word: a Czech
 * decimal adjacent to a score-bearing cue („skóre", „index", „bodů"), or inside a
 * parenthetical directly following one. Callers pass the value to look for.
 */

/** Czech decimal notation: „90,5", „60", „92,6". */
const DECIMAL = String.raw`\d{1,3}(?:,\d)?`;

/** Words that mark a nearby number as a contribution score rather than a count. */
const SCORE_CUE = /(?:skóre|skóru|indexu?|index|bodů|bodu|body)/iu;

export interface ScoreCitation {
  /** The value as written, normalised to a JS number (comma → dot). */
  value: number;
  /** The matched numeral, verbatim as it appears. */
  raw: string;
  index: number;
  window: string;
}

/**
 * Find prose citations of a SPECIFIC score value.
 *
 * Deliberately value-targeted rather than "find all scores": the caller knows which
 * number went stale, and asking "is this exact number quoted here" is a presence check —
 * deterministic and strong — instead of a classification problem the prose does not
 * give enough signal to solve (P49: presence claims verify by search, not by a model).
 *
 * A numeral only counts when a score cue appears within `proximity` characters before
 * it, so „6 tisků" and „48 vystoupení" can never match, and a bare „(90,5)" matches only
 * when the sentence has already said „skóre".
 */
export function findScoreCitations(text: string, value: number, proximity = 90): ScoreCitation[] {
  const written = String(value).replace(".", ",");
  // An integer score may be written „63" or „63,0" — both are the same number and both
  // occur in the corpus, so an integer target accepts the explicit tenth.
  const body = Number.isInteger(value) ? `${written}(?:,0)?` : written;
  // Boundaries: not part of a longer number. „85,4" must not match inside „185,42" and
  // „60" must not match inside „160" or „60,4".
  //
  // The trailing guard must reject a comma only when a DIGIT follows it. An earlier
  // version rejected any following comma and so missed „…vzrostlo na 77,9, což ukazuje…"
  // — a sentence comma read as a decimal one. That silently dropped 2 of 16 real hits,
  // the same class of blindness this whole module exists to document.
  // A comma needs no escape, and `\,` is an *invalid* escape under the `u` flag.
  const re = new RegExp(`(?<![\\d,])${body}(?!\\d)(?!,\\d)`, "gu");
  const out: ScoreCitation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - proximity), m.index);
    if (!SCORE_CUE.test(before)) continue;
    out.push({
      value,
      raw: m[0],
      index: m.index,
      window: text.slice(Math.max(0, m.index - 140), Math.min(text.length, m.index + 140)).replace(/\s+/g, " "),
    });
  }
  return out;
}

/**
 * Warn when prose quotes a score the graph no longer carries.
 *
 * Soft-fail, like every prose-vs-props check in this loop: a sentence may legitimately
 * quote a PRIOR-TERM score or another MP's score, so this reports for a human and never
 * drops. Pass `previousValue` (the pre-correction number) to detect the specific,
 * high-confidence case where the prose still carries exactly the superseded value.
 */
export function staleScoreWarnings(
  label: string,
  field: string,
  text: string,
  previousValue: number | null | undefined,
  currentValue: number | null | undefined,
): string[] {
  if (typeof previousValue !== "number" || typeof currentValue !== "number") return [];
  if (previousValue === currentValue) return [];
  return findScoreCitations(text, previousValue).map(
    (c) => `${label} — ${field} quotes the superseded score ${c.raw} (now ${String(currentValue).replace(".", ",")}) :: …${c.window}…`,
  );
}

/** Regex source for a Czech decimal, exported so callers need not re-invent it. */
export const CZECH_DECIMAL_PATTERN = DECIMAL;

// NOT PROVIDED, on purpose: a "find every score-shaped number and flag the ones the
// graph does not carry" variant, for callers that hold only the CURRENT value (a gate).
// It was built and measured over all 765 prose fields in the corpus: 66 fires, almost
// none real — prior-term scores, „1 vedoucí post", the 9 inside „PSP9". Tightening the
// proximity window and excluding counted nouns cut it, but not to a rate worth a
// reviewer's attention, and a guard nobody trusts is worse than none.
//
// The lesson generalises: this check is only strong when the caller knows what the value
// USED TO BE, so it belongs to whatever performs the recompute — which holds both
// numbers by construction — and not to a gate that sees only the after state.
// See scripts/data-analysis/kg-contribution-recompute.ts.
