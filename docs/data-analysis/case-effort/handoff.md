# Case ② Effort — Batch 006 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault, git). Everything
below is validated on `.pglite-copy-effort` (disposable — recreate + re-verify with the commands in §1).
This handoff REPLACES batch-005's.

**Batch 006 closes the population: 207/207 MPs dossiered.** The loop drops to staleness-driven mode.

> ## ⛔ READ FIRST — a blocker that applies to PRIOR batches, not just this one
>
> Batch 006 shipped **Q-effort-14**, a hard-DROP gate check for pipeline jargon in the three dossier
> fields that render **verbatim** to voters on `/poslanec`. Running those same rules over the already-
> handed-off payloads of batches 001–005 gives:
>
> | batch | dossiers leaking | field-instances |
> |---|---|---|
> | 001 | 5/20 | 5 |
> | 002 | 15/30 | 18 |
> | 003 | 33/35 | 84 |
> | 004 | 35/35 | 140 |
> | 005 | 45/45 | 199 |
> | **total** | **133/165** | **446** |
>
> Note the monotone growth — the defect compounded as dossier prose got richer, which is why it was
> invisible per-batch. It is latent ONLY because no batch has been persisted to the live graph yet.
> **Batch-005's handoff §1a said `batch-005-props.json — SAFE TO PERSIST`; that is now superseded.**
>
> **Do not persist ANY effort payload — including batch 005's — until its prose passes
> `gate.ts`.** Batch 006's payload passes. Batches 001–005 do not. Re-gating them is a mechanical
> rewrite pass (batch 006 did all 42 of its own in one wave); it is the first item in §7.

---

## 1. Graph payloads (validated; re-verify commands included)

```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-006-props.json
# expect: 42 proposals · 42 PASS · 0 DROP · 14 Q-effort-11 warnings
```

### 1a. Army dossiers — 42 MPs (`payloads/batch-006-props.json`) — SAFE TO PERSIST
Merged from 9 group payloads (A–I), gated **42/42 PASS** after four driver fix passes:
1. Removed `effort_low_score_reason: "unknown"` from **10** proposals — it renders a public badge
   ("Neobjasněno — nízké skóre bylo prověřeno…") and was applied to MPs with no low score at all,
   including the batch's **highest** scorer (Papajanovský, 82.9), plus 80.6 / 80.4 / 77.3.
2. **Q-effort-14 public-copy rewrite** — all 42 dropped on the new check; all rewritten as reader copy,
   with removed internals preserved verbatim in the new non-rendered `effort_analyst_note` (39/42).
3. **Opus money corrections** (§1b) applied **in place** and independently audited: **8/8 verified**.
4. Post-reflection fixes: 2 group-scoped superlatives that were false at batch scale (Demetrashvili
   "youngest" — Smejkalová is younger; Havel "only MP comparable across both terms" — contradicted by
   8 dossiers in this same batch), and an explicit "unconfirmed sourced lead" hedge added to Petrtýl's
   donation findings so it matches the hedge already on Pražák's.

146 citations. 14 Q-effort-11 warnings remain, all inspected: legitimate subset-of-subset framings
under case gate (e) ("three of four bills…"), plus two that claim MORE than the prop and were checked
individually — Fridrich's is PSP9-scoped history, Mrázová's are government bills she sponsors as
minister. Soft-fail by design; reviewer's call.

### 1b. Money-crossover verification — P51/C13 two-layer gate
`payloads/batch-006-money-verification-input.json` (input) → `payloads/batch-006-opus-verification.json`
(verdicts: **2 BLOCKING / 5 NEEDS_CORRECTION / 1 CONFIRMED**, 20 entities re-verified from raw ARES VR
history, 4 disagreements). All corrections already folded into `batch-006-props.json` — nothing further
to apply. Narrative in `batch-006.md` §4.

