# Batch 010 — the correction reached the numbers, not the prose (2026-08-04)

*Case ② Effort · solo mode · population unchanged (207/207) · staleness-triggered.*

The trigger is commit `f5e22b4`: the **pass-42 committee-dedupe correction was applied to the
store** on 2026-08-04 (the formula changed 2026-07-29; the data followed six days later).
`committee_count` stopped counting psp.cz membership ROWS and started counting DISTINCT
BODIES, because psp.cz files a body an MP LEADS as two rows. **41 MPs' committee counts and
33 MPs' scores moved.**

Every dossier in batches 001–009 was written while the analyst was reading the OLD numbers.
Nothing in the repo could see that. This batch measures the damage and repairs it.

## What was found

| class | measured | reader-facing | fixed |
|---|---|---|---|
| prose naming the wrong committee count | 15 survivors, **14 real** | 14 | 14 |
| prose quoting a superseded score | **16** on 16 MPs | 7 | 7 |
| claims *inverted* by the correction | 2 | 2 | 2 |

**The finding that matters is not the count — it is who found the bug first.** Nine of the
fourteen committee sentences are an analyst flagging a „datová nesrovnalost": the stored
count exceeded the committee list they could see, and they said so in the published dossier.
Nine independent Sonnet agents, across batches 001–006, observed the double-filing defect
from the outside and wrote it into prose as a caveat — and the loop had no mechanism to turn
a caveat repeated on nine units into a population-level signal. The formula was eventually
corrected from somewhere else entirely, and those nine warnings then became stale warnings
about a bug that no longer existed.

Two claims did not merely lose a number, they **reversed**:
- **Dražilová** — „zůstává nad klubovým průměrem" is false at the corrected score (60,4 vs an
  ANO2011 mean of 60,8), and a decline of 70,8 → 60,4 is no longer „mírný".
- **Oulehlová** — „pozitivní trend … skóre vzrostlo" ran backwards: her corrected 71,3 is
  BELOW the prior term's 72,9.

A numeral swap alone would have left both sentences fluent and wrong.

## Mechanics

- **Both defect classes were measured against a real before-state**, not inferred: the
  `.pglite-backup-pass11` store still held the pre-correction values, so every delta is a
  diff of two stores rather than a reconstruction.
- **Guard validation, the kernel way.** The committee scan fired **59** times on its first
  draft; hand-reading every hit found four distinct category errors (subcommittees — the
  PSP10 ingest holds 0 such membership rows; „6 stále ve výborech" = six BILLS; the partitive
  „jeden ze šesti výborů"; cross-term PSP9 sentences). Tightened to **15**, all hand-read:
  **14 real, 1 false positive** (a sentence inside Nerušil's dossier about a different
  person) — a 6,7 % residual rate, recorded rather than tuned away.
- **The score lens was retired for the wrong reason and had to be rebuilt.** Its first
  version matched „N bodu", fired 6 times, all false — and was retired as noise. That
  measured the PATTERN, not the corpus: the army writes „skóre z trojice (90,5)", not „90,5
  bodu". Matching the VALUE near a score cue found **16 real citations**. *A lens that fires
  zero times has not proven the corpus clean; it has proven the lens blind, and nothing
  distinguishes the two without reading the corpus.* Two further real hits were missed until
  a sentence comma stopped being read as a decimal comma.
- **Army**: 3 Sonnet groups × 5/5/4 for the committee sentences (27 → de-scope the resolved
  caveat and state the fact from the body list; or correct the numeral), then 1 group of 7
  for the scores. The score numerals were swapped **deterministically before the analyst saw
  the text** — code owns the number, the analyst adjudicates only the CLAIM around it, with
  the corrected club mean and prior-term score supplied as facts.
- **Minimal-diff proof at merge** (batch 009's mechanic, extended): non-declared sentences
  byte-identical, offending sentences gone, zero contradicting claims against the corrected
  props, no NEWLY introduced jargon (measured as a delta, so pre-existing residue does not
  block a correction), bounded sentence count and growth. **21/21 accepted.** The proof did
  its job twice: it rejected a 254-character overshoot (trimmed by the driver, reusing the
  dossier's own „ÚZSI" abbreviation — no fact changed), and it initially rejected 2 correct
  rewrites for declaring sub-sentence fragments, which is a *tighter* edit than a whole
  sentence — the proof was wrong there and was corrected.
- **Independent re-verification of pass 42 itself**: recomputing distinct bodies from the
  membership rows reproduced the stored `committee_count` for **15/15** contested MPs.
- Gate **14/14** and **7/7** PASS. Persisted as **pass 43** (props-merge, 21 nodes).

## Verified on the live store after persist

- committee claims contradicting the graph: **15 → 1** (the adjudicated false positive), and
  **0** still matching the pre-correction value.
- stale score citations: **16 → 9**, and **0 on any rendered field**. The 9 that remain are
  internal (`effort_psp9_trend_note` ×7, `effort_analyst_note` ×2), which the profile page
  and /zebricek do not render. Recorded as debt below — not silently dropped.

## The durable fix

Three guards, none of them prose:

1. **`lib/analysis/committee-claims.ts`** (+ tests) — the committee noun group the
   Q-effort-11 gate never had. `gate.ts` IMPORTS it; the batch scan imports the same
   function. This loop has twice shipped a defect because a script forked a shared rule
   (gate.ts vs public-copy.ts; kg-compute.ts vs contribution.ts), so there is one definition.
2. **`lib/analysis/score-citations.ts`** (+ tests) — value-targeted score citation search.
3. **The check that actually matters lives in `kg-contribution-recompute.ts`.** A gate sees
   only the after-state, so it cannot ask "does this prose quote a score that is no longer
   real". The recompute holds both values by construction. It now reports every dossier field
   quoting a score it supersedes, and says plainly that the numeral may sit inside a claim the
   new value can break. **A future contribution correction cannot silently invalidate prose
   again.**

A fourth guard was built, measured, and **deliberately not shipped**: a gate-side "is this
score-shaped number one the graph still carries" lens fired **66 times across all 765 prose
fields** with almost no real hits (prior-term scores, „1 vedoucí post", the 9 inside „PSP9").
A guard nobody trusts is worse than none. Its absence is documented in the module.

## Lesson

**A recompute is not finished when the numbers are right.** Pass 42 was exemplary as a data
correction — it replayed the old formula and refused to write unless it reproduced every
stored value first — and it still shipped a product defect, because the prose that quotes a
number is not part of the number's own consistency check. Anything that DERIVES a value must
also ask what already SAYS that value.

And the sharper one: **the army had already found this bug.** Nine dossiers described it in
plain Czech, one unit at a time, and the loop had no path from "many units flagged the same
anomaly" to "the formula is wrong". Per-unit caveats need to aggregate, or the analysis
notices what the pipeline cannot.
