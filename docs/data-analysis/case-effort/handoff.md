# Case ② Effort — Batch 001 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault,
git). Everything below is validated on `.pglite-copy-effort`; nothing here was committed
or written live. **The copy is disposable** — recreate + re-verify with the commands in §1.

---

## 1. Graph payloads (validated; re-verify command included)

### 1a. Person-node enrichment props — 20 MPs (`payloads/batch-001-props.json`)
Namespaced `effort_*` props on existing `psp:person:*` nodes. **No** contribution number is
proposed (gate forbids it). Persist as a read-merge onto the person node's `props` (same
pattern as `kg-contribution-ingest.ts`), tagging provenance
`{track:"effort", pass:<assigned>, method:"deterministic", ref:"effort-batch-001", computedAt}`.
Props are annotations (`review_state: pending_review` in spirit) — they never flip a human gate.

Re-verify id-membership before persisting:
```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts   # expect 20/20 PASS, 0 DROP
```

### 1b. PSP9 contribution restoration — `contribution_psp9` on 109 continuing MPs
`scripts/case-loops/effort/psp9-contribution.ts` computes the prior-term profile and writes
a `contribution_psp9` sub-object per node. On the copy it wrote a **partial** profile
(`complete:false`, committee/leadership/legislative/speech real; participation/attendance
null) because the PSP9 roll-call dump is not yet ingested. To persist live:
```
# 1) live PSP9 vote/ballot/absence ingest — the ONE network step (psp.cz blocked from the loop env).
#    The ingest is already term-parameterized; it resolves hl-2021ps.zip from organ 173 (validFrom 2021-10-09).
PGLITE_PATH=./.pglite npx tsx scripts/data-analysis/ingest.ts --term=PSP9 --no-pumper
# 2) then the contribution restoration flips to complete=true (fills participation+attendance):
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/effort/psp9-contribution.ts --commit --pass=<assigned>
```
Until step 1 runs, committing step 2 is still valuable: the trend UI already lights up the
three vote-independent component rows and the activity-count deltas; participation/attendance
render an honest "čeká na doingestování hl-2021ps.zip" note.

### 1c. Deferred edge ideas (need new rels — NOT persisted)
- `person —controls_as_mayor→ company` (Zarzycký 7063 → Čistá Plzeň IČO 28046153): reframes the
  284 M CZK link as municipal-executive control, not personal enrichment. Registry-sustained (plzen.cz).
- `officer_by_office` / `private_commercial` boolean tags on Karpíšek's (6603) existing `linked_to`
  edges, distinguishing regional-board seats from a genuinely private tie.
