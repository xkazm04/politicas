# Money batch 004 — durability fix + OSVČ purge prep + PRaK closure + Q-money-2 decision

Case ① FollowTheMoney · 2026-07-24 · fleet mode (effort + law loops concurrent) ·
Sonnet driver + 5 Sonnet subagents (D1 fix, OSVČ purge, PRaK research, Q-money-2
decision, D1-gap closure) + 1 Opus re-audit. No army this batch — population
already 100% reconciled (batch 002); scope was the batch-003 steering: close
D1/D3/D4/D5/D7, purge the OSVČ false-edge class, resolve or retire PRaK and
Q-money-2. **No commit made. No live `.pglite` write. No `review_state`
actually flipped anywhere except isolated temp-dir/copy test fixtures.**

## 1. D1 — ingest durability (closed, two passes)

**Pass 1 (Sonnet):** `mergePreservedTieProps(existing, fresh)` added to
`lib/analysis/kg-money.ts` (pure, DB-free) and wired into
`scripts/data-analysis/kg-money-ingest.ts`'s `moneyGraphToKgRows` for
`linked_to` edges only — reads current edge props via one
`store.listKgEdges({rel:"linked_to"})` call per run, merges before upsert.
Preserved keys (existing wins): `review_state`, `last_decision`,
`last_reviewer`, `last_reviewed_at`, `review_note`, `corroboration*`,
`role_valid_*`, `temporal_status`, `tie_class`, `false_edge_*`,
`*_provenance`. Regression: new `lib/analysis/kg-money-reingest.test.ts` on
an isolated temp-dir PGlite proves a `verified` decision + a `corroboration`
prop survive a simulated re-ingest, with a control test proving the bug is
real absent the fix. `upsertKgEdges`'s wholesale-replace semantics in
`lib/db/pglite/repositories/kg.ts` were **not** touched (shared, by design).

**Opus re-audit (mandatory per kernel P44 — "what ELSE writes this field")
found two real gaps**, both closed in a second Sonnet pass this same batch:

