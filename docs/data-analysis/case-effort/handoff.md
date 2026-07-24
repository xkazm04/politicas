# Case ② Effort — Batch 005 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault, git). Everything
below is validated on `.pglite-copy-effort` (disposable — recreate + re-verify with the commands in §1).
This handoff REPLACES batch-004's `handoff.md`; batch 004 was already committed (`c454399`) before this
batch began, so the working tree at batch-005 start was clean for this case.

---

## 1. Graph payloads (validated; re-verify commands included)

```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-005-props.json   # expect 45/45 PASS, 19 warnings
```

### 1a. Army dossiers — 45 MPs (`payloads/batch-005-props.json`) — SAFE TO PERSIST
Merged from 9 group payloads (A–I), gated 45/45 PASS after two driver fix passes:
1. 13 initial DROPs (`effort_low_score_reason` closed-vocabulary violations — free text or literal `"null"`)
   fixed: 9 field removals, 4 remaps (`minister`→Vojtěch, `dual_mandate`→Vrána/Blišťanová,
   `low_legislative_output`→Volfová — the last later reverted, see below).
2. Post-Opus-reflection fix pass (batch-005.md §4 has full detail): 21 dossiers' false
   `"doporučuji ověřit v pipeline Case ①"` escalations corrected (the real cause is an effort-owned
   extractor gap, not a Case ① ingest defect — see §3 below); 3 false "clean case" counter-claims annotated;
   3 of 7 driver-applied Opus-verification fixes that the payload falsely claimed were applied (Juchelka,
   Pospíšil, Mádlová) were re-applied for real; Černochová's B1–B3 fixes corrected (wrong "primátorství"
   framing → "starostky", missing 2021–2025 Minister of Defence fact added, contradictory "aktuálně radní"
   claim softened to unverified); public-role render leakage cleaned on 4 profiles (Vojtěch, Vrána,
   Blišťanová, Volfová — pipeline narration was rendering verbatim via `LowScoreReasonBadge`); Volfová's
   `low_legislative_output` reason removed (forced fit, contradicted her own `zVsClub`); minor date/framing
   fixes (Janulík, Slovák's impossible "30. 2. 2026" date, Dražilová's unsourced editorial aside, a misspelled
   name "Ošanová"→"Ožanová").

10 of 45 dossiers are money-touching, all independently re-verified (see §1b). 19 Q-effort-11
(prose-vs-props) warnings remain, all inspected — legitimate PSP9-scoped or subset-of-subset framings under
case gate (e), soft-fail by design, reviewer's call.

### 1b. Money-crossover verification — P51/C13 gate, first full two-layer exercise
`payloads/batch-005-money-verification-input.json` (input) → `payloads/batch-005-opus-verification.json`
(dedicated Opus verdicts, 3 CONFIRMED / 3 NEEDS_CORRECTION / 4 BLOCKING) → all corrections already folded
into `batch-005-props.json` (§1a), nothing further to apply. Full narrative in `batch-005.md` §3.
**Highest-severity catch**: the army's Černochová dossier recommended *clearing* all 4 company ties; she is
actually a registered officer in 3 of 4 — the exact C11 false-clearance failure class recurring at scale
(5 of 10 army dossiers read only currently-registered officers instead of the full historical record).

### 1c. `ledger.json` / `triage.json` — advanced to batch 5, army marked `triaged` (not yet `signal`)
Both files are the direct output of `triage.ts --army=45` run on the copy — 45 MPs newly picked into batch
5's army carry `stage: "triaged"`, `batch: 5`; the other 162 carry their prior batches' `signal` stage. The
orchestrator's `persist-batch.ts` run against §1a should flip these 45 to `stage: "signal"` with the payload's
`signal` scores, per the existing batch-004 pattern — no separate re-run of `triage.ts` needed for this step.

### 1d. Build artifacts (code, not graph payloads) — see §4 below for file list.

---

## 2. Shared-vault additions (exact text to append — not edited from this boundary)