Both require enum/schema decisions (§3); left for a future batch once the money loop weighs in
(the `linked_to` edges are that loop's boundary).

---

## 2. Shared-vault additions (exact text to append — I did not edit these files)

### → `frontier.md` (Case ② section)
```
- [effort] Deterministic `never_cast_ballot` pre-filter (participation_rate==0 && committee_count==0)
  to separate PHANTOM MANDATES (elected, never sworn) from genuine absentees BEFORE the
  absentee-manager crossover runs. Batch 001 found 4 phantom mandates (Zarzycký 7063, Brabec 6184,
  Kubis 7019, Kučerová 7020) sitting at the score floor; all 4 absentee_manager_lead flags were
  false positives driven by executive-office money. (opened 2026-07-24, batch 001)
- [effort] Does `bills_authored` conflate first-signatory (předkladatel) with co-signer? Top scorers
  (Haas, Šťastný, Vesecká) are never first signatory. Split the legislative component's provenance.
- [effort] committee_count inflation: friendship groups / delegate slots pad the count (Richter 6500).
  Should the committee component count only COMMITTEE_ORGAN_TYPES bodies, excluding skupiny přátel?
- [effort] PSP9 steno substance (beyond turn counts) once tsvector index lands (R9–R11).
```

### → `feature-opportunities.md`
```
- [effort · batch 001] Term-over-term TREND on /poslanec + /zebricek. SHIPPED (build, this batch):
  lib/analysis/contribution-trend.ts (pure, tested) + features/civicscore/components/TrendPanel.tsx,
  reading contribution_psp9 off the node; degrades to today's single-term view when absent. Lights
  up fully after the live PSP9 vote ingest (§1b).
- [effort · batch 001] "Phantom mandate" / declined-mandate badge on the profile — a positive,
  honest label ("mandátu se vzdal, zůstal hejtmanem/primátorem") that corrects a misleadingly low
  score. Cited, non-accusatory.
- [effort · batch 001] Quiet-workhorse surface on /zebricek: label + filter, distinguishing
  legislative-authorship workhorses (Richter, Brzesková) from oversight-institutional ones
  (Sedláčková, Ratiborský). Symmetric, sourced.
```

### → `patterns.md`
```
- [effort, 2026-07-24] YOUNG-TERM FLOOR ARTIFACT: in a ~8-month-old term the effort index's bottom
  tail is dominated by role artifacts, not disengagement — declined mandates (score floor ~10.4 with
  participation 0), executive handovers (former PM Fiala 28.6), and dual-mandate regional executives.
  The Case-①×② absentee-manager crossover therefore mis-fires: 4/4 leads were structural false
  positives. Corroboration should DOWN-weight, not raise, alarm for these.
- [effort, 2026-07-24] Two flavours of "quiet workhorse": legislative-authorship (high bills, low
  speech) vs oversight-institutional (high committee/commission load, ~0 bills). Both are positive;
  the product should not collapse them into one label.
```

### → `contradictions.md`
```
- [effort vs pass-11 crossover, 2026-07-24] absentee_manager_lead=true for Zarzycký (7063), Brabec
  (6184), Faltýnek (6190), Karpíšek (6603) is contradicted by public role: the first two RELINQUISHED
  their PSP10 seats (regional executives) and never voted; Faltýnek's 6.27 M is Agrofert-in-trust
  (board exit 2016); Karpíšek's 235 M is regional public-body board seats held by office. The flag is
  arithmetically correct but semantically a false positive. Resolution: never_cast_ballot pre-filter
  + effort_low_score_reason annotation (this batch's props). computeContribution numbers unchanged.
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 001): effort_* enrichment props on 20 person nodes
  (payloads/batch-001-props.json, gate 20/20). contribution_psp9 partial profiles on 109 continuing
  MPs (psp9-contribution.ts; complete=false pending hl-2021ps.zip). No new node kinds / edge rels.
```

---

## 3. Proposed enum / schema changes

1. **`effort_low_score_reason` vocabulary** (new prop; document alongside person props in
   `[[graph-schema]]`): `{minister, deputy_pm, prime_minister, opposition_leader, replacement,
   new_mp, dual_mandate, genuine_absentee, low_legislative_output, declined_mandate, unknown}`.
   `declined_mandate` is the ADDITION this batch needs — "elected but never sworn / relinquished
   pre-oath" (Zarzycký, Brabec, Kubis, Kučerová, Beran). Neither `replacement` (they were the
   *replaced*) nor `new_mp` fit.
2. **`contribution_psp9`** person-node prop → add a row to `[[graph-schema]]` person props:
   `{term, complete, missing[], components{6}, counts, participationRate|null, absenceRate|null,
   score|null, availablePoints, provenance{track:"effort"}}`. DERIVED, recomputable.
3. **Deferred new edge rels** (only if the money loop concurs): `controls_as_mayor` (person→company),
   or a `link_kind` prop on `linked_to` ∈ {officer_by_office, private_commercial, former_role}.
   Would need `KG_EDGE_RELS` / prop-convention entries in `lib/analysis/kg-verdict.ts`.