1. **`scripts/data-analysis/kg-promote.ts`** could wholesale-replace any
   `linked_to`/`supplies` edge's props with `{rationale}` alone —
   `linked_to`/`supplies` are members of the shared `KG_EDGE_RELS` enum this
   script's gate validates against, and its header comment claiming
   "interpretive-layer only" was not enforced in code. **Fixed**: a local
   `CASE_OWNED_EDGE_RELS` guard inside `toRows()` drops any edge whose `rel`
   is `linked_to`/`supplies` before it's ever built into a row — money-owned
   (and any other case's) human-gated edges must go through their own
   merge-preserving ingest, never the generic promotion path. Regression:
   new `scripts/data-analysis/kg-promote.test.ts` (5 cases).
2. **The preserve list was derived from the batch-003 defect writeup, not
   the live graph** — missed `reviewer_note` (a one-character near-miss vs.
   `review_note`, present on 260/260 ties), `flags` (127/260), `signal`
   (25/260), `owner_stake_pct` (10/260), `owner_stake_from` (2/260),
   `prior_term` (1/260) — all written by
   `scripts/case-loops/money/reconcile-ares-vr.ts`. **Fixed**: preserve list
   extended, verified against BOTH a live read-only census (throwaway
   `.pglite` copy, cleaned up) and `reconcile-ares-vr.ts`'s source. Tests in
   `kg-money.test.ts` now assert on real observed keys (not invented
   placeholders) plus a drift-resistant test asserting every key from a
   hardcoded live-census snapshot is covered.

Final state: `npx vitest run` → **194/194 passed** (22 files, after both
passes); `npx tsc --noEmit` → clean. `vitest.config.ts` gained
`scripts/**/*.test.ts` to its `include` (previously `lib/**/*.test.ts` only
— no `scripts/` tests existed before this batch).

## 2. D3/D4/D5/D7 — write-path polish (all closed)

- **D3** (honest counter): `VerificationConsole.tsx`'s `decidedCount` now
  only counts writes whose server result was `status:"ok"`.
- **D4** (staleness): `reviewActions.ts` calls `revalidatePath("/penize/kontrola")`
  on success, wrapped in try/catch so a revalidation failure outside a
  request scope can't turn a real success into a reported error.
- **D5** (audit integrity): runtime `VALID_DECISIONS` whitelist in
  `reviewActions.ts` before any store call; `review_audit.decision` gained a
  `CHECK (decision in ('confirm','reject','needs-more'))` in
  `lib/db/pglite/ddl.ts`. **Caveat (Opus-verified): the CHECK constraint
  only exists in freshly-created databases** — `ddl.ts` has no
  `alter table`/migration path, and the live `review_audit` table (created
  in batch 003) was verified to carry only its primary key. The runtime
  whitelist is therefore the only protection live, until a migration lands
  a matching `ALTER TABLE ... ADD CONSTRAINT`. Flagged for the orchestrator,
  not silently glossed over.
- **D7** (terminal state): `reject` now sets `review_state:"rejected"`
  (new terminal value) in `review.ts`; `needs-more` still yields
  `pending_review` (deliberately — "come back to this"). Queue filter in
  `getVerificationData.ts` changed to `if (reviewState !== "pending_review") continue`,
  so rejected ties drop out exactly like verified ones. No dedicated
  rejected-state badge was added since the console only ever renders what
  the queue returns and rejected ties never appear there — documented
  inline.

## 3. OSVČ purge (Q-money-11) — prepared, not executed

**Confirmed root cause**: IČO 04627695 (Agrární demokratická strana, a
registered micro party) has ARES `obchodniJmeno` literally `"OSVČ"`
(self-employed) — every self-employed MP's exact-name pick matched this one
bogus entity. **49/260 ties**, all `contractCzk: 0`.

**Ingest-side fix**: `GENERIC_NAME_BLACKLIST = ["OSVČ"]` (one entry — the
only token with actual evidence in the data; "advokát" from
`contradictions.md` C10 was illustrative prose, never an observed `company`
value) guards both the query name and the matched candidate's
`obchodniJmeno` inside `pickExactIco()` in `lib/analysis/money-feed.ts`.
Regression test in `money-feed.test.ts` proves an "OSVČ"-named ARES
candidate never resolves (case/diacritic/whitespace variants included).

**Purge script**: `scripts/case-loops/money/purge-osvc.ts`, `--dry-run`
default (the `kg-money-ingest.ts` `--commit` opt-in convention). Verified
end-to-end against a scratch `.pglite` copy (never live), then deleted:

```
edges matching dst=company:ico:04627695: 49
  confirmed false_edge_suspected: 49 (0 excluded)
other edges referencing the company: 0 → node qualifies for deletion
```

`--commit` was proven only against the scratch copy (deleted 49 edges + 1
node, re-queried to confirm 0 remain). Payload:
`docs/data-analysis/case-money/payloads/batch-004-osvc-purge.json`.

**Opus verification**: edge count is consistent 3-way (payload ↔
`graph-log.md` Pass 21 ↔ `contradictions.md` C10 ↔ Opus's own independent
live query — all 49). Structural blast-radius (edges/node props) is
genuinely clean. **But** a `props`-content grep the purge script doesn't run
found **11 other nodes whose `props` JSON blobs reference `04627695` as
data, not as an edge**: 5 `psp:person:*` nodes carry effort-loop
`effort_notes` prose naming this IČO/finding, and 5 `bill:tisk:*` nodes
carry law-loop `forensic_citations` with `"source":"company:ico:04627695"`.
None of these are foreign keys and none block the delete, but **after the
purge, 5 law-forensics verdicts will cite a `source` urn that no longer
resolves, and 5 MP dossiers will describe a tie that no longer exists** —
cross-loop staleness the orchestrator must sequence deliberately (a note in
`graph-log.md` at minimum; ideally a regeneration pass by effort/law), not
discover later.

**Boundary deviation to flag**: to build the delete path, the purge agent
added `deleteKgEdges`/`deleteKgNodes` to `lib/db/store.ts` and
`lib/db/pglite/repositories/kg.ts` — outside this batch's granted `lib/db`
carve-out (scoped to D5/D7 review-audit pieces only). Opus reviewed the
actual diff: **purely additive** (no existing signature/behavior changed,
`tsc --noEmit` clean, single implementer of the interface so nothing else
can break), parameterized composite-key deletes, no wildcards. **Verdict:
safe to accept**, but flag it as a batch-004 addition to shared code for the
orchestrator's own sign-off, since other case loops also depend on this
interface.

**Second flag**: `purge-osvc.ts` does not default `PGLITE_PATH` itself —
an unset env var falls back to **live `./.pglite`**. The dry-run that was
actually run set `PGLITE_PATH` to the scratch copy explicitly. In fleet
mode, one `--commit` invocation without that env var is an unserialized
live delete. **Recommend the script refuse `--commit` when `PGLITE_PATH` is
unset or equals the live path**, before the orchestrator runs it for real.

## 4. PRaK (Q-money-7) — dead end, kept as-is

6 or.justice.cz/dataor.justice.cz/verejnerejstriky.msp.gov.cz URL variants
+ 2 targeted web searches, all either 404 for this dissolved (2012) entity
or architecturally JS-rendered SPAs (Angular/Nuxt) WebFetch can't drive past
the search form. This reinforces batch 003's finding that IČO 61858111 sits
structurally outside the repo's primary-source corroboration path. **No
graph change proposed.** The Bendl end-date conflict (1999-07-28 vs
2002-12-31) stays unresolved and annotated as medium-confidence, as-is.

## 5. Q-money-2 (pgvector) — RETIRED

Deferred three batches (001→002→003) is the kernel's hard limit. Decision:
**retire**, not run. Batch 003's own steering had already ranked D1
durability + the OSVČ purge + PRaK above it and pencilled it for batch 005
at the earliest. Batch 004 confirms no pgvector/embeddings infrastructure
exists anywhere in the repo — standing it up would be new infrastructure,
not a bounded proof. Running a new anomaly-detection signal while 19% of the
tie population (49/260) is confirmed false and the verification console was
(until this batch) blocked on D1 would generate unverified leads for a
review pipeline provably not usable yet. Retirement text for
`frontier.md` in §6 below (fleet rule — not applied directly, driver hands
it to the orchestrator).

## 6. Shared-vault additions (exact text to append — not edited myself, fleet rule)

### → `docs/data-analysis/frontier.md`

```
| Q-money-2 | pgvector contract-splitting | **RETIRED (batch 004)** — deferred 001→002→003 without running; batch 003's own steering already ranked D1 durability + Q-money-11 false-edge purge + Q-money-7 above it and pencilled it for 005, not 004. Batch 004 confirms no pgvector/embeddings infra exists anywhere in the repo (checked package.json, lib/) — standing it up is new infrastructure, not a bounded proof. Running a new anomaly-detection signal while 49/260 ties (19%) are confirmed false edges pending purge and the verification console was blocked on D1 would generate unverified leads for a review pipeline that's provably not usable yet. Revive once the Q-money-11 purge lands, D1 durability is confirmed stable, and the verification console has an actual reviewer using it on the (now clean) 211-tie population — at that point subject-similarity splitting is a legitimate next signal, not before. | retired |
```

### → `docs/data-analysis/graph-log.md`

```
2026-07-24 · money batch 004 (D1 durability fix + write-path polish + OSVČ purge prep + PRaK dead-end + Q-money-2 retired, Sonnet driver/army + Opus re-audit) · NO GRAPH WRITE THIS BATCH. D1 merge-preserve fix (2 passes, Opus caught 2 real gaps in pass 1, both closed in pass 2) landed in code, proven on isolated temp-dir PGlite only. OSVČ purge (49 edges + company:ico:04627695 node) prepared as a dry-run script + payload, NOT executed — orchestrator to run against live after sequencing the cross-loop staleness note below. PRaK: or.justice.cz unreachable (6 URL variants tried), annotation kept as-is. Q-money-2 retired (see frontier.md).
```

### → `docs/data-analysis/contradictions.md`

```
## [[contradictions]] Money batch 004 — OSVČ purge will orphan 5 law-forensics citations + 5 MP dossier notes
The prepared OSVČ purge (49 linked_to edges + company:ico:04627695 node, see batch-004.md §3) is structurally clean by kg_edge/kg_node graph checks, but an Opus content-grep found 11 OTHER nodes whose props JSON references 04627695 as data: 5 psp:person:* nodes carry effort-loop effort_notes prose naming this IČO as a finding, and 5 bill:tisk:* nodes carry law-loop forensic_citations with "source":"company:ico:04627695". These are not FKs and don't block the delete, but once the purge executes, 5 law verdicts will cite a source urn that no longer resolves and 5 MP dossiers will describe a tie that no longer exists. The orchestrator should sequence the purge with an effort/law regeneration pass (or at minimum a graph-log note at execution time), not let another loop discover the dangling reference independently.
```

### → `docs/data-analysis/patterns.md`

```
## [[patterns]] Money · a preserve-list for a human-write durability fix must be verified against the live graph, not just the defect writeup that motivated it (money batch 004)
Batch 004's first D1 fix pass wrote its preserved-key list from batch 003's Opus defect text (review_state, last_decision, corroboration*, etc.) and its own regression tests asserted on invented placeholder keys (corroboration_note, role_provenance) that don't exist in the data. A second Opus re-audit queried the LIVE graph's actual prop keys and found 6 real, populated fields the list missed — including a one-character near-miss (review_note vs reviewer_note, the latter present on 260/260 ties). Both the fix and its own tests were derived from the same document, so neither could catch the gap. Any future preserve-list/durability fix should be verified against a live-data census (jsonb_object_keys over a throwaway copy) BEFORE writing tests, and the tests should assert coverage against that census, not against invented examples.
```

## 7. Proposed enum / schema changes

- No enum value changes. `ReviewState` (both `lib/analysis/kg-money.ts` and
  `features/money/reviewTypes.ts`) widened from `"verified"|"pending_review"`
  to `"verified"|"pending_review"|"rejected"` — additive, not a removal.
- `review_audit.decision` gained a `CHECK` constraint in `ddl.ts` — but see
  §2's caveat: it only takes effect on freshly-created databases; the live
  `review_audit` table (created batch 003) does not have it. A follow-up
  migration (`ALTER TABLE review_audit ADD CONSTRAINT ...`) is needed if the
  orchestrator wants the constraint live, not just in test fixtures.

## 8. Commit plan (orchestrator — per-case commit)

Suggested message:
```
fix(case-money): D1 ingest durability + write-path polish (D3/D4/D5/D7) + OSVČ purge prep

Closes the D1 durability gap (Opus-flagged batch 003, HIGH): a merge-preserving
write path (mergePreservedTieProps) now protects human review decisions AND
corroboration evidence across re-ingest, extended after an Opus re-audit found
two real gaps (kg-promote.ts's wholesale-replace risk on linked_to/supplies,
and 6 live prop fields missing from the first-pass preserve list). Also closes
D3 (honest write counter), D4 (revalidatePath), D5 (decision whitelist + CHECK),
D7 (terminal rejected state). Ships (dry-run only, not executed) the OSVČ
false-edge purge prep for the 49/260 ties wrongly linked to company:ico:04627695.
194/194 tests, tsc clean. PRaK (Q-money-7) confirmed a dead end via 6 or.justice.cz
URL attempts. Q-money-2 (pgvector) retired per the kernel's deferred-3-batches rule.
```

**Console-enablement verdict**: after both the initial fix and the Opus-flagged
gap closure, D1/D3/D4/D5(runtime)/D7 all hold under independent Opus
verification, with real regression tests exercising the actual store (not
just self-report). D5's DB-level CHECK is not yet live (needs a migration).
**Recommend: safe to enable the console for real review sessions once (a)
the OSVČ purge executes (so a reviewer isn't asked to adjudicate 49 known-false
ties) and (b) the orchestrator accepts or reverts the `lib/db/store.ts`
delete-method addition.** The durability gate itself — the reason the console
was withheld since batch 003 — is now closed. See §9 lessons for the residual
caveat on D5.

## 9. Lessons learned

1. **A durability fix's preserve-list and its own regression tests must be
   verified against the live graph, not derived from the same document that
   motivated the fix** — batch 004's first pass wrote both from batch 003's
   defect text and missed 6 real, populated fields as a result (see patterns.md
   addition). The Opus re-audit's habit of re-deriving ground truth from a
   live query (rather than re-reading the fix's own claims) is what caught
   it — worth keeping as a standing instruction for any future durability
   audit, not just this one.
2. **The kernel's "what ELSE writes this field" question needs to be asked
   about EVERY script that can `--commit` against the same table, not just
   the one script the original defect was found in.** `kg-promote.ts` was a
   different script, written for a different purpose, that happened to share
   the same `upsertKgEdges` call and the same permissive enum gate — a
   second, worse instance of the exact bug D1 was fixing. A repo-wide grep
   for `upsertKgEdges`/`upsertKgNodes` callers should be a standing checklist
   item whenever ANY case loop ships a human-write layer, not just a
   one-time audit.
3. **A structural blast-radius check (edges + node identity) is necessary
   but not sufficient — prop-content references need their own grep.** The
   OSVČ purge script correctly proved no edges/nodes structurally reference
   the target company, but missed that OTHER loops' node props (effort's
   dossier prose, law's citation sources) reference the same urn as text
   data. Any purge script that claims "nothing else references this" should
   grep prop JSON blobs repo-wide for the target id, not just the edge/node
   tables.
2. **Concurrency**: 4 foreground Sonnet subagents (D1 fix, OSVČ purge, PRaK
   research, Q-money-2 decision) launched together, then 1 Opus re-audit,
   then 1 more Sonnet closure pass — 6 total this batch, sequenced to respect
   the fleet's shared concurrency cap (never more than 4 running at once).