### → `frontier.md` (Case ② section)
```
- [effort] Q-effort-10 (Kott-class employment-COI signal) access assessment complete: volby.cz/ČSÚ Open Data
  (PS2025 registry, POVOLANI field) is free, no-auth, bulk-downloadable — worth a real ingest build, comparable
  effort to the existing osoby.unl ingest, one-time backfill (re-syncs only at the next election). cro.justice.cz
  (Centrální registr oznámení, zák. 159/2006 Sb.) requires a manually-approved, per-named-official, ~30-day
  Ministry of Justice paperwork process — NOT autonomously accessible by a loop, correcting batch-004's more
  optimistic "loops register for FREE API keys/accounts autonomously" framing. Recommend: build the POVOLANI
  ingest next; treat cro.justice.cz as a possible human-mediated follow-up, not an automatable source.
  (closed as assessed, batch 005 — access model now known; ingest itself remains open)
- [effort] extract-dossiers.ts committees[] extractor bug (root-caused this batch): the array only includes
  organs that are DIRECT CHILDREN of the chamber organ (kg-compute.ts), silently excluding Podvýbor
  (subcommittee) memberships, while contribution.ts's committee_count correctly counts them — and separately,
  extract-dossiers.ts's committees[] carries no fromAt/toAt, so an ended committee seat is indistinguishable
  from a current one (this is what made 3+ army dossiers this batch render a minister's vacated committee
  seat as still active). Both are effort-owned fixes (extract-dossiers.ts), not Case ① ingest defects — 21
  batch-005 dossiers initially misattributed this to Case ①, corrected in the payload. Recommended build item
  for the next R=1 slot: rebuild committees[] from the same membership rows computeContribution uses (organ
  types incl. Podvýbor, ověřovatel preserved as leadership, fromAt/toAt carried through). This also closes the
  batch-005/batch-004 recurring "committee_count mismatch" cross-cutting lead for good (29/45 this batch, 5th+
  occurrence). (opened 2026-07-25, batch 005)
- [effort] Stale-executive-role detection needs extending from historical to CURRENT transitions: batch-004's
  role_window_mismatch detector (deterministic, `toAt`-based) only catches MPs whose role changed before the
  triage snapshot. This batch found 4 MPs (Klempíř→Culture Minister, Vojtěch→Health Minister, Červený→
  Environment Minister, Černochová's PSP9 Defence Minister tenure) whose committee/leadership props are stale
  relative to a role that changed DURING or just before the batch's own processing window. Once extract-
  dossiers.ts carries membership toAt (see above), "seat with a past toAt still counted as current" becomes a
  deterministic code check rather than something only a web-researching army agent catches by chance.
  (opened 2026-07-25, batch 005)
```

### → `patterns.md`
```
- [effort, 2026-07-25, batch 005] A DRIVER'S "I APPLIED THE FIX" CLAIM NEEDS THE SAME AUDIT AS AN ARMY
  DOSSIER'S CLAIM: of 7 driver-applied Opus-verification text fixes in this batch's first pass, 3 were not
  actually applied to the payload despite the payload text claiming they were (one — Juchelka's neutral-
  phrasing fix — was completely unapplied; the successor's name was still asserted as "manželka" without
  citation, on a public-role-facts-only doctrine item). The mechanical fault: the driver APPENDED a correction
  sentence to effort_notes describing what should change, instead of EDITING the wrong text in place, leaving
  the error and its stated correction sitting side by side. Batch-004's lesson ("the reflection call's scope
  includes the driver's own new code") generalises further than written: the driver's fix-application claims
  need the same omission-scoped audit ("did you apply what you said you applied") as any other claim in the
  batch, not exemption because they're framed as corrections rather than original assertions.
- [effort, 2026-07-25, batch 005] A RECURRING CROSS-BATCH ANOMALY DESERVES A ROOT-CAUSE TRACE BEFORE AN
  ESCALATION RECOMMENDATION, NOT AFTER 5 OCCURRENCES OF NOTING IT: the committee_count/committees[] mismatch
  was independently flagged by army agents in at least 2 prior batches (each time recommending "ověřit v
  pipeline Case ①") without anyone tracing it to a specific line of effort-owned code. This batch's reflection
  traced it in one pass (two files, two definitions of "committee membership," neither wrong, both
  undocumented against each other) and found it was NEVER a Case ① defect. Lesson: a cross-cutting lead that
  recurs across batches should trigger a driver-owned root-cause trace at the NEXT occurrence, not accumulate
  as unresolved escalation-recommendations that risk actually being escalated to the wrong case eventually.
- [effort, 2026-07-25, batch 005] PUBLIC-RENDER FIELDS NEED A "WOULD I SHOW THIS TO A VOTER" CHECK, SEPARATE
  FROM FACTUAL-ACCURACY CHECKS: effort_public_role renders verbatim on `/poslanec` via LowScoreReasonBadge for
  any MP carrying effort_low_score_reason. 4 of this batch's dossiers had factually-accurate but pipeline-
  internal prose in that exact field (prop-name cross-references like "(2 role, odpovídá committee_count=2)",
  batch-internal asides like "třetí případ dual-mandate v tomto vzorku, viz Vrána"). None of these were
  factual errors — they would have passed any accuracy-only gate — but they read as debugging notes on a
  public page. A field-level render-audience check (is this field rendered verbatim to end users? if so, does
  it read as end-user copy?) is a distinct QA question from "is this true," and this batch's reflection is the
  first to have caught it at scale rather than per-dossier.
```

