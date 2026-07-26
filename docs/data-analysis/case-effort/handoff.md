# Case ② Effort — Batch 007 handoff (fleet, Q-effort-15)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault, git).
Everything below is validated on `.pglite-copy-effort` (disposable, recreated 3× during this batch,
deleted at the end — recreate + re-verify with the commands in §1). **This handoff REPLACES
batch-006's.** Full narrative in `batch-007.md`.

**Batch 007 pays off the dossier public-copy debt Q-effort-15 asked for.** Population coverage is
unchanged (still 207/207 dossiered, closed since batch 006) — this batch is a **prose-quality fix**
on the 136 pre-006 dossiers that were dossiered before the public-copy gate existed.

---

## 1. Graph payload (validated; re-verify commands included)

```
rm -rf .pglite-copy-effort && cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-007-props.json
# expect: 136 proposals · 136 PASS · 0 DROP · 29 Q-effort-11 warnings (soft-fail, pre-existing)
```

### 1a. Retroactive public-copy rewrite — 136 MPs (`payloads/batch-007-props.json`) — SAFE TO PERSIST
Rewrites ONLY `effort_notes` / `effort_public_role` / `effort_bill_focus` / `effort_analyst_note` for
the 136 person nodes that were leaking pipeline jargon in the live graph (measured, not assumed: 136
of 207, all traceable to batches 1–5, cross-checked against `ledger.json`). **Props-merge only** —
every other prop on these 136 nodes (`effort_work_themes`, `effort_low_score_reason`,
`effort_tenure_*`, all `contribution_*`, etc.) is untouched.

Pipeline: 6 parallel Sonnet subagents rewrote their assigned ~23-node slice each (mechanical: strip
jargon per the exact rules in `lib/analysis/public-copy.ts`, preserve every fact/date/IČO/amount/
hedge, relocate removed pipeline-internal residue verbatim into `effort_analyst_note`, leave clean
fields untouched, carry citations forward) → merged → gated 136/136 clean on first pass → a
dedicated Opus money-fidelity pass caught 11 of the 44 money-touching entries where the rewrite had
silently turned a hedged/unproven company tie into a flat uncited assertion → all 11 corrected in
place → re-gated 136/136 clean → an Opus reflection pass caught two smaller process gaps (headline
dropped from the payload, `effort_analyst_note` unprotected as a future render risk) → both addressed
→ final re-gate 136/136 clean. Full account in `batch-007.md`.

**Verified render end-to-end on the copy (not assumed from the gate result)**: after persisting this
payload, 0/207 person nodes leak jargon (down from 136/207), 0 field-instances withheld by the real
`publicCopyOrNull()` render guard (down from 205), and **207/207 person nodes now render at least one
dossier field** (up from 71/207) — 180/207 render all three (the remaining 27 legitimately lack
content in one field, not a defect).

### 1b. Money-fidelity verification — `payloads/batch-007-money-fidelity-input.json` (44 entries) →
`payloads/batch-007-money-fidelity-verdict.json` (34 CONFIRMED / 3 NEEDS_CORRECTION / 7 BLOCKING, all
10 flagged entries' corrections applied in place) **plus one more the reflection caught** (Fiala,
rated CONFIRMED by the money pass but carrying the identical defect class — patched separately, see
`batch-007.md` §5). **11 of 44 money-touching dossiers needed correction, not 10.**

