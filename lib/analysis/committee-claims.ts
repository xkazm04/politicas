/**
 * Czech prose claims about how many committees an MP sits in.
 *
 * WHY THIS EXISTS. Graph pass 42 corrected `committee_count` from psp.cz membership
 * ROWS to DISTINCT BODIES (psp.cz files a body an MP leads twice — a „člen" row plus a
 * „function" row). 33 MPs' scores moved. But the correction could not see the ~765
 * analyst-written prose fields that had already quoted the OLD number, and the effort
 * loop's existing prose-vs-props gate (`scripts/case-loops/effort/gate.ts`,
 * Q-effort-11) covers bills / interpellations / speeches / tenure — it has no committee
 * noun group, so it was structurally blind to exactly the class the correction created.
 * Batch 010 found 14 stale sentences on 14 MPs this way.
 *
 * It lives in `lib/analysis/` rather than in the batch script because the gate and the
 * batch scan must share ONE definition. The two previous times this loop forked a
 * shared rule into a script (gate.ts vs public-copy.ts's jargon rules; kg-compute.ts vs
 * contribution.ts's committee predicate) the copies silently diverged and shipped a
 * defect. Import this; do not re-implement it.
 *
 * DELIBERATE SCOPE — validated by hand-reading every hit, not by intuition. The first
 * draft fired 59 times across the corpus and 44 of those were category errors. Each
 * exclusion below removes a class that was READ and understood:
 *
 *  · `podvýbor` is excluded. It IS in COMMITTEE_ORGAN_TYPES, but the PSP10 ingest holds
 *    ZERO subcommittee membership rows (Výbor 512 · Komise 257 · Delegace 86 ·
 *    Podvýbor 0), so a „sedmi podvýborů" sentence is sourced from psp.cz directly and is
 *    not a claim about this prop at all. 7 false hits.
 *  · A preposition or adverb between the numeral and the noun breaks the binding:
 *    „6 stále ve výborech" is six BILLS still sitting in committees. 1 false hit.
 *  · A partitive („jeden ze šesti výborů") binds the numeral to the SET, not to the
 *    MP's own seats. 1 false hit.
 *  · Czech negation („ani v jednom výboru") inverts the numeral — the same trap
 *    gate.ts's numeric extractor hit in batch 005.
 *  · `komise` and `delegace` need no separate group: they ARE counted by
 *    committee_count, and prose that cites them says „výborů a komisí", which this
 *    pattern catches on its „výbor" head.
 *
 * Residual false-positive rate after all of it: 1 in 15 (a sentence about a DIFFERENT
 * person quoted inside an MP's dossier). A caller must still read what it reports —
 * this returns CLAIMS, not verdicts.
 */

/** Spelled-out Czech numerals in the range committee counts actually occupy. */
const CZECH_NUM_WORDS: Record<string, number> = {
  jednoho: 1, jednom: 1, jeden: 1, jedna: 1, jedné: 1, jednu: 1,
  dva: 2, dvou: 2, dvě: 2, dvěma: 2,
  tři: 3, tří: 3, třech: 3, třemi: 3,
  čtyři: 4, čtyř: 4, čtyřech: 4,
  pět: 5, pěti: 5,
  šest: 6, šesti: 6,
  sedm: 7, sedmi: 7,
  osm: 8, osmi: 8,
  devět: 9, devíti: 9,
  deset: 10, deseti: 10,
};

/** „výbor" in any case — and NOT „podvýbor", which the caller-facing doc explains.
 *  Word boundaries use \p{L} lookaround: plain \b is ASCII-only in JS, so it silently
 *  fails to bound words carrying Czech diacritics. */
const COMMITTEE_HEAD = /^výbor(?:u|y|ů|ech|em|a)?$/iu;

/** Words which, between the numeral and „výbor", prove the numeral counts something else. */
const GAP_BREAKS_BINDING = /(?<![\p{L}])(?:ve?|na|do|ze?|o|u|se|stále|dosud|pouze|jen|už|již)(?![\p{L}])/iu;

/** „ani v jednom výboru" / „v žádném výboru" — a negation, not a count of 1. */
const NEGATION_BEFORE = /(ani|žádn[\p{L}]*)\s*(v\s+|ve\s+|u\s+)?$/iu;