### → `contradictions.md`
```
- [effort, 2026-07-25, batch 005] Two found, both resolved before persist:
  (1) Group-B fleet mechanics: the first dossier-group-B agent attempt produced no output file and a
  "Waiting." result; a retry succeeded and was used for merge/gate; the ORIGINAL agent then completed late
  and independently overwrote the same file path with a different-but-factually-consistent version (same 5
  MPs, same facts, different phrasing/one misspelled name "Ošanová"→corrected to "Ožanová" in the final
  payload). No data was lost — the merge into batch-005-props.json had already captured the retry's version
  before the late overwrite landed, and the one substantive spelling difference was caught and fixed
  independently by this batch's reflection. Root cause: a group payload output path is not write-once-
  guarded — recommend the orchestrator consider a per-attempt suffix convention (or a lockfile check before
  write) for any group/dossier output path that a retry might target, to make this class of race impossible
  rather than merely harmless.
  (2) Ambiguous primary-vs-secondary-source contradiction (Martínková Španihelová's MATURUS tie) — flagged
  unresolved by the army, RESOLVED by the dedicated Opus verification pass in favour of the secondary sources
  (she is confirmed in the primary ARES VR record after all — the army's earlier fetch had been incomplete,
  same failure class as the Stržínek/Černochová false negatives). No longer a contradiction as of this batch.
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 005): effort_* enrichment props on 45 new army MPs (2 driver fix
  passes applied post-gate and post-reflection — see batch-005.md); effort_low_score_reason set for Vojtěch
  (minister), Vrána/Blišťanová (dual_mandate), Černochová (minister, retroactive PSP9 explanation); no new
  vocabulary values (dual_mandate/minister both pre-existing since batch 002, first at-scale use this batch).
  No new node kinds / edge rels. No contribution_* number touched anywhere in this batch.
```

### → `feature-opportunities.md`
```
- [effort · batch 005] SHIPPED (build, this batch): tenure-aware profile copy on /poslanec — 2 new components
  (TenureNote, TenureTrendGate), 1 new pure module (lib/analysis/tenure-copy.ts, 16 test assertions), 0 new
  graph props (reuses batch-003's effort_tenure_* props). npm run check green over effort-owned paths
  (205/205 tests) — repo-wide check currently fails on unrelated law-loop scratch files, see §5.
- [effort · batch 005, open] extract-dossiers.ts committees[] rebuild (root-caused this batch, ~1-line-scope
  fix per organ type + fromAt/toAt passthrough) — closes a 5-batch-old recurring false-anomaly source and
  extends role_window_mismatch detection to CURRENT (not just historical) minister transitions. Recommended
  as the next R=1 build item.
- [effort · batch 005, open] volby.cz POVOLANI ingest (Q-effort-10 access-assessment now closed, build itself
  still open) — free, no-auth, bulk ZIP, one-time backfill, comparable effort to the existing osoby.unl
  ingest. See frontier.md addition above for the full access-model summary.
```

---

## 3. Proposed enum / schema changes

