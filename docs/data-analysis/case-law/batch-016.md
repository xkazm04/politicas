# Case ③ Law loop — batch 016 (2026-08-05)

Solo run. Army: 3 Sonnet verdict groups, 1 Sonnet polish agent, 1 fresh Opus auditor (three
rounds); closure gated the pass-50 write throughout.

**The pass in one line:** ten more verdicts (two surviving mediums, both re-earned the hard
way), the amended-§ census landed as a correctly-humbled artifact (its cross-check first
pointed the wrong way and the audit inverted it), the dependency view got real tests and raw-
identity dedupe — and the audit named the batch's new failure class: **accusation by omission**
(three „the DZ never mentions X" claims where the DZ discusses X at length).

## Verdicts — 10 (pass 50, coverage 89/141; 2 medium / 8 low after the cycle)

- **tisk 228** (medium/4): the registries bill extends the Police Act §66 odst. 2 evidence
  list to the new pupil/staff registries (the automation question honestly left open — the
  text does not say), and a 170,6 mil unfunded municipal mandate sits inside a
  budget-neutral-for-business frame.
- **tisk 162** (medium/3): re-earned on the audit's own gift — the bill's čl. II bod 2 cites
  §198 odst. 2 for the jistota while the institute lives in odst. 3 (the bill cites it
  correctly elsewhere): an internal cross-reference defect in the bill itself.
- Honest demotions: 46 (its two effects were refuted — the DZ has a dedicated §65a section;
  the rebuilt privacy-chapter finding is genuinely unstated but low), 214 (the immunity
  inversion is real but its false „unstated" premise fell; the rebuilt finding — no
  transitional provision for previously-denied prosecutions — was verified truly unstated).
- Honest negatives held: 186 is NOT a RUD bill (the family framing my own brief suggested —
  the agent verified and refused it); 88's two published collisions with 85 now stated
  accurately, incl. the one it had silently omitted.

## The audit cycle — three rounds

Round 1: NOT READY, 10 blocking + 17 major — the accusation-by-omission class (three false
„DZ nezmiňuje" effects), the evidence-contract split (six effects on medium verdicts published
with NO visible source because the render layer showed only URL-form evidence), reintroduced
jargon (pspId ×15, payload, steward…), and the census cross-check MISLABELED (the audit
hand-verified 9/9 disagreements in the GRAPH's favour — the „leads" were this extractor's own
limits). Round 2: narrow reopen (an odst. 3/4 slip in a fix; one missing money disclosure).
Round 3: CLOSED — with the money rule verified holding on all 5 money-rendering verdicts, a
first.

**Structural yields:**
- `BillDetail` renders textual evidence sentences (new `forensic.evidenceLabel`, both locales)
  — the URL-only branch can no longer silently publish unsourced effects.
- The detector grew again (pspId/payload/steward/cache/…) and its widening retroactively
  exposed **21 strings on live batches 011–015** — swept the same session (pass 50, digit+
  syntax invariants), render back to **89 blocks · 0 withheld**. The auditor's carried note
  stands: three batches, three new token classes — the literal list wants a structural rule
  (batch-017 item).
- The ASCII-`\b`-before-Czech-letters bug recurred a THIRD time, inside the sweep's own new
  rules — caught by the sweep's own re-gate throw, which is the guard doing its job.

## The amended-§ census (P4) — corrected, then valuable

141/141 bills, **3 166 operative bill→§ pairs** — the §-level basis the sector-adjacency
rework has needed since batch-004. The first release framed graph/text disagreements as graph
leads; the audit measured the opposite (graph right 9/9 on this batch's bills) and the payload
now carries the direction of trust explicitly: disagreements are EXTRACTOR DIAGNOSTICS
(48 bills with missed refs — dominated by the ČÁST-header single-bucket collapse — and 5 with
extra refs), and per-§ rows are trustworthy exactly where a bill's diagnostics are clean.

## Dependency view (P3) — tested and honest

Pure `buildDependencyView` extraction; dedupe on RAW pre-gate identity (a gate-nulled subject
can no longer collapse distinct companions); `weakEvidence` on the raw subject (a hedge past
the truncation point still detected); the promised misalignment drop-guard implemented and
disclosed (`misalignedDroppedCount`, 0 today); representative-row selection on raw lengths,
proven by a fixture that ties post-truncation. 57/57 tests. Surface: 10 bills · 10 rows ·
0 withheld · 0 dropped.

## Carried to batch-017

- The structural jargon rule (end the token-class whack-a-mole).
- N4 recommendation: anchor evidence to the bill's own structural coordinate (Čl./bod/DZ
  chapter) over transcript line numbers; keep line numbers non-rendered.
- `partitionFallback` flag on census rows (name the collapse per row).
- 52 bills pending verdicts; the §-level sector attribution can NOW be built on the census.

## Metrics

| | |
|---|---|
| units | 10 verdicts + 21-string retroactive sweep + 5-string residual sweep + census (141) + view polish |
| verdicts total | 79 → **89** (2 medium / 8 low new; mediums 18 of 89) |
| census | 3 166 operative bill→§ pairs; diagnostics honestly labeled |
| render withholds | 0 → 21 (detector widening) → **0** (swept same session) |
| audit rounds | 3 (NOT READY 10B/17M → REOPENED 2M → CLOSED); money rule 5/5 for the first time |
| graph writes | pass 50: 10 verdicts + 4 + 17 swept nodes |

## Files

New: `scripts/case-loops/law/{prepare-batch-016,amended-paragraph-census-016}.ts`,
`features/lawwatch/buildDependencyView.ts` + `getDependencyData.test.ts`,
`payloads/{batch-016-targets,batch-016-old27-jargon,batch-016-old27-sweep,batch-016-jargon-all,batch-016-jargon-all-sweep,batch-016-amended-paragraph-census,batch-016-verdicts-combined}.json`,
`payloads/verdicts-016/` (10), `batch-016-audit.md`, this note.
Modified: `lib/analysis/law-verdict.ts` (detector classes ×2), `features/lawwatch/components/BillDetail.tsx`
(textual evidence rendering), `messages/{cs,en}.json` (evidenceLabel),
`getDependencyData.ts` + `DependencyRadar.tsx`, `extract-old27-jargon-015.ts` (--all/--out),
`sweep-old27-015.ts` (rules + usage), `provenance-probe.ts` (pass-50 expectations),
`ledger.json`, `graph-log.md` (pass 50).