**Highest-severity catches**: *Jakob* — army asserted "no role" at Operátor ICT (884.86M CZK); he was on
its supervisory board 2018–2020 (the C11 false-clearance class, second batch running). *Horák* — VR dates
were correct but compared against the wrong mandate start, hiding a ~2.5-month overlap between a supplier
board seat and his mandate. **Systemic root cause**: the army assumed every mandate began 4.10.2025, but
6 of these 8 MPs served earlier terms — one assumption produced both BLOCKINGs and most corrections.

### 1c. Reflection — `payloads/batch-006-reflection.json`
Opus, max depth. Verdict: **ACCEPT WITH REQUIRED FOLLOW-UPS**. It independently re-derived the committees
fix (0/42, corroborated), confirmed the gate regexes have no false positives against Czech traps, verified
the money corrections landed in place, and judged the convergence call honest and not back-fitted. It also
found 11 driver defects — the four fixable ones were fixed before this handoff (see §1a.4 and §3); the rest
are escalations below.

### 1d. `ledger.json` / `triage.json`
`triage.json` = `triage.ts --army=42` output. `ledger.json` advanced by
`npx tsx scripts/case-loops/effort/finalize-ledger.ts 6`:
- **coverage (dossiered, `stage != "pending"`): 207/207 — population complete**
- of which at stage `signal`: **127/207**. The 80-unit gap is batches 004/005, gated and handed off but
  never persisted — **outstanding orchestrator persist debt, not missing analysis.** Both numbers are
  printed by the script so neither can be quietly overstated.

---

## 2. Shared-vault additions (exact text to append — not edited from this boundary)

### → `frontier.md` (Case ② section)
```
- [effort] CORRECTION to the batch-005 frontier entry on extract-dossiers.ts: batch 005 root-caused the
  recurring committee_count/committees[] mismatch to "excludes Podvýbor + ověřovatel roles". Batch 006
  verified this before building on it and it is FALSE. 430 Podvýbor organs exist but ZERO PSP10
  memberships reference any of them, so committee_count never counted them either; and the stated
  mechanism was wrong twice over (/v[ýy]bor|komis/i DOES match "Podvýbor" — subcommittees are excluded
  from influential_in by the direct-child-of-chamber filter, all 430 hanging off 125 parent committees).
  The MEASURED causes are: (a) "Delegace" is in COMMITTEE_ORGAN_TYPES but is not matched by kg-compute's
  /v[ýy]bor|komis/i organ-type filter — 39/207 MPs; (b) psp.cz stores a leadership seat as TWO membership
  rows on one organ (member + function, 251/1062 pairs), so committee_count counts the body twice while
  influential_in dedupes — 121/207 MPs, the dominant cause. Fixed in extract-dossiers.ts (0/42 mismatches,
  0/207 in probe) and in the /poslanec render. Lesson: a root-cause trace needs the same verification bar
  as any other claim — batch 005's was confident, specific, wrong, and three vault files cited it.
  (closed 2026-07-25, batch 006)
- [effort] INGEST-SCOPE GAP (Case ① / ingest, NOT effort-owned): subcommittee (Podvýbor) memberships are
  absent from the PSP10 data entirely — 430 Podvýbor organs are ingested but 0 memberships reference them.
  Independently reported by 5 of 9 batch-006 army groups, several of whom documented MPs CHAIRING
  subcommittees per psp.cz (e.g. Fridrich, Brázdil, Hubíková) with leadership_count = 0. Related:
  leadership_count is also blind to poslanecký-klub leadership (předseda/místopředseda klubu) and to
  external institutional oversight seats (VZP, SZIF dozorčí rady). Effect: the contribution index
  systematically under-credits exactly the MPs doing subcommittee and club organisational work.
  (opened 2026-07-25, batch 006)
- [effort] DEFECT IN THE DETERMINISTIC INDEX (escalated, deliberately NOT fixed under case gate (a)):
  committee_count double-counts every body where an MP holds a function, because it counts membership
  ROWS and psp.cz writes a leadership seat as two rows. Because COMMITTEE_SATURATION = 3 the inflation
  only bites below saturation, but there it is exact: the batch-006 reflection measured 7 of 42 MPs (17 %)
  carrying a contribution_score inflated by exactly +6.67/100 (Tureček 52.1→45.4, Pipášová 78.6→71.9,
  Pražák 71.3→64.6, Berkovcová 55.6→48.9, Horák 80.4→73.7, Farhan 62.6→55.9, Rakušan 75.4→68.7);
  ~35/207 extrapolated. It is REGRESSIVE — it inflates precisely the MPs already receiving the flat +10
  leadership component. Correction to the framing: the fix site is arguably kg-contribution-ingest.ts's
  seat assembly rather than computeContribution itself, so gate (a) may not actually bar it — it is
  blocked by CONSEQUENCE (a full score regeneration invalidates every published number and every
  cross-batch comparison), not by rule. Needs a deliberate, announced regeneration, not a quiet patch.
  (opened 2026-07-25, batch 006)
- [effort] kg-compute.ts still keeps its OWN forked copy of the committee-type test (its local
  COMMITTEE_TYPE regex), so the Delegace divergence remains live in the graph builder even though the
  effort extractor and the /poslanec render now both import the single shared predicate from
  contribution.ts. Out of this case's boundary. Unifying it would close the divergence at source.
  (opened 2026-07-25, batch 006)
- [effort] Two sourced but UNCONFIRMED money leads from batch 006, for Case ① to gate before any surface
  renders them as fact: (1) GEMA MB s.r.o. — the company František Petrtýl half-owns and directs —
  is recorded by Hlídač státu as donating to ANO 2011 in every year 2016–2025, ~946 500 CZK total, while
  its dominant public counterparty is the city of Mladá Boleslav; the 16 575 162,54 CZK figure in our
  graph is an AGGREGATE of 180 contracts, not one untraceable payment. (2) AGROCENTRUM JIZERAN a.s. —
  where David Pražák has been vice-chair of the board continuously since 2007 — holds 153 subsidy records
  worth ~154M CZK from MZe and SZIF, and Pražák joined SZIF's supervisory board on 25. 3. 2026; the
  SUBSIDY CHANNEL, not the 2.84M CZK contract, is the actual mechanism of that conflict.
  (opened 2026-07-25, batch 006)
```

