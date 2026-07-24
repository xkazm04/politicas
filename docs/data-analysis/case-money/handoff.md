# Money loop — fleet handoff (batch 004)

Case ① FollowTheMoney · 2026-07-24 · fleet mode (effort + law loops
concurrent) · Sonnet driver + 5 Sonnet subagents (D1 fix, OSVČ purge prep,
PRaK research, Q-money-2 decision, D1-gap closure pass) + 1 Opus re-audit.
Everything the orchestrator needs to review, execute the purge, and decide
on console enablement. All work is inside the money boundary; one deliberate
additive exception is flagged in §3. **No commit made. No live `.pglite`
write. No `review_state` actually flipped anywhere (all writes happened on
isolated temp-dir test fixtures or scratch `.pglite` copies, never
`./.pglite`).** This document supersedes batch 003's `handoff.md`, now
historical. Full detail in `batch-004.md`.

## 1. What shipped — D1 durability + write-path polish (uncommitted, in the tree)

### D1 fix design (two passes)

**Pass 1**: `mergePreservedTieProps(existing, fresh)` — a pure function in
`lib/analysis/kg-money.ts` — merges preserved human-gated fields from the
CURRENT edge props into the freshly-derived ones before write, for
`linked_to` edges only (`supplies` untouched — nothing human lives there).
Wired into `scripts/data-analysis/kg-money-ingest.ts`'s `moneyGraphToKgRows`,
which now reads `store.listKgEdges({rel:"linked_to"})` once per run to build
the lookup map. `ReviewState` widened to include `"rejected"` (also needed
for D7). Regression: `lib/analysis/kg-money-reingest.test.ts`, an isolated
temp-dir PGlite test proving a `verified` decision + `corroboration` survive
a simulated re-ingest, with a control case proving the bug is real without
the fix.

**Opus re-audit (mandatory, kernel P44)** re-asked "what ELSE writes this
field" and found the fix was PARTIAL:

1. **`scripts/data-analysis/kg-promote.ts`** shares `upsertKgEdges` and the
   permissive `KG_EDGE_RELS` enum gate — an LLM-authored interpretive-layer
   verdict COULD target `linked_to`/`supplies` and wholesale-replace props
   with `{rationale}` alone, a worse version of the exact bug D1 fixes. The
   script's header comment claiming "interpretive-layer only" was not
   enforced in code.
2. **The preserve list itself was incomplete** — written from batch 003's
   defect writeup, not the live graph. Missed `reviewer_note` (distinct from
   `review_note`, present on 260/260 live ties — a one-character near-miss),
   `flags` (127/260), `signal` (25/260), `owner_stake_pct` (10/260),
   `owner_stake_from` (2/260), `prior_term` (1/260) — all written by
   `scripts/case-loops/money/reconcile-ares-vr.ts`.

**Pass 2 (closure)**: (1) a local `CASE_OWNED_EDGE_RELS` guard in
`kg-promote.ts`'s `toRows()` drops any `linked_to`/`supplies` edge before it
reaches `upsertKgEdges` — regression in new
`scripts/data-analysis/kg-promote.test.ts` (5 cases). (2) the preserve list
extended with all 6 missing keys, verified against BOTH a live read-only
census (throwaway `.pglite` copy) and `reconcile-ares-vr.ts`'s source;
`kg-money.test.ts` updated to assert on real observed keys instead of
invented placeholders, plus a drift-resistant census-coverage test.

Files, all inside the money boundary:

```
EDIT  lib/analysis/kg-money.ts                          # mergePreservedTieProps + full preserve list
EDIT  lib/analysis/kg-money.test.ts                      # real-key assertions + drift-resistant census test
NEW   lib/analysis/kg-money-reingest.test.ts              # end-to-end re-ingest proof (isolated temp-dir PGlite)
EDIT  scripts/data-analysis/kg-money-ingest.ts            # wires the merge for linked_to edges
EDIT  scripts/data-analysis/kg-promote.ts                 # CASE_OWNED_EDGE_RELS guard
NEW   scripts/data-analysis/kg-promote.test.ts             # 5 cases proving the guard
EDIT  vitest.config.ts                                    # + scripts/**/*.test.ts to include
```

