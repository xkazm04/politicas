# Handoff — batch 007, the insert-capable apply writer

Fleet run. Boundary respected: only touched `scripts/case-loops/apply-batch.ts`
(new), `scripts/case-loops/apply-batch.test.ts` (new), `lib/analysis/kg-verdict.ts`
(granted this batch), and `docs/data-analysis/case-sources/batch-007-apply-report-*.json`
(new report artifacts). No live `.pglite` write (all three runs below were dry-run
against `.pglite-copy-apply`, deleted after use). No shared vault file
(`frontier.md`, `feature-opportunities.md`, `graph-log.md`, `patterns.md`,
`contradictions.md`) edited. No commit made. Stayed out of `case-law/`,
`scripts/case-loops/law/`, `lib/ingest/sources/psp-legislation*` — the law
agent's fleet boundary (its own untracked batch-007 files are visible in `git
status` but were not touched).

## The problem this batch solved

`scripts/case-loops/persist-batch.ts` is deliberately props-merge-only and
refuses to insert — a real fabrication guard, not a bug. Three validated
payloads had proposals for brand-new nodes/edges that guard correctly refuses.
`law/apply-amends-regen.ts` (batch-006) proved the pattern once, case-scoped;
this batch **generalizes it into one shared engine** (`applyBatch()`) plus
three small pure adapters, rather than forking three near-identical scripts.

## The writer's safety properties

`scripts/case-loops/apply-batch.ts`:

1. **Node-then-edge ordering.** Every edge endpoint must be a live node OR a
   node this same batch creates — checked as one combined set BEFORE any
   write. An edge with a missing endpoint is a hard error that refuses the
   **entire** run (no partial apply), never a silent skip.
2. **Provenance preservation.** Merging onto an already-live node/edge never
   touches its `provenance` column. Contribution is nested under
   `props.<ns>_<batchKey>_note` instead — for both nodes AND edges (an Opus
   audit finding: the first draft nested correctly on edges but spread payload
   props directly over an existing node's props, which could have silently
   overwritten a live field; fixed to nest on both, and any prop/kind/label
   the payload disagreed with the live row on is now logged in `rejections`,
   never silently dropped).
3. **Deletion allowlist.** `DELETION_ALLOWLIST` is empty by design. Nothing is
   ever deleted unless BOTH (a) explicitly listed there with a reason AND
   (b) matched, at runtime, against a live edge that is ALSO one of the
   current batch's own `proposedDeletions` — a startup assertion refuses the
   whole run if an entry doesn't match (generalizes batch-006's reflection-
   pass lesson: 3 of 6 exclusion entries there once carried a wrong id and
   silently no-op'd). The delete call's own returned count is checked against
   what was asked for; a mismatch is a hard error, not an optimistic "deleted:
   true".
4. **Kind/rel enum enforcement** against `lib/analysis/kg-verdict.ts`'s
   `KG_NODE_KINDS`/`KG_EDGE_RELS` — unknown values are a hard error, checked
   before any store query.
5. **`--dry-run` default, `--commit` opt-in, `--pass=<positive integer>`
   required for commit, `--confirm-live` required when `PGLITE_PATH` is
   unset** — same convention as `purge-osvc.ts`/`apply-amends-regen.ts`.
6. **Per-payload expected-count gate.** Before writing anything, the
   normalized batch's node/edge/excluded counts are checked against
   `EXPECTED_COUNTS` (the shape this handoff's dry-run reviewed). A mismatch
   — payload edited, adapter regressed — refuses with an explicit diff rather
   than silently applying something different from what was reviewed.
7. **A report is ALWAYS written**, including on refusal/failure
   (`docs/data-analysis/case-sources/batch-007-apply-report-<which>.json`) —
   not only on success, so a failed or refused commit attempt is never
   forensically invisible.

Tests: `scripts/case-loops/apply-batch.test.ts`, 13 cases on an isolated
temp-dir PGlite (never the live `./.pglite`) — insert, merge-preserving (node
+ edge, provenance untouched), endpoint-missing hard refusal (nothing
written), unknown-kind/unknown-rel hard refusal, unmatched-allowlist refusal
(nothing deleted), deletion-count-lie refusal, dry-run no-write, plus adapter
unit tests (period-merge, open-period-outranks-closed, board-seat exclusion,
missing-`from` hard error, prak-repoint's deletion-candidate-not-direct-delete
shape).

## Opus audit — what it caught

Ran via `Agent` tool, `model: "opus"`, maximum depth, given the writer, its
test suite, the batch-006 precedent, `persist-batch.ts`, all three payloads,
`kg-verdict.ts`, and the actual PGlite repo layer. It read code, not comments,
and calibrated against the batch-006 precedent (a docblock claiming 6 edges
excluded while the actual filter matched 0 of 3 wrong-id entries).

Verdict on the first draft: **not yet safe for a live `--commit`**, specifically
flagging `--which=ownership-chains`. Findings, and what was fixed:

1. **BLOCKER — "latest period wins" demoted an OPEN, active 100% stake behind
   a later-dated CLOSED board seat.** On the real payload this would have
   written `share: null` onto the AGROFERT→Synthesia edge and a *terminated*
   `to` date onto two active hospital-holding stakes — a materially false
   top-level summary even though nothing was literally deleted (same failure
   shape as the batch-006 precedent: correct machinery, false prose). **Fixed**:
   winner precedence is now open-period-first, then highest share, then
   latest `from`; sort is a strict total order so no tie is file-order-
   dependent; a stake row with a missing/non-ISO `from` is now a hard error
   instead of silently sorting as "oldest".
2. **BLOCKER — `owns_stake` conflated shareholding with board membership** (8
   of 55 payload rows are director/board seats, `share: null`). **Fixed**: the
   adapter now routes any row without a numeric `share` to `excludedEdges`
   (reported, never silently folded in) — confirmed against the real payload:
   exactly 8 excluded, 33 edges remain (down from 55 raw rows via both the
   board-seat filter and the same-key period merge).
3. **BLOCKER (latent) — the deletion allowlist assertion checked only one
   direction** (matches a live edge) and not the other (matches THIS batch's
   own proposed deletions) — an entry from an unrelated `--which` run would
   pass the assertion and silently no-op. **Fixed**: the assertion and the
   delete phase both now scope to entries that match a `proposedDeletion` of
   the current batch.
4. **BLOCKER (latent) — the report could claim `deleted: true` without
   checking the store's own returned delete count.** **Fixed**: mismatch is
   now a hard `ApplyBatchError`.
5. **REAL — a failed/refused commit produced no report artifact at all**
   (forensically invisible). **Fixed**: every exit path — success, refusal,
   thrown error — writes a report file.
6. **REAL — the node merge spread payload props directly over the existing
   row**, unlike the edge merge which was already nested (the docblock's own
   promise didn't match the code on this one path). **Fixed**: nested on both,
   plus a `rejections` log for any prop/kind/label the payload disagreed with.
7. **REAL — `--pass` accepted 0/negative/fractional**, weaker than
   `persist-batch.ts`'s own gate. **Fixed**: `Number.isInteger(pass) && pass > 0`.
8. **REAL — no assertion that the payload's shape still matched what a prior
   dry-run reviewed**, between review and a live `--commit`. **Fixed**: the
   `EXPECTED_COUNTS` gate (item 6 above).
9. Lower-severity/deferred (documented, not fixed this batch — none change
   the safety of the three payloads as reviewed): no DB transaction wrapping
   the node/edge/delete writes (inherited gap, shared with
   `persist-batch.ts`/`apply-amends-regen.ts`); `--confirm-live` doesn't
   verify `PGLITE_PATH` actually resolves to the live default vs. merely being
   set (inherited, fleet-wide, present in `purge-osvc.ts` too);
   `listKgNodes`/`listKgEdges`'s silent `limit: 1_000_000` truncation would
   misclassify a pre-existing row as new past that volume (far from today's
   scale); the report doesn't list individual inserted/merged ids (a rollback
   aid, not a correctness gap).

All blockers were fixed in this session; re-ran the full test suite and all
three dry-runs after each fix. `npm run check` green after the fixes (see
below).

## Dry-run results (against `.pglite-copy-apply`, a full copy of the live
`./.pglite`, deleted after each run — no live write, no state left behind)

### `--which=prak-repoint`
```
Nodes: 1 total — company: 1 insert, 0 merge
Edges: 2 total — linked_to: 2 insert, 0 merge
Proposed deletions: 2 — psp:person:346/6184 --linked_to--> company:ico:49683144
  [NOT ALLOWLISTED — left untouched] (P50: a re-point never auto-deletes the
  old edge; DELETION_ALLOWLIST is empty by design — see Commit plan below)
