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
| 002 | 30 | 50/207 (24.2 %) | 0.744 | R=1 · low-score-reason badge on `/poslanec` (O-effort-2, generalized) | 30/30 PASS | Sonnet-majority (0 Opus in army); Q-effort-1 `never_cast_ballot` pre-filter live in triage — 0 new phantom mandates; NEW `replacement`-MP tenure class discovered |

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

### Batch 002 — pre-filter + 30-MP army, Sonnet-majority experiment (2026-07-24)
- **Q-effort-1 shipped**: `never_cast_ballot` (`participation_rate==0 && committee_count==0`)
  now runs in `triage.ts` BEFORE the absentee-manager lens on every batch. Result over the
  full 207-MP population: 4 total (unchanged from batch 001 — Zarzycký, Brabec, Kubis,
  Kučerová), **0 new this batch**. The absentee-lead lens is now correctly empty in the
  batch-002 pool (all 4 real leads were already covered batch 001) — zero wasted army slots.
- Re-ranked triage (`--army=30`): resumed from `ledger.json`'s 20 done units, added a
  `componentDivergence` lens (one-sided score composition) and split quiet-workhorse into
  fixed legislative/oversight slots. Army = 6 top + 4 bottom + 4 legislative-workhorse +
  4 oversight-workhorse + 5 contested-rebellion + 6 divergence + 1 high-triage filler.
- Army of 30, **Sonnet-majority** (6 grouped Sonnet agents × 5 MPs, 0 Opus) — the batch-002
  model-tiering experiment. Gate 30/30 PASS, 0 DROP. Mean signal 0.744 (vs 0.771 batch 001;
  Opus reflection assessed the dip as composition — deeper structural tail — not quality
  decay). 98 citations across 30 dossiers, 25 cross-cutting leads.
- **Key finding — a new structural class**: 4 `replacement` MPs (seated mid-term after a
  predecessor declined/resigned) are NOT caught by `never_cast_ballot` (they DID cast
  ballots) but score low purely on shorter tenure — `contribution.ts` has no tenure
  normalization. Distinct from batch 001's never-sworn phantom-mandate class.
- **Confirmed from batch 001**: `dual_mandate` generalizes beyond ODS/money (4 new cases,
  all ANO2011, only one with a money angle); `leadership_count` undercounts club-office
  roles again (Žáček, echoing Faltýnek); "officer-by-office" money pattern recurs twice
  (Niemiec/CEVYKO, Žbánek) — both instances gated `pending_review`, not asserted.
- **Data-quality issue found, not fixed**: Niemiec's dossier text cites IČO 08599254 for
  CEVYKO a.s. while its own citation URL shows 72160340 — flagged for reviewer correction
  before persist, not silently resolved either way.
- **Opus reflection (the one Opus call this batch, `effort: xhigh`)**: quality verdict —
  Sonnet held batch-001's bar on effort-only dossiers (0 contradictions across 4
  continuing-MP threads cross-checked against batch 001); the two real gaps found were
  BOTH on money-touching claims (the CEVYKO IČO mismatch; an under-traced 3.56B CZK
  Bouška figure). Recommendation for batch 003: keep Sonnet-majority for the general
  army, route money-crossover/accusatory units through an Opus verification pass.
- **Build (R=1)**: `LowScoreReasonBadge` on `/poslanec` — generalized O-effort-2 beyond the
  original "phantom mandate" framing to the full `effort_low_score_reason` vocabulary (10
  values), since batch 002 populated 6 new reason types across 30 MPs. New pure module
  `lib/analysis/low-score-reason.ts` (+ 5 tests) + client component
  `features/profile/components/LowScoreReasonBadge.tsx`, wired into `ProfilePage.tsx`;
  degrades to nothing when no reason is stored. `npm run check`: typecheck ✅ · lint ✅ ·
  tests 166/166 ✅ (up from 160; 6 new). One transient collision observed and NOT
  investigated further (out of boundary): a sibling law-loop fleet session momentarily
  left `scripts/case-loops/law/_tmp-verify-diff.ts` in a state that broke repo-wide
  typecheck; it self-resolved on retry — confirms money+law loops are live-concurrent in
  this same working tree.
- Gate 30/30. No live write, no commit (fleet) — see `handoff.md`.
- Steering for batch 003: tenure-normalize (or at minimum tenure-annotate) the bottom/
  divergence lenses so `replacement` MPs stop reading as low-effort; de-saturate
  `componentDivergence` (near-degenerate in a young term — most MPs score 0.4+); route
  money-linked units to an Opus verification pass per the reflection's recommendation.