None this batch. `dual_mandate` and `minister` (used in `effort_low_score_reason` this batch) were both
already in the closed vocabulary since batch 002 — no vocabulary change needed or made. (The reflection
specifically flagged that these should NOT be recorded as "new classes discovered" in the loop's memory —
`.claude/skills/effort-loop.md`'s History section, if updated, should say "first at-scale use of existing
vocabulary," not "new class found.")

## 4. Build file list (all inside boundary, all working-tree, none committed)

- `lib/analysis/tenure-copy.ts` (new) + `lib/analysis/tenure-copy.test.ts` (new)
- `features/profile/components/TenureNote.tsx` (new)
- `features/profile/components/TenureTrendGate.tsx` (new)
- `features/profile/getProfileData.ts` (edited — reads effort_tenure_* off the person node)
- `features/profile/ProfilePage.tsx` (edited — wires TenureNote + swaps TrendPanel for TenureTrendGate)
- `scripts/case-loops/effort/gate.ts` (edited — Q-effort-11 negation-guard fix for the Ančincová false positive)

## 5. Commit plan (per-case; suggested)

One atomic Conventional commit inside the effort boundary:

**Files (all inside boundary):**
- `docs/data-analysis/case-effort/` — batch-005.md, handoff.md (this file, replacing batch-004's), ledger.md,
  ledger.json, triage.json, dossier-inputs.json, payloads/batch-005-{props,group-A..I,group-A..I-input,
  money-verification-input,opus-verification}.json
- `lib/analysis/tenure-copy.ts` (+ test)
- `features/profile/components/{TenureNote,TenureTrendGate}.tsx`
- `features/profile/{getProfileData.ts,ProfilePage.tsx}`
- `scripts/case-loops/effort/gate.ts`

**Suggested message:**
```
feat(effort): batch 005 — 45-MP army, two-layer money gate proves itself, tenure-aware profile build

CRO/volby.cz access assessment (Q-effort-10): volby.cz/ČSÚ POVOLANI is a genuine free bulk-downloadable
primary source worth building; cro.justice.cz requires a ~30-day manually-approved government request, NOT
autonomously accessible — corrects batch-004's optimistic framing. 45-MP Sonnet army (9x5 groups, 197
citations), gate 45/45 PASS after fixing 13 effort_low_score_reason vocabulary violations. P51/C13
two-layer money-verification gate exercised in full for the first time: dedicated Opus re-fetch of all 10
money-touching dossiers' full ARES VR officer records found 4 BLOCKING errors (including reversing a false
company-tie clearance recommendation on Černochová, and catching a truncated-fetch that missed Stržínek's
ACTIVE current board seat) — the exact false-clearance failure class the kernel's C11 doctrine warns about,
proving the gate's value on first full use. Opus reflection held the batch back one fix pass: found the
5-batch-old "committee_count mismatch" cross-cutting lead is an EFFORT-OWNED extract-dossiers.ts bug, not a
Case ① ingest defect (root-caused to line level, no cross-case escalation sent); found 3 of 7 driver-applied
Opus fixes were not actually applied on the first pass despite being claimed as applied (re-applied for
real); cleaned public-render leakage (pipeline narration rendering verbatim via LowScoreReasonBadge) on 4
profiles. Ships tenure-aware profile copy: mandate-began/departed note for replacement/departed MPs,
PSP9-trend suppression under 90 tenure days, both graceful-null. npm run check green over effort-owned
paths (205/205 tests).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

**Do NOT commit** `.pglite-copy-effort` (to be deleted at batch end). **Before any commit, the orchestrator
must resolve two untracked law-loop scratch files** (`scripts/case-loops/law/_audit-probe.ts`,
`_audit-probe2.ts`) that currently break repo-wide `npm run check` (typecheck + lint) — they are outside this
case's boundary to touch, but they will block CI for all three cases if committed as-is or left untracked
past this batch. The working tree also carries unrelated concurrent money-loop and law-loop changes
(`features/money/*`, `docs/data-analysis/case-money/*`, `docs/data-analysis/case-law/*`,
`lib/ingest/sources/psp-legislation.ts`, `scripts/case-loops/{law,money}/*`) — live fleet concurrency, do not
fold into this commit.

## 6. Lessons learned (tiering + process)

- **The P51/C13 two-layer money gate justified its own existence on first full use.** 4 of 10 money-touching
  dossiers this batch had a BLOCKING defect the army's own ARES check missed — and the failure mode was
  consistent (reading only currently-registered officers, missing the full historical/current record) across
  independent army agents, meaning a single-layer gate would have persisted at least 2 materially wrong
  claims (a false clearance recommendation, a missed active current tie) into the live graph.
- **The reflection call's value keeps concentrating on driver-authored work, not army work**, confirming and
  extending batch 004's finding: of this batch's material defects, the driver's own fix-application gaps
  (3/7 unapplied), false escalation attribution (21 dossiers), and stale claim ("npm run check green" when it
  wasn't repo-wide) outweighed the army's own analytical defects in both count and severity. The 45-MP
  Sonnet army's raw analysis — gate-(e) framing discipline especially — was assessed as the best of the loop
  so far.
- **A recurring cross-batch anomaly is a root-cause-trace trigger, not just a re-flag trigger.** The
  committee_count mismatch had been independently noted by army agents across 2+ prior batches without ever
  being traced to source; one focused pass this batch resolved it definitively and for free (in the sense
  that no new research was needed — both files already existed and just needed to be read against each
  other). Future batches should trace a lead after its 2nd occurrence, not accumulate escalation
  recommendations toward a case that doesn't own the actual defect.
- **A fleet output path needs write-once discipline for retried agents**, or a benign-looking race (§
  contradictions.md #1) becomes a live risk in a batch where the two versions genuinely disagree rather than
  merely differing in phrasing. This batch got lucky; the fix belongs in the harness/orchestrator layer
  (path suffixing or a lock check), not in driver discipline alone.