Excluded edges: 0
Rejections: 0
```

### `--which=ownership-chains`
```
Nodes: 19 total — company: 19 insert, 0 merge
Edges: 33 total — owns_stake: 33 insert, 0 merge
  (55 raw payload rows → 47 true stake rows [share is a number] → 33 distinct
  (src,rel,dst) groups after the open-period/highest-share/latest-from merge;
  13 groups were multi-period, carrying full history in props.periods[])
Excluded edges: 8 (board/officer seats — no numeric share; NOT folded into
  owns_stake, reported with the live role string in the reason)
Proposed deletions: 0
```

### `--which=kiosek`
```
Nodes: 20 total — notice: 20 insert, 0 merge
Edges: 36 total — cites: 36 insert, 0 merge (all to existing law:sb:* nodes;
  matches the kiosek handoff's own headline "4/11 distinct citations,
  36/edges resolve to a live law node")
Excluded edges: 80 — 75 targetExists:false (51 cites to law:sb:* not yet
  minted, 24 concerns to company:ico:* not yet minted — the payload's own
  documented 0% IČO join-hit-rate, confirmed independently: applyBatch()'s
  OWN endpoint check re-verifies against the live store, it does not trust
  the payload's targetExists flag blindly) + 5 concerns_person_ico (not a
  real graph rel — natural-person IČOs routed out per the payload's Opus
  verification finding)
Proposed deletions: 0
```

Full JSON reports: `docs/data-analysis/case-sources/batch-007-apply-report-{prak-repoint,ownership-chains,kiosek}.json`.

## Orchestrator execution order (exact commands)

All three are independent (different node/edge sets, no shared ids) — order
doesn't matter for correctness, but running money-case payloads before the
sources-case one keeps each case's own review cycle self-contained:

```bash
# 1. re-verify against a fresh copy first (payloads/graph state may have moved since this handoff)
cp -r .pglite .pglite-copy-apply-verify
PGLITE_PATH=./.pglite-copy-apply-verify npx tsx scripts/case-loops/apply-batch.ts --which=prak-repoint
PGLITE_PATH=./.pglite-copy-apply-verify npx tsx scripts/case-loops/apply-batch.ts --which=ownership-chains
PGLITE_PATH=./.pglite-copy-apply-verify npx tsx scripts/case-loops/apply-batch.ts --which=kiosek
rm -rf .pglite-copy-apply-verify
# confirm the three reports match the counts in this handoff (the EXPECTED_COUNTS
# gate in apply-batch.ts will refuse on its own if the payload/adapter drifted —
# but re-check the numbers by eye too before arming --commit)

# 2. live commits — one case-loop pass number per payload (assign per kernel §Provenance),
#    orchestrator only, never this driver:
npx tsx scripts/case-loops/apply-batch.ts --which=prak-repoint      --commit --confirm-live --pass=<N1>
npx tsx scripts/case-loops/apply-batch.ts --which=ownership-chains  --commit --confirm-live --pass=<N2>
npx tsx scripts/case-loops/apply-batch.ts --which=kiosek            --commit --confirm-live --pass=<N3>
```

Each real commit re-writes its own report file at the final (committed) state
— confirm `mode: "commit"` and the insert/merge counts in each JSON match
what's expected before moving to the next payload.

## The PRaK old-edge deletion decision (P50, deliberately deferred)

The 2 old `linked_to` edges (`psp:person:346`/`6184` → the wrong IČO
`company:ico:49683144`) are flagged as `proposedDeletions` but
`DELETION_ALLOWLIST` in `apply-batch.ts` is empty by design — they will
**not** be deleted by the commands above. This is a deliberate policy choice
per the payload's own P50 note ("must NOT be silently deleted without an
explicit allowlist entry"), not an oversight. If the orchestrator/human wants
them retired:

1. Add two entries to `DELETION_ALLOWLIST` in `scripts/case-loops/apply-batch.ts`:
   ```ts
   { src: "psp:person:346", rel: "linked_to", dst: "company:ico:49683144", reason: "retired: repointed to company:ico:61858111, Q-money-7 batch-006" },
   { src: "psp:person:6184", rel: "linked_to", dst: "company:ico:49683144", reason: "retired: repointed to company:ico:61858111, Q-money-7 batch-006" },
   ```
2. Re-run `--which=prak-repoint` (dry-run first, then commit) — the startup
   assertion will refuse if either entry doesn't match a live edge, so this is
   safe to do in a follow-up session/batch even after the insert commit above
   has already run.

## Enum / schema additions made (lib/analysis/kg-verdict.ts — granted this batch)

```ts
// KG_NODE_KINDS: added "notice"
export const KG_NODE_KINDS = ["person", "party", "organ", "bloc", "theme", "company", "contract", "bill", "law", "notice"] as const;

// KG_EDGE_RELS: added "owns_stake", "cites", "concerns"
export const KG_EDGE_RELS = [
  "co_votes_with", "rebels_against", "belongs_to", "about", "owns", "influential_in",
  "linked_to", "supplies", "sponsors", "amends", "assigned_to",
  "owns_stake", "cites", "concerns",
] as const;
```

**Schema-doc rows for the orchestrator to fold into `graph-schema.md`** (not
edited here — shared vault file, out of this batch's boundary):

| kind/rel | direction | props | source |
|---|---|---|---|
| `notice` (node) | — | `agenda: string[]`, `institutionCode: string`, `institutionIco: string \| null`, `spisovaZnacka: string \| null`, `postingId: string` | kiosek.justice.cz úřední-deska posting; see `case-sources/handoff.md` |
| `owns_stake` (edge) | company → company | `role, from, to, share, source, note` (+ `periods[]`/`multi_period_merged` when the pair has more than one dated period; each period entry carries its own `provenance`) | dataor.justice.cz AngazmaPravnicke shareholder records; see `case-money/batch-006.md` |
| `cites` (edge) | notice → law | `rationale` (cites the exact PDF text matched) | kiosek adapter |
| `concerns` (edge) | notice → company | `rationale` | kiosek adapter |

Note: `concerns` is currently a **dead enum value in this batch's applied
set** — all 24 proposed `concerns` edges have `targetExists: false` (0% IČO
join hit rate, an honest finding per the kiosek handoff, not a defect) and
are excluded from this run. It becomes live once the money case mints the
matching `company:ico:*` nodes and a future kiosek payload/re-run resolves them.

## Commit plan (NOT executed — fleet rule, orchestrator commits)

```
git add scripts/case-loops/apply-batch.ts scripts/case-loops/apply-batch.test.ts \
        lib/analysis/kg-verdict.ts \
        docs/data-analysis/case-sources/batch-007-apply-report-prak-repoint.json \
        docs/data-analysis/case-sources/batch-007-apply-report-ownership-chains.json \
        docs/data-analysis/case-sources/batch-007-apply-report-kiosek.json \
        docs/data-analysis/case-sources/handoff-batch-007.md

git commit -m "$(cat <<'EOF'
feat(case-loops): generalized insert-capable apply writer — batch-007

persist-batch.ts is deliberately props-merge-only and refuses to insert;
this was blocking three validated payloads (prak-repoint, ownership-chains,
kiosek notice/cites/concerns). apply-batch.ts generalizes batch-006's
case-scoped law/apply-amends-regen.ts template into one shared applyBatch()
engine + three pure per-payload adapters: node-then-edge endpoint
enforcement, provenance-preserving merge (nodes AND edges), a deletion
allowlist with a startup match assertion, kind/rel enum enforcement against
kg-verdict.ts (owns_stake/notice/cites/concerns added here), dry-run
default/--commit opt-in/--confirm-live guard, and a per-payload
expected-count gate. Opus-audited before finalizing: caught and fixed a
winner-selection bug in the ownership-chains period merge that would have
demoted an active 100%-owned subsidiary (AGROFERT->Synthesia) and two active
state hospital stakes to a null/terminated top-level summary while a board
seat won instead — machinery that looked correct while its output
contradicted its own docblock, the same failure class the batch-006
precedent warned about. All three payloads dry-run clean against a
.pglite copy; live commit is the orchestrator's next step (see handoff for
exact commands and pass-number assignment).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