/** „jeden ze šesti výborů" — the numeral describes the SET, not the MP's seats. */
const PARTITIVE_BEFORE = /(?<![\p{L}])(?:jeden|jedním|jedna|jednou|jedné)\s+(?:ze?)\s*$/iu;

/** An upper bound above which a numeral before „výbor" is a year or a tisk number.
 *  The largest real PSP10 committee_count is well under this. */
const MAX_PLAUSIBLE_COUNT = 20;

export interface CommitteeClaim {
  /** How many committees the sentence claims. */
  count: number;
  /** The matched text, verbatim. */
  raw: string;
  /** Character offset of the match in the scanned text. */
  index: number;
  /** Surrounding text, for a human to adjudicate the claim. */
  window: string;
}

/**
 * Extract „<number> výborů"-shaped claims from Czech analyst prose.
 *
 * Returns every claim it can bind; it does NOT decide whether a claim is about the MP
 * whose dossier this is (a dossier may quote a sentence about someone else). Callers
 * compare against `committee_count` and surface a WARNING for a human, never a hard drop.
 */
export function extractCommitteeClaims(text: string): CommitteeClaim[] {
  const claims: CommitteeClaim[] = [];
  const push = (count: number, raw: string, index: number) => {
    claims.push({
      count,
      raw: raw.trim(),
      index,
      window: text.slice(Math.max(0, index - 70), Math.min(text.length, index + 90)).replace(/\s+/g, " "),
    });
  };

  // Arabic numerals: „2 výbory", „ve 2 sněmovních výborech"
  const arabicRe = /(\d+)((?:\s+[a-záčďéěíňóřšťúůýž]+){0,2}\s+)(?:pod)?(výbor[a-záčďéěíňóřšťúůýž]*)/giu;
  let m: RegExpExecArray | null;
  while ((m = arabicRe.exec(text))) {
    const n = Number(m[1]);
    if (n > MAX_PLAUSIBLE_COUNT) continue;
    if (/pod výbor|podvýbor/iu.test(m[0])) continue;
    if (GAP_BREAKS_BINDING.test(m[2])) continue;
    if (COMMITTEE_HEAD.test(m[3])) push(n, m[0], m.index);
  }

  // Spelled-out numerals: „ve dvou výborech", „ve třech sněmovních výborech"
  const spelledRe = new RegExp(
    `(?<![\\p{L}])(${Object.keys(CZECH_NUM_WORDS).join("|")})((?:\\s+[a-záčďéěíňóřšťúůýž]+){0,2}\\s+)(?:pod)?(výbor[a-záčďéěíňóřšťúůýž]*)`,
    "giu",
  );
  while ((m = spelledRe.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    if (NEGATION_BEFORE.test(before)) continue;
    if (PARTITIVE_BEFORE.test(before)) continue;
    if (/podvýbor/iu.test(m[0])) continue;
    if (GAP_BREAKS_BINDING.test(m[2])) continue;
    if (COMMITTEE_HEAD.test(m[3])) push(CZECH_NUM_WORDS[m[1].toLowerCase()], m[0], m.index);
  }

  return claims.sort((a, b) => a.index - b.index);
}

/**
 * Fields whose committee counts describe a DIFFERENT electoral term and are therefore
 * never comparable to this term's `committee_count`. `effort_psp9_trend_note` compares
 * PSP9 against PSP10 in one sentence, so both of its numbers would false-positive.
 */
export const CROSS_TERM_PROSE_FIELDS: readonly string[] = ["effort_psp9_trend_note"];

/**
 * Compare prose claims against the deterministic prop. Returns one WARNING line per
 * contradicted claim — a soft signal for a reviewer, matching the Q-effort-11 contract
 * (prose can legitimately describe a subset, or quote another person).
 */
export function committeeClaimWarnings(
  label: string,
  field: string,
  text: string,
  committeeCount: number | null | undefined,
): string[] {
  if (CROSS_TERM_PROSE_FIELDS.includes(field)) return [];
  if (typeof committeeCount !== "number") return [];
  return extractCommitteeClaims(text)
    .filter((c) => c.count !== committeeCount)
    .map((c) => `${label} — ${field} claims "${c.raw}" (${c.count} committees) but graph committee_count=${committeeCount} :: …${c.window}…`);
}