### → `patterns.md`
```
- [effort, 2026-07-25, batch 006] A PROSE LESSON IN THE VAULT DOES NOT SURVIVE CONTACT WITH A NEW ARMY —
  ONLY CODE DOES. Batch 005 found 4 dossiers leaking pipeline narration into publicly-rendered fields and
  wrote a well-formed patterns.md entry about it ("would I show this to a voter"). Batch 006's army, which
  had that entry available, reproduced the defect in 99 field-instances across 42/42 dossiers — 25x the
  scale. Every leaked statement was TRUE, which is exactly why an accuracy-only gate passed all 99. The
  fix that worked was converting the lesson into a deterministic hard-DROP check (Q-effort-14 in gate.ts),
  after which the same army's output was clean in one rewrite pass. Generalisation: when a batch writes a
  lesson about a class of defect that a deterministic check COULD catch, writing the check is the deliverable
  and the prose is only the explanation. Measured corollary: the leak had been growing monotonically across
  batches (5 → 18 → 84 → 140 → 199 field-instances for b1→b5) and no per-batch review had noticed, because
  each batch only ever looked at itself.
- [effort, 2026-07-25, batch 006] A ROOT-CAUSE TRACE NEEDS THE SAME VERIFICATION BAR AS THE CLAIM IT
  REPLACES. Batch 005's own lesson was "trace a recurring anomaly at its 2nd occurrence rather than
  re-flagging it". It did trace it — and produced a confident, specific, WRONG mechanism ("excludes
  Podvýbor + ověřovatel") that was then cited in ledger.md, handoff.md, patterns.md and frontier.md, and
  used to rewrite 21 dossiers' escalation text. Batch 006 disproved it in one probe (0 PSP10 podvýbor
  memberships exist; the quoted regex actually matches "Podvýbor"). A root cause is a claim, and an
  unverified root cause is more dangerous than an open anomaly, because it closes the question and
  propagates into the vault as settled fact.
- [effort, 2026-07-25, batch 006] DEDUPLICATION THAT MIXES FIELDS FROM DIFFERENT SOURCE ROWS BUILDS A
  CHIMERA. The driver's first /poslanec committee dedupe took "max role" from one membership row and OR-ed
  `current` across all rows for that organ — producing, for a real named MP (Papajanovský), a rendered
  "chair · current" for a chairmanship that had ENDED on 2026-03-06 while a separate membership row stayed
  open. Caught by the reflection, fixed so every field of the rendered seat comes from ONE row (prefer the
  highest role among still-open rows; fall back to ended rows only if none is open, and mark it past).
  The general rule: when collapsing N rows to 1, pick a row — never assemble a record field-by-field
  across rows, because the result describes nobody.
- [effort, 2026-07-25, batch 006] A CLOSED VOCABULARY NEEDS A PRECONDITION, NOT JUST A MEMBERSHIP CHECK.
  effort_low_score_reason passed the gate's vocabulary test 10 times this batch with the legal value
  "unknown" — on MPs including the batch's HIGHEST scorer (82.9). The value was in the vocabulary; the
  FIELD was categorically inapplicable, because it is a low-score corrective and these MPs have no low
  score. Batch 005 removed 9 fields for the same class (free text / literal "null"). A vocabulary gate
  answers "is this a legal value"; it cannot answer "does this field apply to this unit at all".
```

