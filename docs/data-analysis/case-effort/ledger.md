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
| 003 | 35 | 85/207 (41.1 %) | 0.500 | R=1 · quiet-workhorse flavour badge+filter on `/zebricek` (O-effort-3) | 35/35 PASS | Sonnet army (7×5) + 2 Opus calls (money verification + reflection); Q-effort-5 end-date-aware tenure annotation (207/207: 193 full_term / 7 replacement / 3 departed / 4 never_seated) + Q-effort-6 componentDivergence retune (sd 0.098→0.323, validated) both shipped; NEW mid-term-role-change structural class (6 MPs); oversight-flavour quiet-workhorse population now fully covered (5/5); signal dip is composition (17/35 high-triage filler), not quality decay |
| 004 | 35 | 120/207 (58.0 %) | 0.500 | R=1 · role_window_mismatch badge (O-effort-4) | 35/35 + 8/8 rewrites + 6/6 backfill PASS | Sonnet army (5×7) + Opus money-verification + Opus reflection; 8 held-back money dossiers rewritten under VR doctrine; Q-effort-11 prose-vs-props gate shipped; Kott-signal (Q-effort-10) reopened, not closed |
| 005 | 45 | 165/207 (79.7 %) | 0.458 | R=1 · tenure-aware profile copy (mandate note + TrendPanel suppression <90d) | 45/45 PASS (post-fix; 13 initial DROPs on `effort_low_score_reason` misuse, fixed) | Sonnet army (9×5) — 80% high-triage filler (36/45), lens exhaustion now dominant; CRO/volby.cz access probe: volby.cz POVOLANI worth building, cro.justice.cz NOT autonomously accessible (corrects batch-004 framing); P51/C13 two-layer money gate first full exercise — 4/10 BLOCKING catches (false-clearance reversal, truncated-fetch active tie missed, wrong entity+dates, ambiguity resolved); Opus reflection held batch back one fix pass — found `committee_count` mismatch (29/45 dossiers) is an EFFORT-OWNED extractor bug (not Case ① ingest), 3/7 driver-applied Opus fixes were not actually applied on first pass (re-fixed), public-render leakage on 4 low-score-reason profiles cleaned |
| 006 | 42 | **207/207 (100 %) — POPULATION CLOSED** | 0.405 | R=1 · Q-effort-14 public-copy gate + committees rebuilt (extractor & profile render) + convergence rule made executable | 42/42 PASS (post-fix; all 42 initially DROPped by the NEW public-copy check) | population complete by ENUMERATION, not by the K=3 yield rule (which does not fire — see below). Batch-005's `committees[]` root cause found WRONG: Podvýbor was never the cause (0 PSP10 podvýbor memberships exist); real causes are Delegace organs (39 MPs) + duplicate member/function rows on one organ (121 MPs). 99 pipeline-jargon leaks in verbatim-rendered public fields across 42/42 dossiers → prose lesson converted to a hard-DROP gate check; internals preserved in new non-rendered `effort_analyst_note`. 10 `effort_low_score_reason:"unknown"` badges removed from MPs incl. the batch's TOP scorer. P51/C13: 2 BLOCKING false clearances reversed (Jakob, Horák), 1 CONFIRMED (Petrtýl, 4 active ties), systemic root cause = "mandate began 4.10.2025" assumption wrong for 6 of 8. Parallel: volby.cz Kott-signal ingest SHIPPED (205/207 joined, 33 sector↔committee hits/32 MPs, honest null on Kott's own self-referential POVOLANI) |
| 007 | 0 new (136 rewritten) | 207/207 (unchanged) | — (prose-quality batch, no new dossiers) | R=1 · unified public-copy rule definition (gate.ts fork closed) + `effort_analyst_note` render-guard test | 136/136 PASS (post-fix; 11/44 money-touching rewrites corrected for silently-strengthened hedges) | Q-effort-15 CLOSED: retroactive public-copy rewrite of all 136 pre-006 leaking dossiers; verified live 0/207 leaking, 207/207 render ≥1 dossier field (from 71/207); NEW failure class — mechanical rewrite merged unhedged later-pass addenda into hedged claims on 11 money dossiers (P53), caught by the P51 two-layer gate + cross-field reflection (P55) |

**Signal-yield** is the convergence measure (new signals ÷ units). Batch 001 is the
baseline — every unit produced a citable dossier, so raw yield ≈ 1.0; the 0.771 above is
mean story-worthiness. **Convergence threshold pinned at batch 006: `SIGNAL_YIELD_THRESHOLD
= 0.50`** (`scripts/case-loops/effort/triage.ts`, evaluated in code and printed every run).
Before batch 006 the kernel's K=3 rule had **no number anywhere in the repo**, so it could
never fire; batches 001–005's "not yet applicable" was therefore unfalsifiable rather than
false. Against the pinned value the series 0.771 → 0.744 → 0.500 → 0.500 → 0.458 → 0.405
puts only b5 and b6 strictly under threshold → **K=2 of 3, the yield rule does NOT fire**.
Coverage is declared instead on **enumeration** (207/207 dossiered at batch 006) — the yield
rule is an early-stop rule and is moot once the population is exhausted.

**Coverage is counted two ways on purpose.** *Dossiered* = `stage != "pending"` (army + gate
complete) — this is what "coverage" means and what triage's resume filter uses: **207/207**.
*At stage `signal`* = additionally flipped by a live persist: **207/207 since batch-007
finalization (2026-07-27)**. The 80-unit gap (batches 004/005) that stood here as persist debt
was verified paid — all 80 units carry their `effort_notes` in the live graph (checked on a
fresh copy at finalize time), so `finalize-ledger.ts 4` + `5` were run to advance the stages.
`finalize-ledger.ts` prints both counts so neither can be quietly overstated.

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

### Batch 003 — tenure + divergence retune, Opus money-verification routing (2026-07-24)
- **Q-effort-5 shipped**: deterministic `effort_tenure_days`/`effort_tenure_class`/`effort_tenure_start`
  for all 207 MPs, sourced from `membership.fromAt` on organ 174 (the PSP10 chamber itself) — the mandate
  table's own date columns turned out to be almost entirely null in this ingest. 7 replacement MPs found
  (up from batch 002's 4 named cases), gated 207/207. Annotation-only; `computeContribution` untouched.
- **Q-effort-6 shipped**: `componentDivergence` re-tuned from an absolute 0-1 stddev (batch 002: sd 0.098,
  38 distinct values/207 — near-degenerate) to a `club × tenure_class`-cohort z-score stddev (sd 0.323,
  95 distinct values/207 — validated 3.3× spread increase BEFORE being used for ranking, per the kernel's
  own discriminative-power guardrail). Full evidence in `payloads/batch-003-divergence-validation.json`.
- Army of 35 (7 grouped Sonnet agents × 5): 6 top + 4 bottom (now tenure-normalized) + 4 quiet-workhorse-
  legislative + 0 quiet-workhorse-oversight (**population exhausted — 5/5 covered across batches 001-002**)
  + 5 contested-rebellion + 6 divergence + 17 high-triage filler. Gate 35/35 PASS, 0 DROP (one fix: a
  mis-namespaced `raw_flag` prop from one group corrected to `effort_data_flag` before merge). 152 citations.
- **Key finding — a THIRD floor-artifact class**: mid-term role change. 6 MPs (Havlíček→1st Deputy PM,
  Macinka→Deputy PM/Foreign Min., Schillerová→Finance Min., Babiš→PM, Metnar→Interior Min., Urbanová→Deputy
  Speaker) all took a bigger job in Dec 2025–Jun 2026, explaining their low plenary-activity props —
  distinct from batch 001's never-sworn phantom mandate and batch 002's replacement-MP tenure artifact.
- **Cross-cutting lead (count corrected by the Opus reflection)**: the same suspicious "OSVČ" IČO
  `04627695` contaminates the `linkedCompanies` data of **10 of the 13 money-linked army MPs** (flagged
  independently by 6 of 7 groups; two groups resolved it to mutually inconsistent entities) — a systemic
  entity-resolution defect in the money loop's `linked_to` ingest, recommended as a hard blocker on any
  money-crossover product surface until reconciled against ARES REST (escalated in handoff, not touched).
- **Money-crossover Opus verification** (13 MPs + the Kott conflict-of-interest lead): verdict — **do NOT
  persist the money/company sentences as-is**; 6/14 carry real errors, 5 the same way (false negatives on
  personal register roles — the army used ARES's officer-less plain endpoint; the fix is the VR endpoint).
  Shared-IČO mystery solved: 04627695 = Agrární demokratická strana with a junk "OSVČ" name field —
  ingest-level false-edge class affecting every self-employed MP. Kott's Agrofert COI CONFIRMED (and his
  empty linkedCompanies proves the mechanical filter misses claim-type COIs). Full verdicts in
  `payloads/batch-003-props.json` → `opusMoneyVerification` and `batch-003.md`.
- **Opus reflection** (the 2nd and final Opus call this batch): quality held on effort claims (0
  contradictions with prior batches), 4 concrete defects found (2 of them NON-money — qualifying batch
  002's "only weakness class is money"); tenure end-date gap + workhorse departure-guard both caught and
  FIXED in-batch; divergence V2 validated but flagged as artifact-dominated at the top. Full text in
  `handoff.md` / `batch-003.md`.
- **Build (R=1)**: quiet-workhorse flavour badge + symmetric filter on `/zebricek` (O-effort-3). Backfilled
  `effort_workhorse_flavour` (legislative|oversight) deterministically for the 15 currently-flagged,
  still-serving MPs (gate 15/15 — a departure guard added after the reflection caught that Beran, resigned
  May 2026, would otherwise be badged as current), shipped `lib/analysis/workhorse-flavour.ts` (+5 tests)
  and `WorkhorseBadge.tsx`, wired into `LeaderboardTable.tsx`. `npm run check`: typecheck ✅ · lint ✅ ·
  tests 176/176 ✅ (+10 new).
- **Tenure classifier hardened in-batch**: the Opus reflection caught that a fromAt-only version
  misclassified all 7 departed seats (incl. the 4 never-sworn phantoms) as 293-day full_term — fixed with
  `membership.toAt`; final classes 193 full_term / 7 replacement / 3 departed / 4 never_seated, re-gated
  207/207.
- Gate 35/35 (+207/207 tenure +15/15 workhorse-flavour). No live write, no commit (fleet) — see `handoff.md`.
  Fleet collision confirmed again this batch (unrelated `features/money/*`/`lib/db/*` changes present in
  the working tree from the concurrent money loop — not touched).
- Steering for batch 004: the high-triage-filler share (17/35) signals the sharpest lenses are exhausting;
  consider widening or adding a new lens (e.g. tenure-class-crossed-with-club-baseline) before it becomes
  the dominant share; resolve the shared-IČO anomaly's root cause with the money loop if it recurs a 5th
  time; `mid-term role change` deserves an `effort_low_score_reason` vocabulary review (Metnar/Urbanová
  don't cleanly fit existing values).

### Batch 004 — VR-doctrine rewrites, prose-vs-props gate, role-window badge (2026-07-24, committed)
- Committed to master before batch 005 began (`c454399`); full detail in `batch-004.md`/its own handoff
  (superseded by this batch's). Summary row added to the metrics table above for continuity. Rewrote the 8
  held-back money dossiers (Q-effort-9) under the ARES VR REST doctrine; shipped Q-effort-11 (prose-vs-props
  numeric cross-check); role_window_mismatch backfill (O-effort-4, 6 MPs); Kott-signal (Q-effort-10) reopened
  rather than closed as absent.

### Batch 005 — 45-MP army, two-layer money gate, CRO/volby.cz probe, tenure-aware build (2026-07-25)
- **CRO/volby.cz access assessment** (Q-effort-10 follow-up, headline finding): volby.cz/ČSÚ Open Data
  (PS2025 `POVOLANI` field) is a genuine free/no-auth/bulk-downloadable primary source, worth a real ingest
  build — full detail in `batch-005.md` §1. cro.justice.cz requires a manually-approved, per-person, ~30-day
  government paperwork process — NOT autonomously accessible, correcting batch-004's more optimistic framing.
- Triage (`--army=45`) over the 87-MP remaining pool. **Army composition 80% (36/45) high-triage filler**
  (up from 49% batch 004) — sharpest lenses now visibly exhausted. Mean signal continues declining:
  0.771→0.744→0.500→0.500→**0.458**. Recorded as steering evidence for batch 006's coverage-declaration call,
  not unilaterally declared this batch.
- Army of 45 (9 Sonnet groups × 5), gate 45/45 PASS after fixing 13 initial `effort_low_score_reason`
  closed-vocabulary DROPs. 197 citations. One group (B) needed a retry (first attempt produced no output
  file); reconciled cleanly, no data loss.
- **P51/C13 two-layer money-verification gate, first full exercise**: 10 money-touching dossiers, dedicated
  Opus re-fetch (full `clenoveOrganu`, not just current officers) found 4 BLOCKING errors — including
  reversing a false-clearance recommendation on Černochová (the exact C11 failure class) and catching a
  truncated-ARES-fetch that missed Stržínek's ACTIVE current board seat — plus 3 NEEDS_CORRECTION items, all
  fixed in the payload.
- **Opus reflection held the batch back one fix pass**: found the recurring `committee_count` mismatch
  (29/45 dossiers, 5th+ occurrence across batches) is an EFFORT-OWNED extractor bug in `extract-dossiers.ts`
  (excludes Podvýbor + ověřovatel roles), NOT a Case ① ingest defect — 21 dossiers' false escalation claims
  corrected, no escalation sent to the money loop. Also found 3 of 7 driver-applied Opus-verification fixes
  were not actually applied on the first pass (payload claimed they were) — re-applied for real. Public-role
  render leakage (pipeline narration rendering via `LowScoreReasonBadge`) cleaned on 4 profiles. Confirmed
  the `npm run check` "green" claim was true for effort-owned paths but false repo-wide (two untracked
  law-loop scratch files break shared typecheck/lint — flagged to orchestrator, not this case's to fix).
  1 genuine `gate.ts` false positive found and fixed (Czech negation "ani jednoho" misread as numeral 1).
- **Build (R=1)**: tenure-aware profile copy — `lib/analysis/tenure-copy.ts` (+16 test assertions),
  `TenureNote.tsx` (mandate-began/departed note for replacement/departed tenure classes), `TenureTrendGate.tsx`
  (suppresses PSP9 trend comparison under 90 tenure days, graceful "too early" state instead). `npm run check`
  green over effort-owned paths (205/205 tests, independently re-verified by the reflection call).
- Gate 45/45 (post-fix). No live write, no commit (fleet) — see `handoff.md`.
- Steering for batch 006: **decide on population-coverage declaration** given the 5-batch signal decline
  (0.771→0.458) and lens exhaustion (80% high-triage); if continuing, widen/retune triage lenses first (the
  kernel's own guardrail — don't keep ranking on a saturating signal); pick up the `extract-dossiers.ts`
  committee-extraction fix (1-line-scope, closes a 5-batch-old false-anomaly source) and the volby.cz POVOLANI
  ingest build as the next build-backlog items.

### Batch 006 — population closed (207/207), committee bug re-root-caused, public copy becomes a gate (2026-07-25)
- **POPULATION COMPLETE: 207/207 dossiered.** The last 42 MPs, 9 Sonnet groups, gate 42/42 PASS,
  146 citations, mean signal 0.405. Full detail in `batch-006.md`.
- **Coverage declared on ENUMERATION, not on the K=3 rule — and the rule was found unenforceable.**
  The kernel's signal-yield threshold had never been pinned to a number in this repo; the
  "threshold recalibrated for the V2 scale" comment prior steering pointed at is the unrelated
  `componentDivergence` lens cut (0.9). Pinned this batch at `SIGNAL_YIELD_THRESHOLD = 0.50` and made
  executable in `triage.ts`. Against it, only b5/b6 are strictly under → **K=2, the rule does NOT
  fire**; it was not back-fitted to make it appear to. Coverage stands because the population is
  enumerated. Lens evidence corroborates independently: 27/42 (64 %) pure high-triage filler and the
  absentee / quiet-workhorse / contested lenses ALL produced zero.
- **Batch-005's `committees[]` root cause was WRONG, and three vault files had cited it.** It is not
  a Podvýbor/ověřovatel exclusion: **0 PSP10 memberships reference any of the 430 Podvýbor organs**,
  so `committee_count` never counted them either (the mechanism as first written was wrong twice over —
  `/v[ýy]bor|komis/i` DOES match "Podvýbor"; subcommittees are kept out of `influential_in` by the
  direct-child-of-chamber filter, all 430 hanging off 125 parent committees — corrected by the
  reflection before persist). The real divergence is (a) **Delegace** organs —
  counted by `COMMITTEE_ORGAN_TYPES`, missed by kg-compute's `/v[ýy]bor|komis/i` influential_in
  filter (39 MPs); and (b) **duplicate membership rows** — psp.cz stores a leadership seat as a
  `member` row PLUS a `function` row on the same organ (251/1062 pairs), so `committee_count` counts
  it twice while `influential_in` dedupes (121 MPs — dominant cause). `committees[]` is now rebuilt
  from raw membership rows through the exact `isCommitteeSeat` predicate `computeContribution` uses
  (both predicates exported with an anti-fork comment): **0/42 mismatches**, and the extractor now
  prints a mismatch count so a regression is loud. Lesson: a root-cause trace needs the same
  verification bar as any other claim — batch 005's was confident, specific and wrong.
- **`committee_count` genuinely double-counts leadership bodies** — a defect in the deterministic
  index. Case gate (a) forbids this loop from touching `computeContribution`, so it is **escalated,
  not fixed**. The extractor mirrors the double-count deliberately (so no phantom mismatch appears);
  the profile page dedupes for render.
- **Public-render defect at 25× the batch-005 scale → prose lesson converted to CODE.** 99
  field-instances across **42/42** dossiers carried pipeline jargon in `effort_notes` /
  `effort_public_role` / `effort_bill_focus`, all of which render verbatim to voters. Every statement
  was true, which is why an accuracy-only gate passed all 99. New **Q-effort-14** hard-DROP check
  (`publicCopyViolations` in `gate.ts`) dropped all 42; all rewritten as reader copy and re-gated
  clean, with removed internals preserved verbatim in a **new non-rendered `effort_analyst_note`**
  prop (39/42) — no silent truncation. Also removed 10 `effort_low_score_reason:"unknown"` values
  that would have badged MPs — including the batch's **highest** scorer (82.9) — with "low score,
  cause unexplained". Same class as batch-005's 9 vocabulary removals; argues for a score
  precondition in code, not just a vocabulary check.
- **P51/C13 two-layer money gate — 2 BLOCKING false clearances reversed.** 8 money dossiers, 20
  entities independently re-verified from raw ARES VR history (4 disagreements). **Jakob**: army
  wrote "no role" at Operátor ICT (884.86M CZK); he was on its supervisory board 2018–2020 (the C11
  class exactly) — corrected, and symmetry held (seat ended 19 days before his first mandate, so no
  overlap is implied). **Horák**: VR dates flawless but computed against the wrong mandate start —
  his board seat overlapped his mandate by ~2.5 months; the denial sentence was deleted, kept as a
  documented overlap and explicitly NOT a proven conflict (contract date unknown). **Petrtýl
  CONFIRMED**: four active ties concurrent with a mandate held since 2017. **Systemic root cause:**
  the army assumed every mandate began 4.10.2025, but 6 of 8 served earlier terms — that single
  assumption produced both BLOCKINGs and most corrections. Two material misses recorded as sourced
  LEADs: GEMA MB's 16.58M CZK is an aggregate (180 contracts) and the firm Petrtýl half-owns donated
  ~946.5k CZK to ANO 2011 across 2016–2025; AGROCENTRUM's real exposure is a ~154M CZK MZe/**SZIF**
  subsidy channel — SZIF being the fund Pražák joined the supervisory board of in March 2026.
- **Corrections applied in place and independently audited by the driver** against a pre-correction
  snapshot: **8/8 verified** (batch 005's failure — appending a correction beside the error — did not
  recur). The one audit "failure" was a bug in the audit regex itself: Czech declension
  (`příspěvkovou organizaci` vs `příspěvková organizace`) — the same morphology trap that caused a
  batch-005 gate false positive.
- **Positive symmetry**: of 8 money-touching MPs only Petrtýl carries active concurrent commercial
  ties; Kučera's ended 2005, Tureček's 2003, Brázdil's 2016, Rakušan's single active tie is a
  non-commercial local political association with zero money flow. Brázdil's dossier carries the
  batch's best epistemics, preserved: Vojenská nemocnice Olomouc is a státní příspěvková organizace
  structurally outside the commercial register — recorded as **not verifiable this way, NOT
  "cleared"**.
- **Manifestation check**: every effort_* prop verified consumed and rendered, no prop-name drift, no
  orphaned UI field, `serverExternalPackages` guard intact. One real gap found and fixed: `/poslanec`'s
  committee section had the identical `influential_in` bug — rebuilt from memberships, deduped by
  organ at max role, past seats de-emphasized. That was the only thing built this batch; nothing was
  constructed merely to demonstrate activity.
- **`npm run check`**: effort-owned paths green (typecheck ✅ · lint ✅ · 264 tests ✅). **Repo-wide
  lint FAILS** on `lib/ingest/sources/dataor.ts` (unused var + silent catch) — a sibling loop's file,
  outside this boundary, flagged to the orchestrator.
- Gate 42/42 (post-fix). No live write, no commit (fleet) — see `handoff.md`.
- **Steering now that the population is closed** (the loop drops to staleness-driven mode):
  (1) escalate the three ingest-scope gaps to Case ① — subcommittee memberships absent entirely,
  `leadership_count` blind to club and subcommittee leadership, `committee_count` double-counting;
  (2) ~~the volby.cz POVOLANI ingest~~ — SHIPPED this batch by a parallel fleet agent: `lib/ingest/
  sources/volby.ts` (+19 tests), 205/207 MPs joined (99.0%), deterministic Kott-class classifier found
  33 sector↔committee hits across 32 MPs (3 combined with Control Committee membership), and an honest
  null on Kott's own case (his declared occupation is self-referential — "poslanec PSP ČR" — a blind
  spot shared by 52.7% of joined incumbents). Recommendation: do not surface as a standalone COI badge
  without a second, non-self-referential source. Full detail in `batch-006-volby-signal.md`;
  (3) confirm the two batch-006 money LEADs (GEMA MB → ANO 2011 donations; AGROCENTRUM → SZIF
  subsidy channel) through Case ①'s own gate before any surface renders them;
  (4) re-open per-MP work only on staleness triggers (re-ingest, Pumper watch events), not on a new
  full sweep — the lenses are exhausted and a seventh grind would be composition, not signal.

### Batch 007 — the public-copy debt paid off (2026-07-26; finalized 2026-07-27)
- **Q-effort-15 CLOSED.** All 136 pre-006 dossiers leaking pipeline jargon (batches 1–5, re-measured
  at persist time: 136/207 nodes, 205 field-instances) rewritten by 6 parallel Sonnet groups —
  mechanical jargon-strip preserving every fact/date/IČO/amount/hedge, internals relocated into the
  non-rendered `effort_analyst_note`. Gate 136/136 PASS. Full narrative in `batch-007.md`.
- **The catch that matters (P53):** the Opus money-fidelity layer found **11 of 44** money-touching
  rewrites had silently merged a later verification pass's uncited findings into the primary
  sentence, turning hedged/unproven company ties into flat assertions (worst: a sitting minister's
  supervisory-board seat asserted against a 5.39bn CZK contract award period). 10 caught by the
  dedicated pass, 1 more (Fiala) by the cross-field reflection (P55). All corrected in place,
  re-gated clean.
- **Real enforcement gap closed (P54):** `gate.ts` had silently forked `public-copy.ts`'s jargon
  rules (an extra "API/pipeline mechanics" rule the render guard never had) despite the module's
  docstring claiming a single shared definition. Unified; regex migration confirmed byte-identical;
  new `jargonViolationDetails()` export + source-grep test guarding `effort_analyst_note` against
  ever entering a render path.
- **Verified live end-to-end:** 0/207 leaking (from 136/207), 0 field-instances withheld by
  `publicCopyOrNull()` (from 205), **207/207 person nodes render at least one dossier field** (from
  71/207), 180/207 all three.
- Committed as `9e4be77` (payload + persist, pass 32 in graph-log) + `9abfde1` (code unification).
- **Finalization (2026-07-27, this session):** the handoff's outstanding orchestrator steps landed —
  shared-vault appends (frontier Q-effort-15 closure, P53–P55, feature-opportunities), this ledger
  entry, and the ledger.json stage advance for the batch-004/005 persist debt (verified against the
  live graph before flipping: all 80 units' props present; 207/207 now at stage `signal`).
- **Steering:** unchanged from batch 006 — the loop stays in staleness/lead-driven mode. Open
  escalations: the three ingest-scope gaps to Case ① (subcommittee memberships, `leadership_count`
  blind spots, `committee_count` double-counting), unifying `kg-compute.ts`'s forked committee-type
  test with `contribution.ts`'s shared predicate, and confirming the two batch-006 money LEADs
  (GEMA MB → ANO 2011 donations; AGROCENTRUM → SZIF) through Case ①'s gate before any surface
  renders them. No new full sweep.