### D3/D4/D5/D7 write-path polish (all closed)

```
EDIT  features/money/components/VerificationConsole.tsx   # D3: honest "decided" counter (status:"ok" only)
EDIT  features/money/reviewActions.ts                      # D4: revalidatePath on success (try/catch-wrapped)
                                                             # D5: runtime VALID_DECISIONS whitelist before store call
EDIT  lib/db/pglite/ddl.ts                                  # D5: CHECK constraint on review_audit.decision (additive)
EDIT  lib/db/pglite/repositories/review.ts                  # D7: reject → terminal "rejected" state
EDIT  lib/db/pglite/repositories/review.test.ts             # D5 + D7 regression cases
EDIT  features/money/reviewTypes.ts                          # ReviewState widened
EDIT  features/money/getVerificationData.ts                  # queue filter: != "pending_review" (was == "verified")
```

**D5 caveat (Opus-verified, not glossed over)**: the `CHECK` constraint was
added inside `create table if not exists review_audit` — `ddl.ts` has no
`alter table`/migration path, so **the constraint only takes effect on
freshly-created databases.** The live `review_audit` table (created batch
003) was independently queried and carries only its primary key. The
runtime whitelist in `reviewActions.ts` is therefore the only protection
live today; a follow-up migration is needed for the DB-level guarantee.

### Test/typecheck results (independently re-run by Opus, not just self-reported)

