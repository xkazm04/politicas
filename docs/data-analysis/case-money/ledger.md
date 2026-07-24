# Money loop — unit ledger (Case ① FollowTheMoney)

Resumable state for the FollowTheMoney analyst-builder loop. Machine state:
[`ledger.json`](./ledger.json) (260 tie units → {stage, batch, signal, corroboration,
flags}). Human batch log + metrics below. Skill: `.claude/skills/money-loop.md`; kernel:
`docs/case-loops.md`. Vault home: `docs/data-analysis/case-money/`.

Unit = one `linked_to` tie (person→company), the accountability atom. Population: **260
ties** (all `pending_review`), 196 companies, 2 287 contracts, **19.76 bn CZK** reachable.

## Batch log

### Batch 001 — calibration (2026-07-24)

- **Triage:** all 260 ties scored deterministically (`triage.ts`, PGlite copy). Added the
  **tie-class** dimension (owner-operator 37 · manager 23 · steward 200) so the queue ranks
  by *genuine* FollowTheMoney value, not raw money volume (which is dominated by public-body
  stewardship seats). Skipped pgvector this batch (calibration) — **next-batch work**.
- **Army:** top **15 ties**, four stages each (clean → enrich → wire → signal). 15 parallel
  subagents (Opus ×3 for the head, Sonnet ×12). Enrichment hit ARES subject + ARES VR,
  Registr smluv (via Hlídač web), psp.cz, with every claim cited. **No Hlídač API token in
  this env** (`.env.example` documents only Sentry) — enrichment degraded to token-free ARES
  + web registries; it still resolved all 15.
- **Gate:** `validate-payloads.ts` → **15/15** corroboration proposals validate against the
  graph copy. 0 drops, 0 fabricated ids.
- **Persist (fleet):** batch note `batch-001.md`; graph payloads
  `payloads/batch-001-corroboration.json` (NOT written to live DB — orchestrator serializes);
  ledger.json updated (15 units → stage `signal`, batch 1).

## Metrics block

| metric | batch 001 |
|---|---|
| units done / total | **15 / 260** (5.8%) |
| owner-operator ties in head | 37 identified; top 15 processed |
| **signal yield** (signals ÷ units) | 15/15 produced a scored dossier; **4 live conflicts (signal ≥4)**, ratio 0.27 |
| registry-confirmed | 11/15 · conflicting 3/15 · (all IČOs exist) |
| **stale/misattributed period caught** | **11/15** (the dominant finding) |
| gate pass rate | 15/15 (100%) |
| est. cost / unit | ~30 k subagent tokens/tie, 3–7 web calls, ~90 s wall (parallel) |
| reuse-rate | triage + signal helpers shared between `triage.ts` and the live console (`reviewTypes.ts`) |

**Convergence read:** batch is calibration, not convergence. Signal yield is high because the
head of the queue is the richest 15. The *structural* finding (stale periods) is itself the
highest-value output — it means the whole 260-tie population needs an ARES-VR period
reconciliation pass before any tie is presented as "active".

## Steering (next batch)