### → `contradictions.md`
```
- [effort, 2026-07-25, batch 006] Batch 006 CONTRADICTS batch 005's recorded root cause of the
  committee_count/committees[] mismatch. Batch 005 (ledger.md, handoff.md §3, patterns.md, frontier.md):
  "excludes Podvýbor + ověřovatel roles ... two files, two definitions of committee membership". Batch 006,
  measured on the copy: 0 of 1334 PSP10 memberships reference any of the 430 Podvýbor organs, so neither
  definition ever counted subcommittees; the real causes are Delegace organ-type filtering (39/207) and
  duplicate member+function rows on one organ (121/207). Resolution: batch 006's account supersedes; the
  frontier correction text is in §2 above. No dossier text depends on the difference, but 21 batch-005
  dossiers had their escalation wording rewritten on the strength of the wrong mechanism — that rewrite
  remains CORRECT in its conclusion (it is effort-owned, not a Case ① ingest defect), only its stated
  reason was wrong.
- [effort, 2026-07-25, batch 006] Batch 006 SUPERSEDES batch-005 handoff §1a's "batch-005-props.json —
  SAFE TO PERSIST". Under Q-effort-14, 45/45 batch-005 dossiers carry pipeline jargon in verbatim-rendered
  public fields (199 field-instances). The payload remains factually gated and analytically sound; it is
  its PUBLIC COPY that is not shippable. See the blocker at the top of this handoff.
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 006): effort_* enrichment props on the final 42 MPs, closing the
  population at 207/207 dossiered. NEW PROP: `effort_analyst_note` (string, 39/42) — a deliberately
  NON-RENDERED analyst/reviewer channel introduced so pipeline-internal observations could be removed
  from the three publicly-rendered dossier fields without discarding them (kernel no-silent-truncation).
  No node kinds, no edge rels, no vocabulary values added. effort_low_score_reason set for 6 MPs
  (genuine_absentee, institutional_promotion, low_legislative_output ×3, new_mp), all pre-existing values;
  10 further "unknown" assignments were REMOVED as categorically inapplicable. No contribution_* number
  touched anywhere in this batch.
```

