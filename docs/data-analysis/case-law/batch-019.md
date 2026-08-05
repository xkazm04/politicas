# Batch 019 — verdict wave 5/15/49/235/57/163/238/219/59/243 · summary-source migration · verdict-106 correction (pass 53)

Date: 2026-08-05. Driver + 3 Sonnet verdict groups + fresh Opus auditor (three rounds).
Coverage after this batch: **119/141 bills carry a gated verdict** (4 medium / 6 low this
batch). Store writes: pass 53 = 10 verdicts + 140 `summary_source` props re-anchored to
psp.cz print URLs + the verdict-106 range correction (9e–9m → 9e–9n, one field, stamped
`range_correction`). Backup: `.pglite-backup-20260805-pass53`. Probe EXPECT: `withF: 119`,
passes `…,52,53`.

## Verdicts — 10 (4 medium / 6 low)

- **235 (medium).** The successor question to pass-52's tisk 70: it is NOT the wider
  predictor reform tisk 70's DZ promised — it raises the state-insuree payment base
  instead, expressly calling zákon č. 71/2026 Sb. „pouhým nouzovým řešením pro letošní
  rok", while FREEZING through 2028 the valorization mechanism its own DZ praises as
  politically independent, committing ~21 mld. Kč with no RIA and no comment round.
- **163 (medium).** Government fuel-price-control power: the government rejected the
  opposition's excise cut (tisk 133, pass 52) one day after signing its own bill on the
  same Iran-shock premise, neither referencing the other; the instrument loses both
  advance transparency (e-Legislativa bypass) and direct administrative-court review
  while the DZ claims better public control.
- **219 (medium).** Mistrovská zkouška: the chambers organize the exam, propose its
  rules, and keep the fee revenue (§ 18 odst. 3) — a self-regulation shape the DZ's
  corruption assessment never addresses (it considers only exam fraud).
- **59 (medium).** Integrační sociální podnik: a new anti-avoidance § 17 odst. 5 the
  zvláštní část does not interpret at all, and a transitional clause releasing the
  previously earmarked fund into general equity, uncommented in the impact assessment.
- **Lows**: 15 (jednací řád — DEMOTED from medium at audit: the July-2026 vote evidence
  could not be tied to a different print and was dropped; what remains is the dated,
  citation-covered timing record), 57 (the corpus's first documented COORDINATION
  success: its DZ renumbered its own § 53b → § 53a so tisk 153's „Program pro pacienty"
  keeps § 53b — the deliberate inverse of the 106↔107 collision), 238 (tells one story
  with published verdict-78; senator data-gap formula), 243 (Hladík's ties class-perfect:
  Teplárny attributed, four steward institutions never), 49 (EIA extension exception —
  the category-based drafting reaches far beyond the one Prague project the DZ justifies
  urgency with; Hřib's institutional link disclosed with its single-source dating), 5
  (ZOHS call-in: the § 20d carve-out shields regulated sectors while digital markets
  stay exposed).

## The audit cycle — and the field-parallelism lesson

Round 1: **4 BLOCKING / 7 MAJOR** — two quote defects in 235 (a re-inflected quotation
presented as verbatim; a mid-quote splice deleting the grammatical subject), a quotation
imported from ANOTHER BILL's print in 57 (attributed to tisk 57, lives in tisk 235 —
and substantively wrong: a chair's decision is not a submitter's request), and a NEW
sweep-corruption class: the graph node id printed as the sněmovní tisk number in three
verdict openings („sněmovní tisk 43122" for tisk 15). Round 2 caught the remediation's
own systematic gap: **fixes applied to `unstatedEffects`/`citations` but not to the
parallel prose in `researchedContext`** left four verdicts self-contradicting — and
verdict-15's July-2026 paragraph stranded WITHOUT its deleted citation (strictly worse
than before the fix). Round 3: CLOSED; the last enumeration inconsistency (59's
odstavec numbering) aligned across all three fields before the write.

**The rule this batch adds:** a remediation edit is not done until every FIELD carrying
the same claim is edited — effects, citations, researchedContext, conflictAssessment.
The auditor's grep does not care which field a stale claim survives in.

## Artifacts

- `payloads/verdicts-019/…` + `batch-019-verdicts-combined.json` (10 verdicts).
- `payloads/bill-summaries-cz.json` — regenerated: `source` = psp.cz print URL on all
  141 rows (was: local cache path — batch-018 M20); summaries byte-identical.
- `scripts/case-loops/law/build-bill-summaries.ts` — emits URLs at the source.
- `scripts/case-loops/law/summary-source-migrate-019.ts` — the guarded pass-53 apply:
  140 props (bill:tisk:43197 / tisk 87 carries no summary_source prop — disclosed), the
  verdict-106 correction (exactly one occurrence verified live before the write), and
  the archives-are-not-rewritten statement for verdicts-016/verdict-106.json.
- `batch-019-targets.json`, `prepare-batch-019.ts`, `batch-019-audit.md` (three rounds),
  ledger `batch019Verdicts`.

## Carried forward

- 22 bills still without a verdict.
- Tisk 106's platné-znění annex carries one § 9o cross-reference (the § tisk 107 would
  need) — noted at audit as a batch-020 census/collision detail.
- The sector-attribution surface on /zakony (build phase) — unchanged since batch-017.
