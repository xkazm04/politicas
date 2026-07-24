# Case ② Effort — ledger

Human-readable batch log + metrics for the effort/contribution analyst-builder loop.
Machine state (207 unit rows, stage/batch/signal/flags) lives in `ledger.json`; the
per-batch dossiers in `batch-NNN.md`; graph payloads in `payloads/`.

Population = **207 PSP10 `person` nodes**, each carrying the pass-11 contribution props
(`contribution_score` + 6 components, `absentee_manager_lead`). Unit = one MP. Full
population is feasible; triage decides depth, not whether.

## Metrics

| batch | units done | coverage | mean signal | build (R) | gate | notes |
|---|---|---|---|---|---|---|
| 001 | 20 | 20/207 (9.7 %) | 0.771 | R=1 · PSP9 trend restoration (partial on copy, live ingest handed off) | 20/20 PASS | calibration; absentee crossover = systemic false-positive in young term |

**Signal-yield** is the convergence measure (new signals ÷ units). Batch 001 is the
baseline — every unit produced a citable dossier, so raw yield ≈ 1.0; the 0.771 above is
mean story-worthiness. Convergence (K=3 batches under threshold) not yet applicable.

## Batch log

### Batch 001 — calibration (2026-07-24)
- Triage over 207 nodes on the copy: club-baseline z-scores, extremes, absentee leads,
  quiet-workhorse detection, contested-vote overlap → `triage.json`.
- Army of 20 (top5 + bottom5 + 4 absentee + 5 quiet-workhorse + 3 contested fillers),
  four stages each. 4 Opus (money-crossover dossiers) + 16 Sonnet.
- **Key finding:** the young PSP10 term makes the effort tail structural — 4 "phantom
  mandates" (elected, never sworn: Zarzycký, Brabec, Kubis, Kučerová) and a PM-handover
  artifact (Fiala) explain the bottom cluster; all 4 `absentee_manager_lead` flags are
  false positives (executive-office money, not bench absence). Full detail in `batch-001.md`.
- **Positive symmetry:** 5 quiet workhorses surfaced (Richter, Brzesková, Sedláčková,
  Ratiborský, Beran) — real committee/legislative work with low floor visibility.
- **Build (R=1):** PSP9 term-over-term trend restoration. Term-parameterized
  `scripts/case-loops/effort/psp9-contribution.ts` writes `contribution_psp9` onto 109
  continuing MPs on the copy (committee/legislative/speech from present memberships +
  cached activity dumps; participation/attendance null pending the roll-call dump). New
  pure `lib/analysis/contribution-trend.ts` (+ test) + `TrendPanel` render a graceful
  delta on `/poslanec/<id>`: null → today's single-term view, present → real trend.
  `npm run check`: typecheck ✅ · effort-file lint ✅ · tests 160/160 ✅ (the two failing
  lint errors belong to the sibling **law** loop's `scripts/case-loops/law/triage.ts`).
- Gate 20/20. No live write, no commit (fleet) — see `handoff.md`.
- Steering for batch 002: add a deterministic `never_cast_ballot` pre-filter to triage so
  phantom mandates don't consume absentee slots; re-run absentee crossover after; process
  the next 20 by triage rank (mid-band divergence + more quiet workhorses).