## `npm run check` status

**Green, repo-wide**: `tsc --noEmit` clean, `eslint` clean, `vitest run` →
285/285 tests passing across 28 files (13 of them this batch's own
`apply-batch.test.ts`). Scoped confirmation of this batch's own files:
```
npx eslint scripts/case-loops/apply-batch.ts scripts/case-loops/apply-batch.test.ts lib/analysis/kg-verdict.ts
# → clean, zero errors
npx vitest run scripts/case-loops/apply-batch.test.ts
# → 13/13 passing
```
The law case's sibling fleet loop has untracked in-progress files under
`case-law/` and `scripts/case-loops/law/` (visible in `git status`, not
touched by this batch) — `npm run check` was green at the time this handoff
was written, but per the kernel's fleet-mode note this can drift independent
of this batch if the sibling loop is still live-editing.

## Lessons learned

- **A deterministic, code-first check found a real corruption risk before any
  LLM/audit step**: `kg_edge`'s primary key is the plain triple `(src, rel,
  dst)` with no time dimension. Simply counting duplicate keys in the
  `ownsStakeEdgeProposals` array (`python3 -c "collections.Counter(...)"`,
  zero LLM calls) surfaced that 35 of 55 rows would collide on insert before
  the Opus audit ever ran — exactly the kernel's "deterministic owns every
  count" doctrine paying off on a genuinely dangerous class of bug.
- **Fixing a data-loss bug can introduce a data-*truth* bug of the same
  severity.** The first fix (merge same-key proposals into one row +
  `periods[]`) correctly stopped the composite-key collision from silently
  dropping historical stakes — and then picked the wrong row as the "current"
  summary (latest-by-date instead of the still-open one), which is not data
  loss but is a materially false headline number on the graph's most visible
  edge (AGROFERT→Synthesia). "Nothing was deleted" and "the summary is
  honest" are two different properties; a fix that guarantees the first can
  still fail the second, and only reading the actual merged row's fields
  (not just confirming `periods.length` is right) caught it.
- **"Generalize, don't fork" produces a stronger fabrication guard than three
  case-specific scripts would have**, because every payload's edges pass
  through the SAME endpoint-existence check, the SAME enum enforcement, and
  the SAME deletion-allowlist assertion — a bug fixed once (e.g. the
  deletion-allowlist directionality gap, finding #3) is fixed for every
  current and future adapter, not just the one that happened to expose it.
- **A report artifact is not optional on the failure path.** The first draft
  only wrote a report on success; an Opus finding pointed out that a failed
  or refused live `--commit` attempt would then be forensically invisible —
  exactly the class of gap this whole batch exists to close for the graph
  itself. Fixed to always write something, tagged by outcome.
- **Reviewing a dry-run and running the live commit are two separate moments
  in time**, and nothing enforced that the payload hadn't moved between them
  until this batch's `EXPECTED_COUNTS` gate. This is the direct generalization
  of `purge-osvc.ts`'s "expected 49 but found N" drift check — worth carrying
  forward into any future insert-capable writer as a standard step, not an
  afterthought.