This is a **rewrite-fidelity** check (did jargon-stripping distort what the dossier asserts), not a
fresh ARES/psp.cz re-verification of the 44 underlying facts — those were established (and per prior
batches' own P51 gates, verified) by the batches that originally wrote them. Where the fidelity check
surfaced a genuinely newer, uncited finding (a later verification pass's registry lookup that never
made it into the public field with a citation), that finding is now parked in `effort_analyst_note`
behind an explicit "add the citation before this renders as fact" precondition — not asserted
publicly, not discarded.

### 1c. Reflection — Opus, max depth (2nd and last Opus call this batch, within the ≤2 budget).
Verdict: **ACCEPT WITH REQUIRED FOLLOW-UPS**. Independently verified the `gate.ts`/`public-copy.ts`
import wiring is real and regex-semantics-preserving (not just claimed), independently re-checked 4
CONFIRMED money verdicts and all 10 corrections' byte-exactness, confirmed `effort_analyst_note`
renders nowhere in the current codebase. Found 3 defects (D1/D2/D3 in `batch-007.md` §5) — all three
addressed in this handoff before persist, not deferred.

### 1d. Ledger / coverage
**No change to ledger.json's coverage numbers** — this batch does not dossier any new MP and does not
change any unit's `stage` or `batch`. 207/207 dossiered stands from batch 006; this batch is purely a
quality fix on the public-facing text of 136 already-dossiered units. `finalize-ledger.ts` was not run
(nothing for it to advance).

---

## 2. Shared-vault additions (exact text to append — not edited from this boundary)

### → `frontier.md` (Case ② section)
```
- [effort] Q-effort-15 CLOSED: the 436-field-instance / 136-node public-copy debt batch 006 measured
  and left open ("retroactive public-copy rewrite of batches 001–005... precondition for persisting
  ANY prior effort payload") is paid off. Re-measured at persist time (not carried forward from
  batch 006's number, which predates a code fix made this batch — see below): 136/207 leaking, 205
  field-instances, exactly batches 1–5 (batch 006's own 42 confirmed still clean). All 136 rewritten,
  gated 136/136 clean, verified end-to-end against the real render guard: 0/207 leaking, 207/207 now
  render at least one dossier field (up from 71/207). See `batch-007.md` for the full account.
  (closed 2026-07-26, batch 007)
- [effort] `gate.ts`'s Q-effort-14 public-copy check was a SILENT FORK of `lib/analysis/public-copy.ts`
  despite that module's own docstring claiming a single shared definition — gate.ts carried an extra
  "API/pipeline mechanics" rule (endpoint/REST API/JSON/pipeline/dossier) the render-time guard never
  had, so a string with that jargon class could be DROPPED at persist time but NOT withheld at render
  time for anything already in the graph. Unified: the rule list (+ a new `jargonViolationDetails()`
  export) now lives only in public-copy.ts; gate.ts imports it. Regex semantics confirmed unchanged
  (byte-identical migration) by the batch-007 reflection. (closed 2026-07-26, batch 007)
- [effort] NEW FAILURE CLASS FOUND: a mechanical "strip jargon, preserve facts" rewrite pass can still
  silently corrupt a money-touching claim by MERGING IN a later verification pass's findings without
  its hedge — 11 of 44 money-touching dossiers in this batch's rewrite turned an explicitly-unproven
  or "pending_review" company tie into a flat, uncited assertion of a current board seat or ownership
  stake (worst: a sitting minister's supervisory-board seat asserted as covering a 5.39bn CZK contract
  award period, sourced from nothing). None of these were introduced by malice or carelessness about
  facts — the rewrite agents were told to preserve every fact, and technically did: the newer finding
  WAS a fact recorded somewhere in the input text, just one that had never been promoted to the public
  field with its own citation. Escalating as a pattern for any future case-loop prose-rewrite pass:
  "preserve every fact" is not sufficient instruction when a dossier's text mixes an original
  (possibly hedged) claim with a later correction/addendum — the rewrite must be told explicitly not
  to promote an addendum's claim strength into the primary sentence without also promoting its
  citation. (opened 2026-07-26, batch 007)
- [effort] `effort_analyst_note` (introduced batch 006 as a deliberately non-rendered channel) is now
  carrying pipeline jargon BY DESIGN on 38/136 of this batch's records (56 jargon hits) — correct per
  its purpose, but it has zero code enforcement against ever being wired into a render path; only a
  new source-grep test (`lib/analysis/public-copy.test.ts`) stands between it and a future silent
  regression. Flagging for any future loop that adds a similar "internal channel" prop: pair it with
  a test on day one, not after a reflection catches the gap. (opened 2026-07-26, batch 007)
```

### → `patterns.md`
```
- [effort, 2026-07-26, batch 007] A JARGON-STRIPPING REWRITE CAN STRENGTHEN A CLAIM WHILE ONLY
  TRYING TO CLEAN ITS PHRASING. Told to "preserve every fact, don't strengthen or weaken any hedge,"
  6 parallel rewrite agents nonetheless did exactly that on 11/44 money-touching dossiers — not by
  inventing anything, but by merging a hedged original claim with an unhedged later-pass addendum that
  happened to sit in the same source text. The instruction "preserve every fact" was satisfied at the
  sentence level and violated at the claim-strength level. Generalisation: any rewrite pass over prose
  that may contain layered original+correction text needs an EXPLICIT rule — never let a claim's
  asserted strength exceed its OWN citation's strength, regardless of what else in the paragraph is
  cited — not just "keep the facts."
- [effort, 2026-07-26, batch 007] A MODULE'S DOCSTRING CAN CLAIM AN INVARIANT THAT THE CODE DOES NOT
  ENFORCE. `public-copy.ts` said outright "this module is the one definition both [gate.ts and the
  render loaders] import" while `gate.ts` had silently forked it with an extra rule the render guard
  never had. The claim was checked by nobody until this batch needed to trust it to compute a render
  projection. Lesson, same shape as batch 006's committee-count lesson: a comment asserting a shared
  source of truth is itself a claim, and needs the same verification bar as any other claim before a
  later batch builds on it.
- [effort, 2026-07-26, batch 007] TWO OPUS PASSES ON THE SAME BATCH CAN STILL MISS DIFFERENT THINGS —
  RUN THE SECOND ONE AGAINST THE FIRST ONE'S OUTPUT, NOT JUST AGAINST THE ORIGINAL. The dedicated
  money-fidelity pass rated `psp:person:5459` (Fiala) CONFIRMED; the separate reflection pass, given
  the corrected payload and told to be skeptical rather than to restate, found the identical defect
  class the money pass exists to catch, missed on the one entry where the flat/hedged inconsistency
  was BETWEEN TWO FIELDS (effort_notes flat, effort_public_role hedged) rather than between original
  and rewritten text of the SAME field. A single-field diff check has a blind spot a cross-field
  consistency check does not.
```

### → `contradictions.md`
```
(none — batch 007 does not contradict any prior batch's finding; it corrects batches 1–5's PUBLIC
COPY without touching their analytical conclusions, consistent with batch 006's own precedent of
this exact operation on its own 42.)
```

### → `graph-log.md`
```
- pass 7 (effort track, batch 007): props-merge on 136 pre-existing person nodes (batches 1–5),
  touching ONLY effort_notes / effort_public_role / effort_bill_focus / effort_analyst_note — no new
  node, no new prop name, no contribution_* number touched, no node kind or edge rel added. Purpose:
  retroactive public-copy rewrite (Q-effort-15), closing the debt batch 006's Q-effort-14 gate
  measured but could not itself pay off (it only guards future writes). ns=effort, track=effort.
```

### → `feature-opportunities.md`
```
- [effort · batch 007] SHIPPED: unified `lib/analysis/public-copy.ts` / `scripts/case-loops/effort/
  gate.ts` jargon-rule definition (gate.ts previously forked it, missing one rule the render guard
  never had) — persist-time DROP and render-time withhold can no longer diverge. New
  `jargonViolationDetails()` export + test coverage.
- [effort · batch 007] SHIPPED: retroactive public-copy rewrite of all 136 pre-006 leaking dossiers
  (batches 1–5). 207/207 person nodes now render at least one dossier field on `/poslanec`, up from
  71/207. The Q-effort-15 debt batch 006 opened is closed.
- [effort · batch 007] SHIPPED: a source-grep test guarding `effort_analyst_note` (the batch-006
  non-rendered analyst channel, now carrying jargon by design on 38/136 records) against ever being
  wired into `getProfileData.ts` / `ProfilePage.tsx` / `getLeaderboardData.ts`.
- [effort · batch 007, escalated not fixed] The "hedged-original + unhedged-addendum merges into a
  flat claim under a rewrite pass" failure class (11/44 money dossiers this batch) is a generic risk
  for ANY future case-loop prose-rewrite, not effort-specific — worth a shared authoring guideline
  ("promote a claim only as strongly as its own citation") rather than a per-case fix.
```

---

## 3. Proposed enum / schema changes

None. No new prop name, no enum value, no node kind, no edge rel. `effort_analyst_note` (introduced
batch 006) is the only prop touched that isn't one of the three original public-render fields, and it
already existed — this batch only writes more of them (now present on the majority of records where
jargon-stripping left non-redundant residue).

## 4. Build file list (all inside boundary, all working-tree, none committed)

- `lib/analysis/public-copy.ts` (edited — canonical `PIPELINE_JARGON` gains the "API/pipeline
  mechanics" rule migrated from gate.ts's fork; new `jargonViolationDetails()` export)
- `lib/analysis/public-copy.test.ts` (edited — 2 new tests for the unified rule +
  `jargonViolationDetails`; new `describe` block source-grep-guarding `effort_analyst_note`)
- `scripts/case-loops/effort/gate.ts` (edited — `publicCopyViolations` now imports the shared rule
  list instead of duplicating it)
- `scripts/case-loops/effort/measure-baseline.ts` (**new** — measures live-graph jargon-leak baseline
  against the real `jargonViolations()` import; dumps full detail to
  `payloads/batch-007-baseline-leaking.json` for a rewrite army to consume)
- `docs/data-analysis/case-effort/` — batch-007.md, handoff.md (this file),
  `payloads/batch-007-{baseline-leaking,group-A..F,group-A..F-input,props,money-touching-ids,
  money-fidelity-input,money-fidelity-verdict}.json`

## 5. Commit plan (per-case; suggested)

**Suggested message:**
```
feat(effort): batch 007 — retroactive public-copy rewrite closes the 136-dossier jargon debt (Q-effort-15)

Batch 006 shipped a hard-DROP public-copy gate for the three dossier fields that render verbatim to
voters, and measured 136/207 live person nodes (all in batches 1-5) already leaking pipeline jargon —
invisible only because a render-time guard withholds violating strings rather than shipping them
broken. This batch pays that debt off.

Found and fixed a real divergence first: gate.ts carried its own duplicated copy of the jargon-rule
array, missing one rule ("API/pipeline mechanics") the render-time guard in public-copy.ts never had —
so a string with that jargon class could be dropped at persist time but not withheld at render time.
Unified into one definition both now import; regex semantics confirmed byte-identical by reflection.

136 dossiers rewritten by 6 parallel Sonnet groups (mechanical: strip jargon, preserve every fact/
date/IČO/amount/hedge, relocate removed pipeline-internal residue into the non-rendered
effort_analyst_note, carry citations forward). Gated 136/136 clean on first pass.

A dedicated Opus money-fidelity pass then caught the real defect of this batch: on 11 of 44
money-touching dossiers, the "preserve every fact" rewrite had silently merged a later verification
pass's uncited findings into the primary sentence, turning hedged/unproven company ties into flat
assertions — worst case, a sitting minister's supervisory board seat asserted as covering a 5.39bn CZK
contract award period, sourced from nothing. All 11 corrected in place (10 from the dedicated pass, 1
more caught by the separate reflection pass, which the money pass itself had rated CONFIRMED).

Verified render end-to-end against the real publicCopyOrNull() guard on a disposable copy: 0/207
leaking (down from 136/207), 207/207 person nodes now render at least one dossier field (up from
71/207).

npm run check green repo-wide (typecheck, lint, 352 tests — 5 new, guarding effort_analyst_note
against ever being wired into a render path).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Do NOT commit** `.pglite-copy-effort` — already deleted. The working tree also carries concurrent
money/law loop changes — live fleet concurrency, do not fold into this commit.

**Note on mid-batch orchestrator activity**: commit `9abfde1` ("unify the public-copy jargon rules")
landed mid-batch (17:21, before the money-fidelity pass or reflection ran) and already carries
`gate.ts`, `public-copy.ts`, `measure-baseline.ts`, and the 6 `batch-007-group-*-input.json` files —
apparently swept up by the orchestrator alongside unrelated batch-008 law/money artifacts. Harmless
(re-verified `npm run check` green and the gate re-run clean after it landed), but **`batch-007-props.json`
and the two post-commit fixes (Fiala's restored hedge, the restored `headline` field) are still
untracked** — they were made after that commit and need their own commit/persist step. Re-run §1's
gate command before persisting to confirm nothing drifted between now and persist time.

**`npm run check` status**: effort-owned paths green; **repo-wide green** — typecheck ✅, lint ✅
(clean by the final check; was mid-batch failing on a concurrent sibling loop's file, fixed by that
loop during this same fleet window, not by this batch), **352/352 tests ✅** (5 new).

## 6. Lessons learned

- **A gate passing 100% on first try is not proof the rewrite is safe — check what the gate doesn't
  check.** 136/136 PASS on the jargon dimension the gate enforces; 11/44 money dossiers were still
  silently wrong on a dimension (claim-strength-vs-citation) no automated check covers. The dedicated
  Opus fidelity pass, not the deterministic gate, is what caught it — and even that pass missed one
  (Fiala) that only a second, skeptical reflection pass caught by cross-checking fields against each
  other rather than diffing one field against its own prior version.
- **"Preserve every fact" is an incomplete instruction for prose containing an original claim plus a
  later correction/addendum in the same paragraph** — a rewrite agent satisfies it exactly while still
  promoting the addendum's claim strength into the primary sentence. The fix for a future batch is a
  more specific rule ("never assert more than the nearest citation supports"), not more emphasis on
  the same rule.
- **Restore every input field to the output, even ones you don't think matter.** Dropping `headline`
  from the rewrite payload (it seemed like display-only metadata, and indeed is never persisted)
  silently disabled part of the gate's own Q-effort-11 numeric-mismatch scan for this batch — a scan
  added in batch 004 specifically because a real defect lived in exactly that field.

## 7. What comes next

1. **Escalate the "hedged-original + unhedged-addendum merges under rewrite" failure class** (§2
   frontier) as a general authoring guideline for any future case-loop prose-rewrite pass, not just
   effort's.
2. Everything else from batch 006's §7 that this batch did not touch remains open: the three
   ingest-scope gaps (subcommittee memberships, leadership_count blind spots, committee_count
   double-counting) escalated to Case ①; unifying `kg-compute.ts`'s forked committee-type test with
   `contribution.ts`'s shared predicate; confirming the two batch-006 money LEADs (GEMA MB, AGROCENTRUM)
   through Case ①'s gate; re-opening per-MP work only on staleness triggers, not a new full sweep.

**Handoff path (last line, per driver instructions):**
`C:/Users/mkdol/dolla/politicas/docs/data-analysis/case-effort/handoff.md`