4. **Proposed i18n keys** (I could not edit `messages/*.json` — fleet shared). `TrendPanel` currently
   uses inline Czech literals; fold these into the `profile` namespace when convenient:
   `profile.trendHeading` = "Vývoj proti období {term}", `profile.trendPartial` = "částečné srovnání",
   `profile.trendPendingNote` = "Účast a docházka za {term} se zobrazí po doingestování hl-{year}ps.zip",
   `profile.trendCountBills` = "Tisky (spolu)autorské", `profile.trendCountSpeech` = "Vystoupení v sále",
   `profile.trendCountCommittees` = "Výbory a komise". (+ EN mirror.)

---

## 4. Commit plan (per-case; suggested)

One atomic Conventional commit inside the effort boundary:

**Files (all inside boundary):**
- `docs/data-analysis/case-effort/` — ledger.md, ledger.json, batch-001.md, handoff.md, triage.json,
  dossier-inputs.json, payloads/batch-001-props.json
- `lib/analysis/contribution-trend.ts` + `contribution-trend.test.ts`
- `features/civicscore/getLeaderboardData.ts` (trend wired onto entries)
- `features/civicscore/components/TrendPanel.tsx`
- `features/profile/ProfilePage.tsx` (renders TrendPanel when present)
- `scripts/case-loops/effort/` — triage.ts, extract-dossiers.ts, psp9-contribution.ts, gate.ts

**Suggested message:**
```
feat(effort): batch 001 — 20-MP dossiers + PSP9 trend restoration

Triage-ranked army of 20 (top/bottom/absentee/quiet-workhorse); enrichment
resolves the young-term score floor to structural causes (4 phantom mandates,
PM handover) and finds all 4 absentee-manager leads to be false positives.
Ships the term-over-term trend UI (contribution-trend + TrendPanel) reading
contribution_psp9, degrading to the single-term view until the live PSP9
roll-call ingest runs. Gate 20/20; check green in-boundary.
```
**Do NOT commit** the disposable `.pglite-copy-effort`. Blocker: the sibling **law** loop's
`scripts/case-loops/law/triage.ts` has 2 lint errors that make the repo-wide `npm run check`
red — coordinate so each case's slice is green before the shared check is trusted.

---

## 5. Lessons learned (calibrates the skill / kernel)

- **The absentee-manager crossover needs a phantom-mandate guard.** The single most valuable
  deterministic add is `never_cast_ballot`. Without it, the highest-CZK "absentee" leads are people
  who declined the seat — the loop spent 4 Opus dossiers proving false positives. Worth it for
  calibration, but batch 002 should pre-filter so Opus goes to genuine signal. **Kernel/skill tweak:**
  add "phantom/relinquished mandate" to the effort-loop clean stage as a named, code-first check.
- **A young term breaks cross-MP comparability.** ~8 months in, participation denominators and bill
  counts are tiny and role artifacts dominate. This is exactly why PSP9 trend restoration is the #1
  build — and why the trend must be component-level and honest about coverage, not a single score
  delta. The "compute what's offline-available, hand off the network component" split worked cleanly.
- **Grouped Sonnet agents held quality** on 3–5 MPs each when given the full pre-extracted graph
  context (dossier-inputs.json) so they never touched the single-connection copy. Pre-extraction is
  the right pattern for a fleet army — do it every batch.
- **The concurrency ceiling is 20 subagents**; 8 (4 Opus + 4 group) is comfortable and left headroom
  for the sibling loops. One relaunch was needed after a transient limit hit.
- **`bills_authored` semantics surfaced as a real gap** (co-signer vs first-signatory) — the effort
  index's legislative component is defensible but the PROVENANCE should record předkladatel rank so
  the profile can say "spolupodepsal" vs "předložil". Feed into contribution.ts docs, not the number.
- **Positive symmetry produced genuine stories** (Richter's jednací-řád novela in the Senate with 0
  speeches; Brzesková chairing a contested pension bill through her own committee) — the quiet-
  workhorse lens is high-value and should keep a fixed slot allocation every batch.