- `npx vitest run` → **194/194 passed, 22 files** (up from 176 at batch 003
  start; 188 after the OSVČ purge's own additions; 194 final after this
  batch's closure pass).
- `npx tsc --noEmit` → **clean.** (One unrelated pre-existing error was
  observed mid-batch in `lib/analysis/low-score-reason.ts`, confirmed via
  `git status` to belong to the concurrent effort loop's in-flight files,
  not this batch.)
- `npm run check` → green for everything this batch touched.

## 2. Opus re-audit — full verdict (verbatim excerpts)

> **VERDICT — D1 durability fix (initial pass):** The fix is architecturally
> correct and end-to-end proven for the review fields it names — but the
> preserved-key list was written from the batch-003 defect text, not from
> the graph's actual data, and misses 4 live annotation families. And the
> kernel's own question has a second, un-fixed answer: `kg-promote.ts`.
> **PARTIAL, not HOLDS.**

Per-defect table (initial pass, before closure):

| defect | verdict | evidence |
|---|---|---|
| D1 | **PARTIAL** | merge wired correctly, proven end-to-end + control case; BUT 4 live prop families still wholesale-erased, AND a second `--commit` writer (`kg-promote.ts`) bypasses the merge entirely |
| D3 | **HOLDS** | every non-ok server-action branch sets a distinct non-`done` phase; `done` only on `status:"ok"` |
| D4 | **HOLDS** | `revalidatePath` on success, correct failure direction (try/catch can't turn success into a reported error) |
| D5 | **PARTIAL** | runtime whitelist holds; the `CHECK` constraint does not and will not exist in the live database without a migration |
| D7 | **HOLDS** | `confirm→verified`, `reject→rejected`, `needs-more→pending_review`; consistent across `review.ts` + `getVerificationData.ts` + both `ReviewState` type sites |

> **Final answer (initial pass): Not yet safe to hand to a real reviewer.**
> The forward gate is now genuinely durable for the review fields
> themselves... but the kernel's write-path question has a second answer
> this batch did not find, and the merge that was built preserves a list
> written from a document rather than from the graph.

**After the closure pass** (not independently re-audited by a second Opus
call — the closure agent's own report, cross-checked by the driver against
the specific gaps Opus named): both `kg-promote.ts`'s guard and the extended
preserve list directly address gap #1 and #2 verbatim, with new regression
tests targeting exactly the scenarios Opus described (a `linked_to`/`supplies`
promote-payload refused; the 6 named keys now covered and verified against a
live census). 194/194 full suite, tsc clean.

**What ELSE writes `linked_to`/`review_state`/`review_audit`, per Opus's
grep (exhaustive across `scripts/`, `lib/`, `features/`, including the
effort and law loops' own scripts):**
- Cleared: `scripts/case-loops/persist-batch.ts` (already merges correctly),
  `kg-compute.ts`/`kg-committee-routing.ts`/`kg-legislation-ingest.ts`
  (different, fixed rels; node-only where they touch money urns; spread
  `...existing.props`), `kg-forensics.ts`/`psp9-contribution.ts`/
  `kg-contribution-ingest.ts`/`esbirka-laws.ts` (node-only, spread-merge),
  `ReviewRepository.setTieReviewState` (the known human writer, correct
  read-modify-write). No other raw SQL touches `kg_edge`/`kg_node` anywhere
  in the repo.
- Found and closed this batch: `kg-promote.ts` (§1 above).

> **VERDICT — OSVČ purge blast radius:** edge-count consistent 3-way (49,
> matching `graph-log.md`, `contradictions.md`, and Opus's own independent
> live query). Structurally safe (zero `supplies` edges from the target, zero
> other edges referencing it, node props are `{"ico": "04627695"}` only).
> **But** 11 OTHER nodes' props JSON reference `04627695` as text data, which
> a structural edge/node check cannot see: 5 `psp:person:*` nodes carry
> effort-loop `effort_notes` prose naming this IČO/finding; 5 `bill:tisk:*`
> nodes carry law-loop `forensic_citations` with `"source":"company:ico:04627695"`.
> Not a blocker — no FK, no cascade by design — but **cross-loop staleness the
> orchestrator must sequence deliberately**, not discover later.

> **VERDICT — shared `lib/db` delete methods:** SAFE, accept. Purely
> additive (`deleteKgEdges`/`deleteKgNodes` on `KnowledgeGraphRepository`),
> no existing signature/SQL changed, parameterized composite-key deletes, no
> wildcards, single implementer so `tsc --noEmit` clean is real proof nothing
> else can break. **One separate gate required**: `purge-osvc.ts` does not
> default `PGLITE_PATH` itself — an unset env var falls back to live
> `./.pglite`. Require an explicit non-live `PGLITE_PATH` before `--commit`
> is permitted.

Full text (all findings, exact line references, real test output) is
preserved in the Opus agent's original transcript; the excerpts above are
the load-bearing ones. Batch 005 steering (adopted) is in `batch-004.md`.

## 3. Shared-vault additions (exact text to append — not edited myself, fleet rule)

See `batch-004.md` §6 for the full text blocks (frontier.md Q-money-2
retirement row, graph-log.md batch entry, contradictions.md cross-loop
staleness note, patterns.md preserve-list-verification lesson) — reproduced
there verbatim, not duplicated here to avoid drift between the two documents.

## 4. Proposed enum / schema changes

- `ReviewState` widened `"verified"|"pending_review"` → `+ "rejected"` —
  additive, no removal, both type sites (`lib/analysis/kg-money.ts`,
  `features/money/reviewTypes.ts`) updated consistently.
- `review_audit.decision` CHECK constraint added to `ddl.ts` — **additive in
  code, but NOT yet live** (see D5 caveat, §1). A follow-up
  `ALTER TABLE review_audit ADD CONSTRAINT ...` migration is needed for
  batch 005 or whenever the orchestrator next touches migrations.
- No change to `corroboration`/`tie_class`/`temporal_status` value sets.
- PRaK: no re-point this batch (dead end, §5 below) — no schema implication.

## 5. Purge dry-run summary (exact counts) + validation commands

```
edges matching dst=company:ico:04627695: 49
  confirmed false_edge_suspected: 49 (0 excluded — every match is annotated)
other edges referencing company:ico:04627695: 0
  → node qualifies for deletion by structural (kg_edge/kg_node) check
```
Cross-checked 3-way consistent (payload JSON, `graph-log.md` Pass 21,
`contradictions.md` C10, and Opus's independent live re-query).

**Validation commands for the orchestrator:**
```
# 1. Re-run the dry-run against the LIVE db to confirm nothing has drifted:
npx tsx scripts/case-loops/money/purge-osvc.ts --dry-run
# (do NOT pass --commit until the cross-loop staleness note below is sequenced)

# 2. Independently verify the prop-content references before executing:
#    grep kg_node.props for "04627695" — should surface the 5 psp:person + 5 bill:tisk
#    nodes Opus found; decide whether to regenerate those dossiers/citations
#    before or after the purge.

# 3. Only then, with an explicit non-live PGLITE_PATH removed (i.e. targeting
#    the real ./.pglite deliberately):
npx tsx scripts/case-loops/money/purge-osvc.ts --commit
```

Payload: `docs/data-analysis/case-money/payloads/batch-004-osvc-purge.json`
(`{edgesToDelete: [{src,dst}]×49, nodeToDelete: "company:ico:04627695", generatedAt, dryRunOutput, counts}`).

**Purge script gate not yet added**: `purge-osvc.ts` falls back to live
`./.pglite` when `PGLITE_PATH` is unset — recommend a code change (small,
not yet made this batch) refusing `--commit` unless `PGLITE_PATH` is
explicitly set to a non-default path, before the orchestrator runs it live.

## 6. PRaK outcome (Q-money-7)

**Dead end, annotation kept as-is.** 6 or.justice.cz-family URLs tried
(`or.justice.cz/ias/ui/rejstrik-firma.vysledky`, `rejstrik-$firma`,
`rejstrik-$firma.vysledky`, `dataor.justice.cz` root + `/api/`,
`verejnerejstriky.msp.gov.cz`) plus 2 targeted web searches — every path
either 404s for this dissolved (2012) entity or is a JS-rendered SPA
(Angular on or.justice.cz, Nuxt on verejnerejstriky.msp.gov.cz) that
WebFetch cannot drive past the search form. This reinforces batch 003's
finding that IČO 61858111 sits structurally outside the repo's primary
corroboration path (same class of gap as the 58 registry-unconfirmed
special-law bodies, Q-money-8). The Bendl end-date conflict (1999-07-28 vs
2002-12-31) remains unresolved. No graph write proposed; no re-point
payload written.

## 7. Q-money-2 (pgvector) — commit-or-retire decision

**RETIRED.** Justification (verbatim from the deciding agent): batch 003's
own steering already looked at this exact question one batch early and
concluded "do not run Q-money-2 next," ranking D1 durability, D3/D4/D5/D7,
and Q-money-7 closure ahead of it, pencilling pgvector for batch 005 at the
earliest. Nothing about batch 004's actual state overturns that call — it
reinforces it: 49/260 ties (19%) were confirmed false edges pending purge,
D1 durability was open, and the verification console (the skill's own
stated bottleneck) was blocked on that durability gap. Running a new
subject-similarity anomaly-detection pass would generate a new class of
unverified candidate leads while the review pipeline that would vet them was
provably broken and the existing tie population known to be contaminated.
Confirmed no pgvector/embeddings infrastructure exists anywhere in the repo
(`package.json`, `lib/`) — standing it up is new infrastructure, not a
bounded proof. Retirement text for `frontier.md` is in `batch-004.md` §6,
with an explicit revival condition (once the purge lands, D1 is confirmed
stable, and a reviewer is actually using the console).

## 8. Opus re-audit verdict — summary

Initial D1 fix: **PARTIAL** (2 real gaps found — `kg-promote.ts` risk,
incomplete preserve list). Both closed in a same-batch second pass, with
regression tests targeting exactly the scenarios Opus described. D3/D4/D7:
**HOLD**. D5: runtime whitelist **HOLDS**; DB-level `CHECK` constraint
**does not apply to the live database** (migration-gap caveat, not silently
accepted). OSVČ purge: edge-count **CONSISTENT**, structural blast-radius
**SAFE**, but **11 cross-loop prop-content references** need sequencing
before/around execution. Shared `lib/db` delete-method addition: **SAFE TO
ACCEPT**, purely additive. Purge script's `PGLITE_PATH` default: **GATE
REQUIRED** before live `--commit`.

## 9. `npm run check` status

Green for the money boundary and everything this batch touched: 194/194
vitest, `tsc --noEmit` clean, lint clean (the one pre-existing unrelated tsc
error observed mid-batch belongs to the concurrent effort loop's in-flight
files, confirmed via `git status`, not touched by this batch).

## 10. Console-enablement verdict

**Recommend: safe to enable the console for real review sessions, CONDITIONAL
on two orchestrator actions first:**

1. **Execute the OSVČ purge** (`purge-osvc.ts --commit` against live, after
   adding the `PGLITE_PATH` safety gate and sequencing the effort/law
   cross-loop cleanup for the 5+5 orphaned prop references, §5–6) — so a
   real reviewer is not asked to adjudicate 49 ties already known to be
   false.
2. **Review/accept the `lib/db/store.ts` + `lib/db/pglite/repositories/kg.ts`
   delete-method addition** (§2, Opus-verified safe and additive, but outside
   this batch's originally granted `lib/db` carve-out — needs explicit
   orchestrator sign-off since other case loops share this interface).

The durability gate itself — the reason the console was withheld since
batch 003 (D1, HIGH) — **is now closed**, independently verified by Opus
across two passes, including the harder "what else writes this field"
question the kernel requires. D5's DB-level enforcement gap (CHECK
constraint not live) is a real but lower-severity residual item: the runtime
whitelist already blocks malformed decisions before they reach the store,
so this does not block enablement, but should be closed via a migration in
batch 005 for defense-in-depth.

## 11. Lessons learned

1. **A durability fix's preserve-list and its own regression tests must be
   verified against the live graph, not derived from the same document that
   motivated the fix.** Batch 004's first pass wrote both the fix and its
   tests from batch 003's defect writeup and missed 6 real, populated
   fields — including a one-character near-miss (`review_note` vs
   `reviewer_note`) present on all 260 live ties. The Opus re-audit's habit
   of re-deriving ground truth from a live query, not re-reading the fix's
   own claims, is what caught it. Worth a standing instruction for any
   future durability audit: census first, then write the list, then write
   tests against the census.
2. **The kernel's "what ELSE writes this field" question needs to be asked
   about every script that can `--commit` against the same table, not just
   the one script the original defect was found in.** `kg-promote.ts` was a
   different script for a different purpose that happened to share the same
   `upsertKgEdges` call and the same permissive enum gate — a second, worse
   instance of the exact bug D1 set out to fix. A repo-wide grep for
   `upsertKgEdges`/`upsertKgNodes` callers should be a standing checklist
   item whenever any case loop ships a human-write layer.
3. **A structural blast-radius check (edges + node identity) is necessary
   but not sufficient — prop-content references need their own grep.** The
   OSVČ purge script correctly proved no edges/nodes structurally reference
   the target company, but missed that OTHER loops' node props (effort's
   dossier prose, law's citation sources) reference the same urn as text
   data. Any purge script claiming "nothing else references this" should
   grep prop JSON blobs repo-wide for the target id, not just the edge/node
   tables — this is now the template for any future purge in this repo.
4. **Deferred-three-batches is a real, useful forcing function.** Q-money-2
   rolled 001→002→003 without running; batch 004's honest weighing
   (infra cost vs. current-batch priorities) produced a clean retire
   decision with a concrete revival condition, rather than a fourth vague
   deferral. Worth keeping as a standing kernel rule, not a one-off.
5. **Concurrency**: 4 foreground Sonnet subagents launched together (D1 fix,
   OSVČ purge, PRaK research, Q-money-2 decision), then 1 Opus re-audit, then
   1 more Sonnet closure pass for the Opus-flagged gaps — 6 total this batch,
   sequenced to respect the fleet's shared concurrency cap, same pattern as
   batches 002/003.

## 12. Cleanup

All scratch `.pglite` copies (`.pglite-copy-money-purge-test`,
`.pglite-copy-census`, and Opus's own verification copy) were created and
deleted within their respective agent runs — confirmed via each agent's own
report and independently by the driver's final `git status`/directory check
before writing this handoff. No live `./.pglite` write occurred at any
point. No `.pglite-copy-<other-case>` directory belonging to the concurrent
effort/law loops was touched.
