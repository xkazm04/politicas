# Case ② Effort — Batch 004 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault, git). Everything
below is validated on `.pglite-copy-effort` (disposable — recreate + re-verify with the commands in §1). This
handoff REPLACES batch-003's `handoff.md` as current; batch 003 has already been committed (working tree was
clean at this batch's start).

---

## 1. Graph payloads (validated; re-verify commands included)

```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-004-props.json                  # expect 35/35 PASS
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-004-rewrites.json                # expect 8/8 PASS
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-004-role-window-mismatch.json    # expect 6/6 PASS
```

### 1a. Army dossiers — 35 MPs (`payloads/batch-004-props.json`) — SAFE TO PERSIST
Merged from 5 group payloads (A–E), gated 35/35. Two rounds of post-Opus-reflection fixes applied directly
(Fiala, Okamura, Majerová — see batch-004.md §Post-reflection fixes for full before/after). 10 Q-effort-11
warnings remain, all inspected and confirmed legitimate case-gate-(e) předkladatel-rank distinctions, **except
Kolovratník's headline order-of-magnitude slip ("desítky milionů" vs his own notes' 564 mil. Kč), which the
gate cannot catch (vague quantifier, no bare number) and which was NOT fixed this session** — reviewer should
correct before/at persist. Also NOT fixed: 5 committee_count mismatches (Řehková, Lang, Kovářová, Okamura,
Adamec — see batch-004.md) and the 8 dossiers that re-describe the already-SOLVED OSVČ IČO 04627695 as
unsolved (low harm — all `contractCzk 0`/`pending_review`, but inconsistent with batch-003's finding).

### 1b. The 8 rewritten money dossiers (`payloads/batch-004-rewrites.json`) — SAFE TO PERSIST, WILL OVERWRITE LIVE PROPS
Rewrites of the 8 held-back money dossiers (Q-effort-9), independently re-verified via the real ARES VR REST
API (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/<ICO>` — NOT the SPA at
`/ekonomicke-subjekty-vr/<ICO>`, which returns no usable content via fetch tools). Two independent
verification passes (a Sonnet rewrite agent's own or.justice.cz checks + a dedicated Opus verification call
that found 2 BLOCKING omissions and 5 minor defects, all fixed) — full detail in batch-004.md §Q-effort-9 and
§Opus money-crossover verification. **IMPORTANT: `Marek Výborný`'s proposal includes an `effort_public_role`
correction that OVERWRITES an already-live, defective persisted value** (the "šesti autorsky vedených tisků"
overclaim from batch 003 — confirmed live in `.pglite-copy-effort` before this fix). This is the one entry in
this payload that is a correction to existing graph state, not a first-time fill. Gated 8/8 PASS.
**Deliberately NOT applied** (Opus verification's own recommendation, logged not actioned): stripping
pipeline-internal narration ("batch-003 draft byl chybný" etc.) from the public-facing `effort_notes` prose in
6 of 8 entries — flagged as a copy-edit item for the human reviewer pass before these render publicly, not a
data-accuracy blocker.

### 1c. `role_window_mismatch` build backfill — 6 MPs (`payloads/batch-004-role-window-mismatch.json`) — SAFE TO PERSIST
Deterministic `effort_low_score_reason` + `effort_public_role` for the 6 batch-003 mid-term role-change MPs
(Havlíček, Macinka, Schillerová, Babiš, Metnar → existing minister/deputy_pm/prime_minister vocabulary;
Urbanová → new `institutional_promotion` value). Sourced from batch-003's own already-cited facts — no new
enrichment call. Gated 6/6 PASS. Renders automatically via the EXISTING `LowScoreReasonBadge` component
(batch 002) — no new component shipped.

### 1d. `ledger.json` / `triage.json` — current state is batch 004's, NOT advanced to batch 5
A scratch validation run of the fixed `triage.ts` (see §3) briefly advanced these files to a batch-5 pool
before being restored to batch 004's actual state (one-batch-per-cycle kernel rule). The orchestrator's
`persist-batch.ts` run against §1a–1c should be followed by a **fresh** `triage.ts` run for batch 005 (the
fix is already in the file; the scratch run's ranking-diff validation — sd 0.323→0.338, 100 distinct values,
Forman dropped from the divergence pick — is documented in batch-004.md, not re-derived here).

---

## 2. Shared-vault additions (exact text to append — not edited from this boundary)

### → `frontier.md` (Case ② section)
```
- [effort] Q-effort-10 (Kott-class employment-COI signal) reopened, NOT closed as "data does not exist":
  cro.justice.cz (Centrální registr oznámení, zák. 159/2006 Sb. — statutory MP conflict-of-interest
  declarations including employment, free registration, inside loop Authority) and volby.cz/ČSÚ Open Data
  (PS2025 candidate XML, POVOLANI field for all 207 MPs, frozen at election date) both carry occupation-
  adjacent primary data that a batch-004 probe initially declared absent from this repo — corrected by that
  same batch's Opus reflection. A deterministic keyword+committee-sector lens over the existing 85-MP dossier
  corpus already probes well (Kott seed case recovered, 3 plausible non-Kott candidates, correctly declines
  on committee-coincidence and public-office cases) — batch 005 should re-probe with these two sources before
  the PARTIAL/defer verdict hardens further. (opened 2026-07-24, batch 004)
- [effort] ARES VR endpoint trap, distinct from the batch-003 no-officer-data trap: the human-facing
  `https://ares.gov.cz/ekonomicke-subjekty-vr/<ICO>` URL is a client-rendered SPA that returns no usable
  content via WebFetch/fetch tools — the REAL REST API is
  `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/<ICO>`, confirmed working via
  direct curl and by 2 of 3 batch-004 research passes. At least 12 of batch 004's 35 army dossiers logged a
  failed VR lookup against the SPA URL — proposed as a kernel-level web-research doctrine addition (currently
  only in this case's batch note). (opened 2026-07-24, batch 004)
- [effort] Driver-authored deterministic code needs the SAME reflection-call scrutiny as army dossiers, not
  less: batch 004's own MIN_COHORT/replacement-pooling fix was a no-op on arrival (7 replacement MPs pooled
  into one cohort of 7, MIN_COHORT set to 8 — self-canceling), caught only because the batch's Opus reflection
  call was explicitly briefed to review the batch's OWN new code, not just its dossiers. Proposed as a kernel
  practice: "treat driver-authored deterministic code as in-scope for the reflection call by default."
  (opened 2026-07-24, batch 004)
```

### → `patterns.md`
```
- [effort, 2026-07-24, batch 004] "SD-UNCHANGED" IS NOT A SAFETY SIGNAL FOR A RETUNE — IT CAN BE A NO-OP
  SIGNATURE: batch-004's divergence retune validated itself by checking population sd before/after (unchanged
  at 0.323 to 3dp) and read that as "did not degrade." The batch's Opus reflection showed the correct read was
  the opposite: an sd that holds EXACTLY steady across a structural change to the cohorting logic is more
  consistent with the change doing nothing than with it doing no harm — confirmed when a concrete case
  (Libor Forman, a 55-day replacement MP) still took a divergence slot the retune was supposed to prevent.
  Corollary for future retunes: validate by RANKING DIFF (who enters/leaves the affected pick list), not by a
  single aggregate statistic holding steady.
- [effort, 2026-07-24, batch 004] A SEMANTIC OVERCLAIM CAN BE NUMERICALLY INVISIBLE: Q-effort-11's prose-vs-
  props numeric cross-check was built specifically to catch Výborný's "šesti autorsky vedených tisků" claim,
  but even after full field-coverage expansion (effort_public_role + headline), it still cannot catch this
  exact case — because his aggregate bills_authored genuinely equals 6, so the NUMBER is correct; the defect
  is using "autorsky vedených" (authored/led) framing for a count that conflates first-signatory and co-signer
  bills (case gate (e)). A numeric checker cannot detect a framing/rank violation where the number itself is
  accurate. This class of defect needs a different check (verb/framing-sensitive, not regex-numeric) or stays
  in the Opus-reflection layer.
```

### → `contradictions.md`
```
- [effort, 2026-07-24, batch 004] Three found, all resolved or logged, none surviving into persisted state:
  (1) IČO 04627695 re-opened as "unsolved" by 8 of batch 004's own army dossiers, contradicting batch 003's
  (twice-verified) SOLVED finding — not fixed in the 8 dossiers' text (low harm, all contractCzk 0/
  pending_review), logged as a process gap (army briefs need a solved-facts block).
  (2) Libor Forman's dossier said his predecessor Karel Beran "se v listopadu 2025 vzdal mandátu" —
  contradicts batch 003's deterministic finding that Beran departed 2026-05-29 (238 served days); Forman was
  confused with the 2025-11-03 replacement wave. Root cause was the ledger.json tenure-classifier bug (§3),
  now fixed; the dossier text itself was not corrected this session (low priority — the underlying deterministic
  props were never wrong, only the narrative aside).
  (3) ledger.json (git-tracked machine state) contradicted payloads/batch-003-tenure.json for exactly the 3
  departed MPs (Beran/Šichtařová/Kott) — RESOLVED, triage.ts's tenure classifier now matches tenure.ts's.
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 004): effort_notes/effort_bill_focus/effort_public_role corrections on
  the 8 batch-003 held-back MPs (Q-effort-9, includes one correction to an already-live prop — Výborný's
  effort_public_role); effort_* enrichment props on 35 new army MPs (2 rounds of post-verification fixes
  applied — Fiala/Okamura/Majerová); effort_low_score_reason (institutional_promotion, new vocabulary value) +
  effort_public_role on 6 role_window_mismatch MPs. No new node kinds / edge rels. No contribution_* number
  touched anywhere in this batch.