### → `feature-opportunities.md`
```
- [effort · batch 006] SHIPPED: Q-effort-14 public-copy gate (`publicCopyViolations` in
  scripts/case-loops/effort/gate.ts) — a hard-DROP deterministic check that pipeline jargon never reaches
  the three dossier fields rendered verbatim on /poslanec. Caught 99 field-instances across 42/42 dossiers
  on first run; 446 more across batches 001–005 (see the blocker at the top of the handoff).
- [effort · batch 006] SHIPPED: committees[] rebuilt from raw membership rows against the single shared
  isCommitteeSeat predicate, in BOTH the effort extractor and the /poslanec profile render (which had the
  identical defect) — closes a 5-batch-old recurring false anomaly, adds fromAt/toAt/current so a seat
  vacated for a ministerial post no longer renders as active, and de-emphasizes past seats.
- [effort · batch 006] SHIPPED: the kernel's K=3 convergence rule made EXECUTABLE — SIGNAL_YIELD_THRESHOLD
  pinned at 0.50 in triage.ts and evaluated against ledger history on every run, printing the verdict.
  Before this the threshold existed in no file, so the rule could never fire and "not yet applicable" was
  unfalsifiable rather than false.
- [effort · batch 006] SHIPPED (parallel fleet-safe agent, same batch): `lib/ingest/sources/volby.ts` +
  `volby.test.ts` (19 tests) — the volby.cz/ČSÚ PS2025 candidate-registry ingest (Q-effort-13), confirmed
  at `https://volby.gov.cz/opendata/ps2025/PS2025reg20251005_csv.zip`, a quote-aware CSV parser (the file
  is semicolon-delimited CSV with embedded `;` inside `POVOLANI` text, NOT the psp.cz UNL format
  batch-005 assumed — a naive split silently corrupts rows; proven on a real row, Zdeněk Hřib's own
  occupation text). Join: 205/207 MPs matched (99.0%), 0 ambiguous, 2 named-not-silently-dropped
  unmatched (Mrázová, Řehková — likely a post-candidacy surname change). Deterministic
  `classifyEmploymentCoi` found 33 sector↔committee occupation hits across 32/205 joined MPs (15.6%), 3
  combined with Control Committee membership (Pospíšil, Svoboda, Penc) — the strongest Kott-class
  pattern found. **Honest null on the namesake case**: Kott's own PS2025 `POVOLANI` is literally "poslanec
  PSP ČR" (self-referential — 52.7% of joined MPs share this blind spot, since incumbents mostly list
  their own current office), so the classifier scores him zero despite his ZEV+KV combination matching
  the class exactly — not manufactured, reported as found. Full writeup, caveats, and a recommendation
  AGAINST shipping this as a standalone COI badge without a second corroborating source (spinning off
  Q-effort-14... — renumber against this batch's OTHER Q-effort-14, the public-copy gate, before either
  lands in the skill file) in `docs/data-analysis/case-effort/batch-006-volby-signal.md`. `npm run check`
  scoped to the two new files: typecheck/lint clean, 259/259 tests pass repo-wide at measurement time.
  Build-backlog item now CLOSED as built; the open follow-on is a second, non-self-referential
  occupation/employer source before any product surface renders this signal.
- [effort · batch 006, open] Retroactive public-copy rewrite of batches 001–005 (133 dossiers) — the
  precondition for persisting ANY prior effort payload.