1. **Ties 16–30** by signal (owner-operators #16+; then the manager class). Batch size 15 held
   up well under the 20-concurrent subagent cap — keep 15, but launch in one wave (2 of this
   batch's 15 hit the cap and were relaunched).
2. **Temporal reconciliation as a first-class signal.** Re-run triage with an ARES-VR
   `role_valid_to` fetch so "ongoing-but-actually-ended" and "money-postdates-role" become
   deterministic flags, not per-tie discoveries. This is the single biggest calibration lever.
3. **pgvector subject-similarity** (R6) for contract-splitting candidates — deferred this batch.
4. **Sponzoring pass** — resolve the three surfaced company→party donation leads against the
   Hlídač donor registry (needs the API token → user gate) and propose donation edges.
5. **Indirect-ownership modelling** — the Babiš/CS CABOT scope gap shows the graph needs an
   `owns`/`controls` company→company layer (Agrofert→DEZA→CS CABOT) to catch indirect ties.

## Build-review

- **R=1 → shipped:** the **verification console** (`/penize/kontrola`) — the seed backlog's
  #1 build-ready increment. See `handoff.md`. R resets to 1 (something shipped).

### Batch 002 — full-population ARES-VR reconciliation + O-money-2 (2026-07-24)

- **Model tiering experiment:** driver + army = **Sonnet only**; Opus reserved for one
  reflection call. See `batch-002.md` for full detail.
- **Q-money-1 done:** all 245 remaining ties (batch 001 covered the top 15) reconciled
  against ARES VR by a deterministic script (`scripts/case-loops/money/reconcile-ares-vr.ts`)
  — birth-date-exact officer/shareholder matching, no LLM. Caught and fixed a real bug
  mid-run (missing `ostatniOrgany`/supervisory-board section: `conflicting` 91→23,
  `registry-confirmed` 96→164) and one flagged by the Opus reflection
  (`money-postdates-role` was conflating undated contracts with genuinely-later ones — fixed,
  0 cases affected in this run's data but the design gap is closed).
- **Sonnet judgment (10 ambiguous units):** 2 agents, 5 units each, real WebFetch+WebSearch,
  batch-001 dossier depth. 3 false negatives corrected (missing-birth-date VR records),
  2 confirmed negatives, 4 money-postdates-role verdicts confirmed as clean handoffs (not
  revolving-door — one independent non-disclosure lead surfaced, Okamura/U Machtů), 1
  wrong-entity catch (Bendl+Brabec → PRAK, likely wrong IČO).
- **Gate:** `validate-payloads.ts` (extended for multi-file + cross-file duplicate guard) →
  **260/260** population validates, 0 fabricated, 0 duplicates.
- **Build (R=1 → shipped, resets to 1):** O-money-2 temporal-status badge on `/penize`
  ledger + `/penize/kontrola` console — a tie never renders as active without registry
  confirmation. `npm run check` green for the money boundary (repo-wide typecheck clean,
  money-scoped lint clean, 166/166 tests; the one failing lint is the sibling law loop's
  file).
- **Opus reflection verdict:** quality **holds** against batch 001's bar on the
  reconciliation objective (honest-negative rate 33%, no fabrication, gate clean),
  **exceeds** it on rigor for the reviewed 10%; the deterministic bulk necessarily carries
  less narrative discovery-depth than batch 001's per-tie dossiers (expected — different
  pass, not a regression). Cost/unit ≈75× cheaper amortized. Full verdict in `handoff.md`.

## Metrics block — batch 002

| metric | batch 002 |
|---|---|
| units done / total (cumulative) | **260 / 260** (100% — population reconciliation complete) |
| corroboration | registry-confirmed 179 · conflicting 23 · registry-unconfirmed 58 |
| temporal_status (registry-confirmed) | current 43 · historical ~76 · money-postdates-role 39 · historical-no-money/undated ~22 |
| **signal yield** | 10/10 ambiguous units produced a judged verdict; 3 corrected, 1 wrong-entity catch, 1 new frontier lead (Okamura non-disclosure) |
| gate pass rate | 260/260 (100%) |
| est. cost / unit | ~420 tokens/unit amortized (vs batch 001's ~30k/tie) — deterministic bulk + Sonnet judgment only where ambiguous |
| reuse-rate | `AresClient.vrRecord()` (new, in `lib/analysis/money-feed.ts`) is now reusable by any future money-loop batch; `temporalBadge()` (`moneyTypes.ts`) is the shared badge logic for both ledger and console |

## Steering (next batch)

1. **Frontier leads from this batch:** Q-money-5 (Juchelka advisor subsidy-influence,
   2026 — surfaced incidentally, unrelated to this tie), Q-money-6 (Okamura 2016 asset
   non-disclosure — independently sourced, worth its own verification pass).
2. **Re-resolve PRAK IČO** for Bendl/Brabec — the correct entity is likely a dissolved
   "PRaK, a.s." under a different IČO than 49683144.
3. **58 registry-unconfirmed ties** are structurally out of ARES-VR's reach (special-law
   public bodies) — a different corroboration source (zákon establishing the body, or the
   body's own statute) would be needed if this population is ever prioritized; low urgency
   since these are steward-class by construction.
4. **pgvector subject-similarity** (Q-money-2) and the **donor-registry sponzoring pass**
   (Q-money-3, still blocked on `HLIDAC_API_TOKEN`) remain deferred.
5. **Write path** for the verification console (§5 of `handoff.md`, batch 001) is still the
   top build-ready item after O-money-2 — now more valuable since 260/260 ties carry a
   registry corroboration verdict for reviewers to act on.

### Batch 003 — human-review write path + Q-money-7 research (2026-07-24)

- **No army this batch** — population already 100% reconciled (batch 002). Scope: ship
  the write path (top build-ready item, three batches running) + re-resolve the PRaK IČO.
- **Build (O-money-4):** `ReviewRepository` + append-only `review_audit` table +
  `REVIEWER_NAME`/`REVIEWER_TOKEN`-gated server action + wired console (optimistic UI,
  honest error states). 5/5 new tests, 176/176 full suite, tsc clean. **Additive carve-out
  into `lib/db` used this batch only** (granted per the batch spec).
- **Q-money-7:** re-resolution candidate found — IČO 61858111 "PRaK, a.s. v likvidaci"
  (Praha–Kladno rychlodráha SPV, dissolved 2012), Bendl + Brabec both corroborated as
  board members. Medium confidence (downgraded from the research agent's "high" — ARES
  returns 404 for this IČO, entity outside the repo's primary corroboration path).
  Annotation only, not applied; open item is a Bendl end-date conflict (1999 vs 2002) and
  a needed `tieClass: steward` reclassification if ever re-pointed.
- **Opus reflection — the batch's most consequential output:** the write path holds its
  five stated hard rules in the FORWARD direction, but is **not yet durable**: the money
  ingest path (`kg-money.ts` + `kg.ts`'s wholesale-replace `upsertKgEdges`) silently
  reverts any human `verified` decision on the next `--commit` re-run (flag D1, HIGH,
  audit trail survives but nothing replays it), and the console's own "zapsáno: N" counter
  can report writes that failed (D3). **Recommendation: do not hand the console to a real
  reviewer until D1 closes.** Full defect list D1–D7 in `handoff.md` §2.
- **Build-review cadence note:** R=1 → a build shipped, but Opus assessed it unsafe for
  real use — **this does NOT count as a settled/converged ship.** Batch 004 must close
  D1 (+D3/D4/D5/D7) as its own build-review item before R resets.

## Metrics block — batch 003

| metric | batch 003 |
|---|---|
| units processed | 0 (no army — population already 100% reconciled) |
| build shipped | write-path (`ReviewRepository` + server action + console wiring) |
| build safety | **NOT durable** — Opus flag D1 (HIGH): human decisions lost on next ingest re-run |
| tests | 5/5 new (review repo, isolated temp-dir PGlite), 176/176 full suite, tsc clean |
| Q-money-7 | re-resolution candidate found (medium confidence), annotation only, not applied |
| Opus defects found | 8 total (1 HIGH, 5 MEDIUM, 2 LOW/MEDIUM) — see handoff.md §2 |

## Steering (next batch)

1. **Batch 004 = durability + honesty fix batch, NOT Q-money-2.** Close D1 (props-merge or
   audit-replay in the money ingest), D3 (optimistic-rollback on the console counter), D4
   (`revalidatePath`), D5 (runtime decision whitelist + DDL `CHECK`), D7 (decide whether
   `reject` needs a terminal state).
2. **Q-money-7 closure:** resolve the Bendl end-date conflict against a browser-rendered
   or.justice.cz úplný výpis; land as annotation + `tieClass: steward` reclassification if
   the edge is ever re-pointed — never a silent re-point.
3. **Q-money-2 (pgvector) → batch 005**, not before. Deferred three batches running
   (001, 002, 003) — Opus's recommendation: commit to it in 005 or retire it from the
   backlog rather than rolling it a fourth time.
4. Q-money-3 (sponzoring pass) stays blocked on `HLIDAC_API_TOKEN` (user gate).
5. Q-money-9 (new, batch 003): the ingest/human-write durability gap found in money is
   likely present in any other case-loop that layers a human write path onto a
   re-derivable ingest — worth a repo-wide audit, not just money-scoped.

### Batch 004 — D1 durability close + OSVČ purge prep + PRaK/Q-money-2 decided (2026-07-24)

- **No army this batch** — scope was the batch-003 steering list. D1 closed in TWO
  passes: an initial `mergePreservedTieProps` fix, then an Opus re-audit found two
  real gaps (`kg-promote.ts`'s own wholesale-replace risk on `linked_to`/`supplies`;
  6 live prop fields missing from the first preserve list, incl. a one-character
  `review_note`/`reviewer_note` near-miss present on 260/260 ties) — both closed in a
  second Sonnet pass, re-verified against the live graph. D3/D4/D5/D7 write-path
  polish all closed with tests (D5's DB `CHECK` only applies to freshly-created DBs —
  flagged, not silently accepted).
- **OSVČ purge (Q-money-11) prepared, not executed:** `GENERIC_NAME_BLACKLIST`
  ingest guard + `scripts/case-loops/money/purge-osvc.ts` dry-run, verified end-to-end
  on a scratch copy — 49/260 edges confirmed, all `false_edge_suspected`, company node
  qualifies for deletion structurally. Opus found a real caveat: 11 OTHER nodes'
  props (5 MP dossiers, 5 law citations) reference the company as text data, not as
  an edge — orchestrator must sequence a cross-loop cleanup note, not just execute
  the purge blind.
- **PRaK (Q-money-7): dead end.** 6 or.justice.cz-family URLs unreachable (JS-walled
  SPAs or genuine 404 on the dissolved entity). Kept as-is.
- **Q-money-2: RETIRED**, not deferred a fourth time — no pgvector/embeddings infra
  exists in the repo; running a new signal while the console was blocked and 19% of
  ties are confirmed false would be the wrong investment this batch.
- **Opus re-audit verdict:** initial fix PARTIAL (2 gaps found); after the closure
  pass, D1/D3/D4/D7 HOLD and D5's runtime whitelist HOLDS (DB-level CHECK caveat
  noted). Full detail + top risk flags in `batch-004.md` and `handoff.md`.
- 194/194 tests, tsc clean. No commit, no live write, no `review_state` flipped
  outside isolated fixtures.

## Metrics block — batch 004

| metric | batch 004 |
|---|---|
| units processed | 0 (no army — scope was durability/purge/decision work) |
| D1 durability | **CLOSED** (2 Sonnet passes + 1 Opus re-audit; merge-preserve proven end-to-end on isolated PGlite) |
| D3/D4/D5/D7 | **CLOSED** (D5's DB CHECK constraint caveat: live-DB migration still needed) |
| OSVČ purge (Q-money-11) | prepared, NOT executed — 49/260 edges confirmed, dry-run verified, cross-loop staleness flagged |
| PRaK (Q-money-7) | dead end — or.justice.cz unreachable, annotation kept as-is |
| Q-money-2 (pgvector) | **RETIRED** |
| tests | 194/194, tsc clean |
| console-enablement verdict | durability gate closed; recommend enabling AFTER the OSVČ purge executes and the orchestrator accepts/reverts the `lib/db` delete-method addition |

## Steering (next batch — batch 005)

1. **Orchestrator executes the OSVČ purge** (`purge-osvc.ts --commit` against live,
   with an explicit non-default `PGLITE_PATH` guard added first) + sequences the
   effort/law cross-loop cleanup for the 5+5 orphaned prop references.
2. **Enable the console** once the purge lands and the `lib/db` delete-method
   addition is reviewed/accepted.
3. **D5 DB-level CHECK migration** — add `ALTER TABLE review_audit ADD CONSTRAINT ...`
   so the live database (not just fresh test fixtures) enforces the decision whitelist.
4. Q-money-3 (sponzoring pass) stays blocked on `HLIDAC_API_TOKEN` (user gate).
5. Q-money-9 repo-wide audit (batch 003) still open — this batch's `kg-promote.ts`
   finding is a concrete instance of exactly that risk class, worth generalizing.

### Batch 005 — review-order triage + console session support + Q-money-13 + two lead dossiers (2026-07-25)

- **No fresh army over the tie population this batch** — 211 real ties
  (post-OSVČ-purge) were re-ranked, not re-enriched. Scope: batch-005
  priorities from `.claude/skills/money-loop.md` §"Batch-005 priorities".
- **Review-order triage + console build (priority #1):** deterministic
  `reviewTier`/`reviewRank` (registry-confirmed owner-operator → manager →
  steward → unconfirmed; money-desc within tier) now drives
  `getVerificationData.ts`'s primary sort and `/penize/kontrola`'s
  rendering order, with per-tier progress tiles, tier badges/section
  headers, sticky filter bar, and keyboard shortcuts shipped in
  `VerificationConsole.tsx`. `scripts/case-loops/money/triage.ts` mirrors
  the same logic. Distribution: tier0 (confirmed owner-op) 34, tier1
  (confirmed manager) 20, tier2 (confirmed steward) 125, tier3
  (unconfirmed) 32. Incidental fix: `triage.ts`'s `ledger.json` write was a
  blind overwrite wiping batch1–4 history — caught and fixed to
  merge-preserve.
- **D5 closure — live-table CHECK migration:** `migrate-review-audit-check.ts`
  built, dry-run-by-default, idempotent, pre-checks for violating rows,
  proven end-to-end on a scratch copy. Not yet applied to the live table —
  orchestrator command in `handoff.md` §2.
- **Q-money-13 done:** located the actual stale-mention population — **26
  prop-content mentions of purged IČO 04627695 across 24 distinct nodes**
  (19 effort `effort_notes`, 5 law `forensic_citations`/
  `forensic_conflict_assessment`), not the ~10 the batch spec estimated.
  Most effort dossiers had already independently flagged the IČO as a
  non-finding before the purge — the proposed payload appends a closure
  annotation rather than rewriting, preserving the original reasoning.
  Payload + coordination note for effort/law drivers in `handoff.md` §3.
- **Q-money-5 (Juchelka) and Q-money-6 (Okamura), both closed with full
  four-stage treatment + Opus verification:** Juchelka — evidence chain
  HOLDS on independent Opus re-fetch, but 3 corrections applied (a
  self-contradictory ministerial date, an over-broad registry negative,
  and a "reimbursement forfeited" overstatement); the real story is a
  structural conflict of interest around advisor Alexandra Semancová's
  SIPTRADE s.r.o., not personal enrichment by Juchelka, with 81.4M CZK in
  confirmed EU non-reimbursement. Okamura — evidence chain PARTIAL on
  independent Opus re-derivation from the primary ARES-VR endpoint; a
  fabricated successor detail (Wurst's share "increasing") that had
  silently propagated since batch 002 was corrected to the actual registry
  fact (Zákostelecký alone absorbed the full 10% stake, same day, exact
  value); Týden.cz was wrongly labeled independent of HlídacíPes (it
  credits HlídacíPes as source); a Sensepocket detail was mis-dated. Both
  dossiers now confidence medium, safe to land as `pending_review`
  annotations.
- **Process finding:** the Q-money-13 subagent initially stopped mid-task
  ("waiting for a background script") — a kernel-rule violation caught by
  the driver and resolved by resuming it directly; documented as a
  standing lesson (a subagent's own stop is not evidence of completion).
- Full detail, exact corrections applied, and all payload paths in
  `handoff.md` (batch 005).

## Metrics block — batch 005

| metric | batch 005 |
|---|---|
| units re-ranked (not re-enriched) | 211 / 211 (100%, post-purge population) |
| review-order tiers | tier0 34 · tier1 20 · tier2 125 · tier3 32 |
| D5 live-table CHECK migration | built + proven on scratch copy, **not yet applied live** |
| Q-money-13 stale mentions found | **26** across **24** nodes (vs ~10 estimated) — payload prepared, not applied (sibling-owned props) |
| Q-money-5 (Juchelka) | Opus verdict HOLDS, 3 corrections applied, confidence medium |
| Q-money-6 (Okamura) | Opus verdict PARTIAL, 5 corrections applied (1 fabricated detail corrected), confidence medium |
| tests | 205/205 (194 at batch-004 close), tsc clean, eslint clean on touched files |
| process defect caught | 1 subagent stopped mid-task, resumed correctly; 1 `ledger.json` overwrite bug found+fixed |

## Steering (next batch — batch 006)

1. **Orchestrator applies this batch's payloads**: the review-rank sort is
   already live in the console code (no orchestrator action needed to
   render it); the CHECK migration, Q-money-13 stale-mention payload, and
   both lead-dossier annotations need explicit orchestrator persist steps
   (commands in `handoff.md` §11).
2. **Coordinate Q-money-13 wording with the effort/law drivers** before
   applying — the payload proposes closure annotations on sibling-owned
   props, not a unilateral edit.
3. The batch-004 steering items (OSVČ purge live execution, console
   enablement, `lib/db` delete-method sign-off, Q-money-9 repo-wide audit)
   remain open if not yet actioned by the orchestrator — batch 005 assumed
   the purge had already landed (211, not 260, ties observed) but did not
   itself verify the live purge ran; confirm before treating tier counts
   as final.
4. Q-money-3 (sponzoring pass) stays blocked on `HLIDAC_API_TOKEN`.