```

### → `feature-opportunities.md`
```
- [effort · batch 004] SHIPPED (build, this batch): role_window_mismatch badge — 0 new components (reused
  LowScoreReasonBadge/low-score-reason.ts from batch 002), 1 new closed-vocabulary value
  (institutional_promotion), deterministic backfill for 6 MPs. npm run check 194/194 green.
- [effort · batch 004, open] Deterministic citation-coverage gate check: every IČO in an MP's linkedCompanies
  must appear in that dossier's citations, else WARN — ~15 lines in gate.ts, would have mechanically caught
  both of this batch's Opus-verification blocking findings (Foldyna/DP Děčín, Výborný/Gymnázium Pardubice).
  Recommended as a batch-005 build item.
- [effort · batch 004, open] Kolovratník-class headline-vs-notes order-of-magnitude check (prose-vs-prose, not
  prose-vs-props) — cheaper and more common a failure mode than the numeric-vs-graph-prop check Q-effort-11
  currently does; not implemented this session.
```

---

## 3. Proposed enum / schema changes

1. **`effort_low_score_reason` vocabulary**: `institutional_promotion` added (Urbanová's Deputy Speaker
   promotion — doesn't fit minister/deputy_pm/prime_minister). Already added to `gate.ts`'s
   `LOW_SCORE_REASONS` and `lib/analysis/low-score-reason.ts`'s `LOW_SCORE_REASONS` + `COPY`.
2. **Kernel doctrine addition** (`docs/case-loops.md`, Web-research doctrine): the ARES VR REST-vs-SPA
   endpoint trap (§2 frontier.md text above) — proposed as kernel-level, not just effort-loop, since any case
   loop resolving ARES VR company officers will hit the same SPA trap.
3. **Kernel practice addition** (`docs/case-loops.md`, batch cycle §5 Reflect): "the reflection call's scope
   includes the batch's own new deterministic code, not just dossier/enrichment output" — this batch's
   MIN_COHORT no-op was caught only because the reflection prompt explicitly named the new triage.ts sections
   as in-scope; a dossier-only reflection would have missed it entirely.

## 4. Commit plan (per-case; suggested)

One atomic Conventional commit inside the effort boundary:

**Files (all inside boundary):**
- `docs/data-analysis/case-effort/` — batch-004.md, handoff.md, ledger.json, triage.json, dossier-inputs.json,
  payloads/batch-004-{props,rewrites,rewrite-input,role-window-mismatch,kott-signal-probe,opus-verification,
  opus-reflection}.json, payloads/batch-004-group-{A..E}.json, payloads/batch-004-group-{A..E}-input.json
- `lib/analysis/low-score-reason.ts` (+ test file already covers new vocabulary value generically, no test
  changes needed — verified `npm run check` green)
- `scripts/case-loops/effort/` — gate.ts (Q-effort-11 prose-vs-props check + field-scope expansion),
  triage.ts (Q-effort-12 divergence retune + MIN_COHORT-no-op fix + tenure-classifier sync fix),
  role-window-mismatch.ts (new)

**Suggested message:**
```
feat(effort): batch 004 — 8 money-dossier rewrites (VR re-verified), Q-effort-11/12 deterministic gates,
role_window_mismatch build, Opus-caught driver bugs fixed