```

---

## 3. Proposed enum / schema changes

**One new prop, no enum changes**: `effort_analyst_note` (string, optional) — an analyst/reviewer channel
that is deliberately rendered NOWHERE. It exists so the Q-effort-14 rewrite could strip pipeline-internal
observations from publicly-rendered fields without discarding them. It is `effort_*`-namespaced (passes the
gate's namespace rule) and exempt from the public-copy check by design. `getProfileData.ts` does not read
it; nothing renders it. If the orchestrator prefers this live outside the node props, say so and batch 007
will move it — but it must not become a fourth rendered field.

No `effort_low_score_reason` vocabulary change. Recommended for a future batch: give that field a
**score precondition in code** (see §2 patterns) rather than only a membership check.

## 4. Build file list (all inside boundary, all working-tree, none committed)

- `scripts/case-loops/effort/gate.ts` (edited — **Q-effort-14** `publicCopyViolations`, hard DROP)
- `scripts/case-loops/effort/extract-dossiers.ts` (edited — committees[] rebuilt from membership rows;
  prints a committees[]/committee_count mismatch count each run)
- `scripts/case-loops/effort/triage.ts` (edited — `SIGNAL_YIELD_THRESHOLD` + `printConvergenceVerdict`)
- `scripts/case-loops/effort/finalize-ledger.ts` (**new** — advances ledger.json, reports dossiered vs
  signal coverage separately)
- `lib/analysis/contribution.ts` (edited — **exports only** (`isCommitteeSeat`, `isLeadership`,
  `LEADERSHIP_FUNCTIONS`) + the measured root-cause comment. **No scoring logic touched**, case gate (a) held)
- `features/profile/getProfileData.ts` (edited — committees rebuilt from memberships, deduped by organ
  picking ONE row, `current`/`fromAt`/`toAt` added to `CommitteeSeat`)
- `features/profile/ProfilePage.tsx` (edited — past committee seats rendered de-emphasized)
- `docs/data-analysis/case-effort/` — batch-006.md, ledger.md, ledger.json, triage.json,
  dossier-inputs.json, handoff.md (this file), batch-006-volby-signal.md (parallel fleet agent),
  payloads/batch-006-{props,group-A..I,money-verification-input,opus-verification,reflection}.json
- `lib/ingest/sources/volby.ts` (new, parallel fleet agent) + `lib/ingest/sources/volby.test.ts` (new)

## 5. Commit plan (per-case; suggested)

**Suggested message:**
```
feat(effort): batch 006 — population closed 207/207, public copy becomes a gate, committee bug re-root-caused

Closes the Case ② population: the last 42 MPs dossiered, 207/207. Coverage is declared on ENUMERATION,
not on the kernel's K=3 yield rule — which batch 006 found had never been pinned to a number anywhere in
the repo, and which does NOT fire (0.771→0.744→0.500→0.500→0.458→0.405 puts only b5/b6 strictly under the
now-pinned 0.50 threshold, K=2 of 3). The threshold is pinned and evaluated in code rather than
back-fitted to make the rule appear to trigger.

Re-root-causes the 5-batch-old committee_count/committees[] mismatch and DISPROVES batch 005's
diagnosis: Podvýbor was never the cause (0 PSP10 memberships reference any of the 430 podvýbor organs).
The measured causes are Delegace organ-type filtering (39/207) and duplicate member+function membership
rows on one organ (121/207, dominant). committees[] is rebuilt from raw membership rows against the
single shared isCommitteeSeat predicate in both the extractor and the /poslanec render (which had the
identical bug) — 0/42 mismatches, plus fromAt/toAt so a vacated seat no longer renders as active.

Ships Q-effort-14: a hard-DROP gate check for pipeline jargon in the three dossier fields that render
verbatim to voters. Batch 005 found this class on 4 profiles and wrote a prose lesson; batch 006's army
reproduced it in 99 field-instances across 42/42 dossiers, so the lesson became code. All 42 rewritten as
reader copy with internals preserved in a new non-rendered effort_analyst_note prop. Also removed 10
effort_low_score_reason="unknown" badges applied to MPs with no low score, including the batch's highest
scorer (82.9).

P51/C13 two-layer money gate on 8 dossiers: 2 BLOCKING false clearances reversed (Jakob — actually on
Operátor ICT's supervisory board 2018-2020; Horák — a supplier board seat overlapping his mandate by
~2.5 months), 1 CONFIRMED (Petrtýl, four active concurrent ties). Systemic root cause found: the army
assumed every mandate began 4.10.2025 though 6 of 8 served earlier terms. Corrections applied in place
and independently audited 8/8. Opus reflection caught 11 driver defects; the four fixable ones (chimeric
committee dedupe, refuted root cause surviving in code comments, two false batch-scale superlatives, an
unhedged money lead) are fixed here, the rest escalated.

npm run check green repo-wide (typecheck, lint, 266 tests).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Do NOT commit** `.pglite-copy-effort` (delete at batch end). The working tree also carries concurrent
money/law/kiosek loop changes (`lib/ingest/sources/dataor.ts`, `crates/`, `clients/`, `features/money/*`,
`docs/data-analysis/case-{money,law}/*`) — live fleet concurrency, do not fold into this commit.

