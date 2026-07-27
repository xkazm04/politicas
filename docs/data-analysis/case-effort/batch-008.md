# Batch 008 — the role signals: first staleness-triggered batch on the pass-34/35 data (2026-07-27)

*Case ② Effort · solo mode (operator-directed) · population unchanged at 207/207 — this batch works
the NEW signal layer, not new units.*

Passes 34/35 (operator-directed build, outside the loop) gave the graph the role semantics the
effort↔law join was missing: signature rank on `sponsors` edges, `rapporteur` edges (148),
`spoke_on` per-bill floor speeches (891 / 3 048 turns), `proposes_amendment` authorship (172 pairs /
444 amendments), bill fates. That is precisely the staleness trigger batch-006 steering reserved
re-opening for. Batch 008 = triage the new lenses → 16-unit army → gate → two-layer verification →
persist (pass 37) → build.

## 1. Triage (deterministic, `roles-triage.ts`)

All lenses validated for discriminative power before ranking (kernel guardrail); only
`spoke_on_any` (80.7 %) is degenerate and was used as context, never ranking:

| lens | fires | note |
|---|---|---|
| signature_farming (authored ≥3, first-signed 0) | 52/207 (25.1 %) | batch-001's hand observation (Haas/Šťastný/Vesecká) now systematic |
| rapporteur_any / ≥3 | 79 / 18 | the assigned-analytical-work lens the index cannot see |
| amendments_any / ≥10 | 86 / 10 | top: Jurečka 40, Haas 22, Ožanová 21 |
| own_bill_not_defended | 39 | NOT trusted as ranked signal — fires on bills that never reached floor debate; needs an others-debated-it refinement before use |

Army: 16 units — 8 rapporteur workhorses (Ožanová, M. Novák, Pařil, Babka, Demetrashvili,
Vondráček, Benda, Pospíšil) + 6 heavy amenders (Jurečka, Haas, Richterová, Kovářová, Sedmihradská,
Urbanová) + 2 signature-split tops (T. Okamura, Kršková — strictly neutral framing mandated).

## 2. Army + merge (4 Sonnet groups × 4, append-only enforced IN CODE)

The P53 lesson ("a rewrite pass silently strengthens claims") got an executable form this batch:
`merge-batch-008.ts` verifies every proposal's `effort_bill_focus`/`effort_analyst_note` **starts
with the pre-batch text verbatim** — one violation caught mechanically (Okamura's analyst note:
quote-glyph normalization `\"` → `“`, i.e. a non-verbatim copy invisible to eyeball review),
repaired by splicing the true prior with the agent's suffix. Gate: **16/16 PASS, 0 DROP**, 35
Q-effort-11 soft warnings.

## 3. The verification pass caught what the gate cannot (Opus, skeptical mandate)

Adjudicated every warning by re-deriving each numeral from the inputs: **35 valid subset framings,
2 ambiguous, 2 wrong** — plus defect classes no numeric gate sees. 3 CONFIRMED (M. Novák, Pařil,
Babka); 12 NEEDS_CORRECTION; **1 BLOCKING**:

- **Okamura (BLOCKING, neutrality)**: the army added exculpatory motive framing („spolupodepisování
  je běžnou praxí … strukturálně očekávaná") to HIS 10/10 co-signature split while giving Kršková,
  the identical case, no such cushion — plus an SPD-club-chair claim contradicting the unit's own
  public-role data, backed by a bare roster URL. Framing deleted, claim + citation dropped; both
  units now carry the same neutral sentence.
- **2 WRONG numerals (Benda)**: "jedenácti tisky" (the data has twelve) and 51 turns presented as
  distributed across them (per-bill turns sum to 25; the other 26 are not bill-attributed). His
  analyst note asserted a sum-check it never performed — the false-self-verification class.
- **2 WRONG attributions (Urbanová, Kršková)**: „k těmto tiskům podala X návrhů" pointing at their
  OWN bills when every amendment went to other prints — counts right, referent false.
- **Scope-translation**: two groups rendered `zpravodaj_ov` as „zpravodaj pro 1. čtení" (an
  interpretation the scope does not carry, twice on bills already in the Senate) while the other
  two groups correctly wrote „zpravodaj určený organizačním výborem" — the same code became two
  different public claims inside one batch (P55 across proposals).
- **Sample-scoped superlatives in 8/16** („nejaktivnější řečník ze skupiny", „v tomto přehledu") —
  payload-scoped claims a reader cannot check. See §5: converted to CODE.
- **1 pre-existing bill-number error surfaced by cross-referencing units** (Richterová's prior text
  cited tisk 156; her data + the Demetrashvili unit prove it is tisk 49) — corrected as a
  sanctioned prior-text fix, the only one this batch.

All fixes applied via `apply-batch-008-fixes.ts` — every replacement asserted to match exactly once
(batch-005 lesson: driver-applied fixes need checkable outcomes). Two sentence-surgery artifacts
(fragments orphaned by periods inside „č." abbreviations) found by a residue scan and removed.
Re-gated 16/16 PASS; persisted pass 37 (props-merge, citations threaded); `finalize-ledger.ts 8`.

## 4. Manifestation check

On a fresh copy after persist: all 16 nodes carry the pass-37 fields, **0 withheld** by the render
guard, 16/16 carry `effort_citations`. The batch's numbers render on `/poslanec` (dossier section)
and the same role data feeds `/zakony` (pass-34/35 surfaces).

## 5. Q-effort-16 (new): the sample-scoped-superlative rule + its 29-instance debt

The verifier's systemic finding became code: `PIPELINE_JARGON` gains a `sample-scoped
self-reference` rule („ze svého vzorku", superlative + „ze skupiny", „v této skupině", „v tomto
přehledu"), kept deliberately narrow so ordinary Czech („návrh skupiny poslanců") never trips —
negative tests included. Measured against the live graph: **29 pre-existing field-instances on 28
nodes** (batches 001–007 prose) now withhold at render until rewritten — honest degradation, same
mechanism as Q-effort-15, recorded as open debt (a scoped mechanical rewrite pass, est. one small
army group).

## 6. Build (R=1)

**„Zpravodajský tahoun" badge on `/zebricek`** — deterministic `effort_rapporteur_load` on all 207
(pass 36; 79 nonzero, 18 ≥ 3), pure copy module `lib/analysis/rapporteur-load.ts` (+2 tests),
`RapporteurBadge.tsx` wired into `LeaderboardTable`. Deliberately NOT a third quiet-workhorse
flavour — rapporteur load says nothing about floor visibility (Ožanová is both the most-loaded
zpravodajka and a top speaker); the copy says count, not quality.

## 7. Signals (mean 0.60 over 16 — up from 0.405 in batch 006; new-lens composition, not drift)

Top: Ožanová 0.9 (triple workhorse: 5 rapporteur bills + 21 amendments + 183 floor turns), M. Novák
0.8, Pařil 0.8 (incl. a rapporteur bill already vyhlášen as 63/2026 Sb.), Haas 0.85. The
signature-split units honestly carry the lowest signals (Okamura 0.4, Kršková 0.35) — the split is
a fact, not a story, and the batch treats it symmetrically.