Q-effort-9: rewrote the 8 batch-003 held-back money dossiers under the ARES VR doctrine, independently
re-verified twice (Sonnet rewrite + dedicated Opus call) — found and fixed 2 blocking omissions (Foldyna's
second historical tie, Výborný's decade-long Gymnázium Pardubice statutory role, the latter correcting an
already-live persisted prop). Q-effort-11: new gate.ts prose-vs-props numeric cross-check, retroactively
validated (1/2 claimed catches genuine; the real defect proved numerically uncatchable and was fixed
directly — see batch note). Q-effort-12: divergence V2 residual fixes — MIN_COHORT/replacement-pooling
found to be a no-op by the batch's own Opus reflection call, fixed and re-validated by ranking diff; a stale
tenure classifier in triage.ts (out of sync with batch-003's tenure.ts fix) also found and fixed. 35-MP
Sonnet army (5x7 groups, 176 citations, gate 35/35) with 2 post-hoc fixes (Fiala/Okamura money claims
independently re-verified via ARES VR; Majerová's misread contribution.ts flag corrected). Kott-signal
probe (Q-effort-10): PARTIAL/defer, with an initial "data does not exist" conclusion corrected by the
reflection call (cro.justice.cz + volby.cz both carry occupation-adjacent primary data, unprobed). Ships
role_window_mismatch backfill (O-effort-4): 0 new components, reuses batch-002's LowScoreReasonBadge, 1 new
vocabulary value. npm run check green (194/194 tests).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```
**Do NOT commit** `.pglite-copy-effort` (to be deleted at batch end). The working tree also carries unrelated
concurrent money-loop and law-loop changes (`features/money/*`, `lib/analysis/kg-money*`, `lib/db/pglite/*`,
`docs/data-analysis/case-law/*`, `scripts/case-loops/law/*`, `scripts/data-analysis/kg-money-ingest.ts`) —
live fleet concurrency, do not fold into this commit.

## 5. Lessons learned (tiering + process)

- **The reflection call's value this batch came from reviewing the DRIVER, not just the army.** Every
  material defect the reflection found in the 35 army dossiers was a real but bounded issue (5 dossiers, 2
  fixed); the two most consequential findings — the MIN_COHORT no-op and the false "2/2 Q-effort-11 catches"
  claim — were both driver-authored. Kernel tiering rule (a) ("batch QA/reflection... Opus audit caught real
  defects a Sonnet-only pass had accepted") needs an explicit corollary: the driver's own deterministic code
  and its own validation claims are not exempt from this scrutiny by default, and should be named in-scope
  in the reflection prompt every batch, not assumed safe because they're code rather than prose.
- **Confirmation-scoped re-verification has near-zero marginal value; omission-scoped re-verification is
  where the value is.** The driver's own curl re-check of the 8 rewrites (done in parallel with, then before,
  the dedicated Opus call) matched the rewrite's findings on every single IČO checked — zero yield, because it
  checked exactly what the rewrite had already chosen to check. The dedicated Opus call's two blocking findings
  were both OMISSIONS (an IČO already in the MP's own linkedCompanies list that nothing had looked up at all).
  The generalizable lesson: a "did I get this right" second pass and a "what did I not check" second pass are
  different tools — one catches transcription errors, the other catches gaps, and only the second one is worth
  paying for once a first pass already exists.
- **Money-verification routing regressed from claim-type-based to payload-based, and nobody flagged it until
  the reflection did.** Batch 003 routed every army money-crossover MP to Opus; batch 004 only routed the 8
  separately-scoped rewrites, silently leaving 6 of the army's own new money claims (including the batch's
  highest-signal dossier, Fiala at 0.9) unreviewed by Opus. The driver closed part of this gap directly rather
  than spend a third Opus call mid-batch, but batch 005 should explicitly re-scope call 1 to "every dossier
  making a personal-company-role claim or citing contractCzk above ~10M, regardless of which payload it sits
  in" — the kernel rule was never payload-scoped, the batch's own execution drifted into being so.
- **"sd held steady" is not automatically "did no harm" for a retune** — see §patterns.md above. Validate
  structural changes to a ranking/cohorting mechanism by diffing WHO the change moves, not just by an
  aggregate statistic holding within tolerance.