**`npm run check` status — checked BOTH ways, per batch-005's lesson that "green" claims were only true
for effort-owned paths:** effort-owned paths green, **and repo-wide green** (typecheck ✅ · lint ✅ ·
266 tests ✅). Mid-batch, repo-wide lint was failing on `lib/ingest/sources/dataor.ts` (unused var +
silent catch) — a sibling loop's file, outside this boundary; it was fixed by that sibling during this
batch. Batch-005's two blocking law-loop scratch files are gone. Nothing outstanding.

## 6. Lessons learned (tiering + process)

- **Convert a lesson into a check, or watch it recur at 25x.** The single highest-leverage act of this
  batch was turning batch-005's prose lesson into `publicCopyViolations`. The measured growth curve
  (5 → 18 → 84 → 140 → 199 leaked field-instances across b1→b5, invisible because each batch reviewed only
  itself) is the strongest argument yet that this loop's QA must accumulate in code, not in the vault.
- **The reflection's value remains concentrated on DRIVER work — now for the third batch running.** Of
  11 defects it found, the most serious were all mine: a chimeric dedupe that would have rendered a false
  "chair · current" for a named MP, a refuted root cause left standing in four code comments, and a
  handoff that did not yet exist. The army's raw analysis was again the strongest part of the batch.
- **A verified negative is worth as much as a positive, and needs saying out loud.** The reflection noted
  a real METHOD asymmetry: the Hlídač-státu donation/subsidy sweep ran on exactly two dossiers, both
  ANO2011. It was almost certainly evidence-driven (only those two MPs have active commercial entities) —
  but the batch never STATED its trigger, so it cannot demonstrate that depth followed evidence rather
  than target. Recommendation, mirroring the ARES-negatives doctrine: when a deeper research pass is run
  on a subset, record what triggered it, so selective depth is auditable.
- **Two notions of "done" must both be printed.** Reporting only stage-`signal` would have understated
  coverage as 127/207; reporting only "dossiered" would have hidden 80 units of orchestrator persist debt.
  `finalize-ledger.ts` now prints both, and the ledger volunteers the gap.
- **Czech morphology defeats naive string audits — use stems.** The driver's own fix-application audit
  produced a false failure because it matched `příspěvková organizace` while the text said
  `příspěvkovou organizaci`. Batch 005 hit the same trap in the gate ("ani jednoho"). Any audit or gate
  regex over Czech prose should match stems, not inflected full forms.

## 7. What comes next (the population is closed — staleness-driven mode)

1. **Retroactive public-copy rewrite of batches 001–005** (133 dossiers, 446 field-instances). This is the
   precondition for persisting any prior effort payload. Mechanical; one wave of grouped agents, gated by
   `gate.ts`.
2. **Escalate the three ingest-scope gaps to Case ① / ingest** (§2 frontier): subcommittee memberships
   absent entirely, `leadership_count` blind to club + subcommittee leadership, `committee_count`
   double-counting leadership bodies (with the measured +6.67/100 inflation on ~17 % of MPs, and the note
   that it is blocked by consequence rather than by gate (a)).
3. **Unify `kg-compute.ts`'s forked committee-type test** with `contribution.ts`'s shared predicate, so the
   Delegace divergence is closed at source rather than worked around in two consumers.
4. ~~volby.cz POVOLANI ingest~~ — SHIPPED this batch by a parallel fleet agent (§2 above). Next step is
   a second, non-self-referential occupation/employer source before the Kott-class signal is strong
   enough to render (Kott's own case scores zero under this source alone — see §2).
5. **Confirm the two money leads through Case ①'s gate** (GEMA MB → ANO 2011 donations; AGROCENTRUM →
   SZIF subsidy channel) before any surface renders them as fact.
6. **Re-open per-MP work only on staleness triggers** (re-ingest, Pumper watch events). A seventh full
   sweep would be composition, not signal: this batch's sharp lenses (absentee, quiet-workhorse both
   flavours, contested) produced ZERO, and 64 % of the army was pure high-triage filler.
