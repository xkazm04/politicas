# Money loop — fleet handoff (batch 003)

Case ① FollowTheMoney · 2026-07-24 · fleet mode (effort + law loops
concurrent) · Sonnet driver + 2 Sonnet subagents (write-path build, PRaK
research) + 1 Opus reflection. Everything the orchestrator needs to review,
commit, and steer batch 004. All work is inside the money boundary **plus
the additive `lib/db` carve-out granted this batch only** (ReviewRepository +
DDL, per `docs/case-loops.md`'s fleet rules — normally `lib/db` is
shared/out-of-boundary). **No commit made. No live `.pglite` write. No
`review_state` actually flipped anywhere (all writes happened on isolated
temp-dir test fixtures, never `./.pglite` or `./.pglite-copy-money`).** This
document supersedes batch 002's `handoff.md`, now historical. Full detail in
`batch-003.md`.

## 1. What shipped — human-review write path (uncommitted, in the tree)

Files, all inside the money boundary + the granted `lib/db` carve-out:

```
NEW  lib/db/pglite/repositories/review.ts        # ReviewRepository impl — the ONLY writer of review_state
NEW  lib/db/pglite/repositories/review.test.ts   # 5/5, isolated temp-dir PGlite
NEW  features/money/reviewActions.ts             # "use server" submitReviewDecision
EDIT lib/db/pglite/ddl.ts                        # + review_audit table, 2 indexes (additive)
EDIT lib/db/store.ts                             # + ReviewRepository interface, spread into Store
EDIT lib/db/types.ts                             # + ReviewAuditRow
EDIT lib/db/pglite-store.ts                      # wired makeReviewRepo
EDIT features/money/reviewTypes.ts               # ReviewTie gains src/dst
EDIT features/money/getVerificationData.ts       # populates src/dst
EDIT features/money/components/VerificationConsole.tsx  # wired write path, optimistic UI, error states
EDIT app/penize/kontrola/page.tsx                # passes writeConfigured/reviewerName
EDIT .env.example                                # documents REVIEWER_NAME / REVIEWER_TOKEN
NEW  docs/data-analysis/case-money/batch-003.md
EDIT docs/data-analysis/case-money/handoff.md    # this file
EDIT docs/data-analysis/case-money/ledger.md
EDIT docs/data-analysis/case-money/ledger.json
```

**`review_audit` DDL:**
```sql
create table if not exists review_audit (
  id           text primary key,
  src          text not null,
  rel          text not null,
  dst          text not null,
  decision     text not null,
  reviewer     text not null,
  note         text,
  decided_at   timestamptz not null default now(),
  prior_state  text
);
create index if not exists review_audit_edge_idx on review_audit(src, rel, dst);
create index if not exists review_audit_decided_idx on review_audit(decided_at desc);
```
No reference migration snapshot mirror was made — `lib/db/migrations/0001_civic_graph.sql` was **already stale before this batch** (missing `vote_tag`, and its generator script `scripts/gen-migration.ts` looks for `CORE_DDL` in a file it moved out of in an earlier refactor). Flagging for a separate cleanup pass; not this batch's boundary to fix.

**`ReviewRepository` interface** (`lib/db/store.ts`):
```ts
export interface ReviewRepository {
  setTieReviewState(
    src: string, dst: string,
    decision: "confirm" | "reject" | "needs-more",
    reviewer: string, note: string | null,
  ): Promise<{ ok: true; reviewState: string } | { ok: false; error: string }>;
  listReviewAudit(opts?: { src?: string; dst?: string; limit?: number }): Promise<ReviewAuditRow[]>;
}
```

**Server action contract** (`features/money/reviewActions.ts`):
```ts
submitReviewDecision(input: {
  src: string; dst: string; decision: ReviewDecision; note: string | null; token: string;
}): Promise<
  | { status: "ok"; reviewState: string; reviewer: string }
  | { status: "not-configured" } | { status: "unauthorized" }
  | { status: "not-found" } | { status: "error"; message: string }
>
```
**Env vars** (documented in `.env.example`, already added):
- `REVIEWER_NAME` — display name stamped as `reviewer` on every decision.
- `REVIEWER_TOKEN` — shared secret; the client submits a token that must match
  exactly. **Unset → the action returns `{status:"not-configured"}` before
  touching the store** — the console renders an honest still-read-only state
  instead of a write UI or a confusing error.

**Test results** (Opus independently re-ran these, not just the build agent):
- `npx vitest run lib/db/pglite/repositories/review.test.ts` → **5/5 passed**,
  on an isolated `fs.mkdtempSync` PGlite dir. Confirms: audit row written
  before the edge flip with correct `prior_state`; `confirm` →
  `review_state:"verified"`; `reject`/`needs-more` → stays
  `pending_review`, never verified; a verified tie disappears from the
  **real** `getVerificationQueue()` loader (not a re-derived filter copy).
- `npx vitest run` (full suite) → **176/176 passed**, 20 files.
- `npx tsc --noEmit` (repo-wide) → clean, zero errors.
- `npm run check` lint: 2 pre-existing failures, both in an **untracked
  sibling effort-loop file** (`scripts/case-loops/effort/divergence-retune.ts`)
  — confirmed via `git status` this batch never touched it.

## 2. Opus reflection — full verdict (verbatim excerpts)

> **VERDICT — write-path build:** The human gate holds in the forward
> direction, but it is not yet durable: it is not the only mutator of
> `review_state`, and the console's own success reporting is not honest under
> failure. Ship-able as a reviewed batch artifact, NOT ship-able to a public
> deployment as-is.

Rule-by-rule (all five hard rules from the design brief were checked against
actual code, not comments):

| rule | verdict |
|---|---|
| (a) only `setTieReviewState` writes `review_state` | **PARTIAL — see D1**: no app code path other than this repo writes it, but the ingest path (`kg-money.ts`) *reverts* it on re-run |
| (b) audit row written FIRST | **HOLDS in ordering, not in atomicity — see D2** |
| (c) reject/needs-more never → verified | **HOLDS**, whitelist not blacklist — any non-`"confirm"` value yields `pending_review` |
| (d) verified drops out of pending queue | **HOLDS**, real wiring, best-designed test in the file |
| (e) unset token → distinct honest state | **HOLDS end-to-end**, token never crosses to client |

**Defects found (Opus's numbering, preserved verbatim for batch 004):**

- **D1 — HIGH (durability).** `lib/analysis/kg-money.ts`'s ingest always
  stamps `review_state: link.state` (source feed default, always
  `pending_review`), and `lib/db/pglite/repositories/kg.ts`'s
  `upsertKgEdges` does `props = excluded.props` (**wholesale replace, not
  merge**) on conflict. So **any re-run of `kg-money-ingest --commit` silently
  destroys every human `verified` decision** and drops
  `last_decision`/`last_reviewer`/`review_note`. The audit trail survives
  (append-only, separate table) but nothing replays it.
  `scripts/case-loops/persist-batch.ts` already does this correctly
  (`props: {...e.props, ...p.propsMerge}`) — the ingest path does not.
  **Must close before a human spends real review time**, or a re-ingest will
  erase their work with no warning.
- **D2 — MEDIUM (atomicity).** The audit insert and edge update are two
  unrelated statements, no `BEGIN`/`COMMIT` transaction, though
  `Pglite.exec()` supports it. Failure direction is the safe one (audit
  without state-change, never the reverse) but the DDL comment asserts a
  guarantee the code doesn't enforce, and no test covers the crash-between
  case. Also a lost-update race on the `props` read-modify-write under
  concurrent decisions (acceptable for single-operator, should be documented).
- **D3 — MEDIUM (honesty).** The console's "zapsáno: N / 260" counter
  (`decisions[tie.id]` set optimistically, never rolled back on
  `not-configured`/`unauthorized`/`error`) can report writes that did not
  happen — e.g. a wrong-token confirm on 12 ties shows "zapsáno: 12" with zero
  actually written. Flagged as the single worst-fit defect for a product
  whose stated thesis is "trust is the product."
- **D4 — MEDIUM (staleness).** No `revalidatePath("/penize/kontrola")` after
  a successful write — the confirmed tie stays on screen, denominator never
  moves until manual reload, inviting harmless-but-audit-polluting
  double-confirms.
- **D5 — MEDIUM (audit integrity).** `decision` isn't validated at runtime
  (TS types erase at the server-action boundary) and `review_audit.decision`
  has no `CHECK` constraint — can't bypass the confirm/verified gate (rule c
  still holds) but pollutes the audit trail with arbitrary strings.
- **D6 — LOW/MEDIUM (security).** Token compared with `!==` (not
  constant-time), no rate limiting/lockout — fine for a local single-operator
  console, a real gap the moment the console is publicly reachable.
- **D7 — LOW (workflow hole).** `reject`/`needs-more` both collapse to
  `review_state:"pending_review"` with no terminal `"rejected"` state, so a
  rejected tie is re-served in the pending queue forever.
- **Non-defects done right:** server-side reviewer attribution (client can't
  spoof who decided); `writeConfigured` passed as a boolean only, token never
  reaches the client; `type="password"` + `autoComplete="off"`; buttons
  disabled during pending; unconfigured state gracefully preserves useful
  local-scratch behavior.

> **VERDICT — PRaK IČO 61858111 (Q-money-7):** Substantially corroborated on
> identity and on both officers — graph-ready-with-caveats — but the stated
> confidence level is inverted: "high" is too high on the primary-source
> axis, and the one date in the claim I could check is contradicted by the
> very page it's sourced from.

Key findings: ARES REST returns 404 for IČO 61858111 on both the subject and
VR endpoints (calibrated against a known-good IČO, so the 404 is the subject
not a URL bug) — the entity is dissolved pre-ARES's online reach, **structurally
outside the repo's own primary-source corroboration path**, same class of gap
as the 58 registry-unconfirmed special-law bodies. The wrong-entity catch on
49683144 is confirmed harder than claimed: ARES shows it is an s.r.o.
(cannot have a představenstvo) that is **still active today**
(`datumZaniku: null`), not dissolved. Both Bendl and Brabec are independently
corroborated via kurzy.cz + one independent Brabec bio (aktualne.cz), but
Bendl's claimed end date (1999-07-28) conflicts with the company's own
history page (2002-12-31) — likely *funkce do* vs *vymazáno*, unresolved.
**Most consequential finding:** PRaK a.s. is the Praha–Kladno rychlodráha
municipal SPV; Bendl's seat looks like a mayoral ex-officio public
appointment (he was Kladno mayor 1994–1998), not private enrichment —
re-pointing the edge without reclassifying `tieClass` to `steward` would
misrepresent a public appointment with the console's private-conflict visual
grammar, against a named sitting MP.

Full text (all defects D1–D7 + PRaK detail + citations) is preserved in the
Opus agent's original transcript; the sections above are the load-bearing
excerpts. Batch 004 steering (adopted) is in `batch-003.md`.

## 3. Shared-vault additions (exact text to append — not edited myself, fleet rule)

### → `docs/data-analysis/patterns.md`

```
## [[patterns]] Money · a props-merge writer must be used for ANY re-ingest that could touch human-gated fields (money batch 003)
`lib/db/pglite/repositories/kg.ts`'s `upsertKgEdges` does `on conflict (src,rel,dst) do
update set props = excluded.props` — a WHOLESALE replace. Any ingest/materialize script
that re-derives `props` from a source feed (not from the current DB state) will silently
overwrite fields a human write path added (`review_state`, `last_decision`, etc.) on
every re-run. `scripts/case-loops/persist-batch.ts` already merges correctly
(`{...e.props, ...p.propsMerge}`); `lib/analysis/kg-money.ts`'s ingest does not. Any case
that adds a human-write layer on top of a re-derivable ingest MUST either merge-preserve
the human fields in the ingest, or replay the audit trail after ingest — otherwise the
write path silently loses its own point.
```

### → `docs/data-analysis/contradictions.md`

```
## [[contradictions]] Money batch 003 — PRaK re-resolution candidate found, confidence downgraded on review
Batch 002 flagged Bendl/Brabec's "PRAK" tie as pointing at the wrong entity (IČO
49683144, an active s.r.o. that cannot structurally have a představenstvo). Batch 003
identified a likely-correct entity — IČO 61858111, "PRaK, a.s. v likvidaci" (Praha–Kladno
rychlodráha SPV, dissolved 2012) — via kurzy.cz aggregator + one independent Brabec bio,
with both Bendl and Brabec's board tenures corroborated. Opus reflection downgraded the
research agent's self-assessed "high" confidence to "medium": ARES REST returns 404 for
this IČO on both the subject and VR endpoints (dissolved pre-ARES's online reach,
calibrated against a known-good IČO to rule out a URL bug), so this entity sits outside
the repo's own primary-source corroboration path — same structural gap as the 58
registry-unconfirmed special-law bodies (Q-money-8). Additionally, Bendl's claimed board
end-date (1999-07-28) conflicts with the same source's company-history page (2002-12-31),
unresolved. NOT applied to the graph — annotation-only per this batch's spec; the
consequential open item is that PRaK a.s. is a municipal rail SPV, so Bendl's seat reads
as a mayoral ex-officio public appointment, not private enrichment — any future re-point
MUST reclassify `tieClass` to `steward` in the same change, or the console will
misrepresent a public appointment as a private conflict of interest against a named
sitting MP. Full candidate payload in `docs/data-analysis/case-money/batch-003.md` §2.
```

### → `docs/data-analysis/feature-opportunities.md`

```
## [[feature-opportunities]] O-money-4 — Human-review write path (`/penize/kontrola` confirm/reject/needs-more) — SHIPPED WITH OPEN DEFECT (batch 003)
`ReviewRepository` (`lib/db/store.ts` + `lib/db/pglite/repositories/review.ts`) is now the
sole writer of `kg_edge.props.review_state`, backed by an append-only `review_audit`
table and a `REVIEWER_NAME`/`REVIEWER_TOKEN`-gated server action
(`features/money/reviewActions.ts`). Console wired end-to-end with optimistic UI + honest
error states. 5/5 new repo tests, 176/176 full suite, tsc clean. **NOT yet safe for real
review sessions**: the ingest path (`lib/analysis/kg-money.ts` + `kg.ts`'s
wholesale-replace `upsertKgEdges`) silently reverts any `verified` decision on the next
`kg-money-ingest --commit` (Opus flag D1, HIGH). Batch 004 must close this before the
console is handed to a real reviewer. Also open: an optimistic UI counter that can report
writes that didn't happen (D3), no terminal `rejected` state (D7). See
`docs/data-analysis/case-money/handoff.md` §2 for the full defect list.
```

### → `docs/data-analysis/frontier.md` (money section)

```
## [[frontier]] Money (batch 003 additions)
- Q-money-7 (partially closed): PRaK re-resolution candidate found (IČO 61858111,
  medium confidence, annotation only) — see contradictions.md entry above. Still open:
  resolve the Bendl end-date conflict (1999-07-28 vs 2002-12-31) against a
  browser-rendered or.justice.cz úplný výpis before any graph write.
- Q-money-9 (new): the ingest/human-write durability gap (patterns.md addition above) is
  itself a structural risk to any future case-loop that layers a human write path onto a
  re-derivable ingest — worth a repo-wide audit, not just money-scoped.
```

### → `docs/data-analysis/graph-log.md`

```
2026-07-24 · money batch 003 (write-path build + Q-money-7 research, Sonnet driver/army +
Opus reflection) · NO GRAPH WRITE THIS BATCH. Build-only + research-only batch — no
kg_node/kg_edge payload proposed. review_audit table + ReviewRepository shipped in code
(uncommitted); never invoked against live or copy `.pglite`, tests only on isolated temp
dirs. PRaK candidate IČO annotated in contradictions.md, not applied to the graph.
```

## 4. Proposed enum / schema changes

- **New table** `review_audit` (additive, see §1 DDL) — not an enum change,
  a new append-only table. No existing enum values touched.
- **No change** to `corroboration`/`tie_class`/`temporal_status` value sets
  this batch.
- If a future batch re-points the PRaK edge, it will need `tieClass` to
  accept `steward` on what may currently be a different class for this tie —
  already a valid value, no schema change needed, just a reclassification.

## 5. Commit plan (orchestrator — per-case commit)

See §1 file list above (all additive/uncommitted). Suggested message:
```
feat(case-money): human-review write path (ReviewRepository + audit trail) + PRaK Q-money-7 research

Ships the first write path on the platform: a human reviewer can confirm/reject/
needs-more a pending MP<->company tie via /penize/kontrola, gated by REVIEWER_TOKEN,
every decision audited before the edge flips. 5/5 new tests, 176/176 full suite, tsc
clean. Opus reflection found the gate holds forward but is not yet durable against
re-ingest (D1, HIGH) — do not hand this console to a real reviewer until batch 004
closes it. Also resolves Q-money-7 research (PRaK IČO candidate, medium confidence,
annotation only, not applied).
```
**Recommend NOT deploying/announcing the console to a real reviewer until D1 is
closed** — see Opus's top risk flag #1 (below).

## 6. Lessons learned

1. **A human write path bolted onto a re-derivable ingest needs an explicit
   durability contract, not an implicit one.** The ingest script's own
   correctness (re-deriving `props` from the source feed) becomes a data-loss
   bug the moment a human write layer exists on the same field. Any future
   case-loop doing the same (effort, law) should audit its own ingest for the
   same `props = excluded.props` wholesale-replace pattern before shipping a
   write path.
2. **Opus reflection at this batch's scale earned its cost again, on a
   different axis than batch 002.** Batch 002's reflection caught data
   defects (undated-money conflation, asymmetric flagging). This batch's
   reflection caught an **architectural** defect (D1) that a Sonnet-level
   "does it work" test suite (5/5, 176/176, tsc clean — all genuinely true)
   would never surface, because it only exercises the write path in
   isolation, never against the sibling ingest path that also touches the
   same column. Recommend the reflection prompt explicitly ask "what ELSE in
   this repo writes to this same field/table" for any future write-path
   build, not just "does the write path itself work."
3. **Confidence self-assessment from a research agent needs an independent
   primary-source spot-check, not just a re-read of the same aggregator.**
   The PRaK research agent's own report already flagged (correctly) that it
   hadn't hit or.justice.cz directly — but still self-labelled "high"
   confidence. The Opus pass's actual ARES/or.justice.cz fetch attempts (both
   404/unfetchable, calibrated against a known-good IČO) are what surfaced
   the real confidence ceiling. **Treat a research agent's own confidence
   label as a claim to verify, not a fact**, same as any other web finding.
4. **Deferred-three-batches-running is itself a signal.** Q-money-2
   (pgvector) has now rolled from batch 001 → 002 → 003 without running.
   Opus's recommendation to either commit to it in 005 or retire it from the
   backlog rather than deferring a fourth time is a good general heuristic
   for this kernel's build-review cadence.
5. **Concurrency**: 2 foreground Sonnet subagents (build + research, run in
   parallel) + 1 Opus reflection, well under the fleet's shared cap — same
   pattern as batch 002.

## 7. Top risk flags before human review (Opus, verbatim, numbered)

1. A reviewer's verified decisions are destroyed by the next
   `kg-money-ingest --commit` — silent, no warning, no replay. **Do not ask a
   human to review ties until this is closed.**
2. The console's summary counter says "zapsáno: N" for writes that failed —
   the worst possible defect on a product whose thesis is trust, even though
   the per-card status is correct.
3. PRaK a.s. is a public rychlodráha SPV; re-pointing without reclassifying
   `tieClass` to steward would present a public appointment as a private
   conflict, against a named sitting MP.
4. The claimed Bendl end date (1999-07-28) is contradicted by the company's
   own history page (2002-12-31) — unresolved, and stale/misattributed
   periods were batch 002's #1 finding class.
5. Confidence on Q-money-7 is overstated as "high" — ARES returns 404 on both
   endpoints for this IČO; this entity is structurally outside the repo's
   primary corroboration path.
6. The audit insert and state flip are not in a transaction, while the DDL
   comment asserts an ordering guarantee the code doesn't enforce.
7. Deployment risk: one unthrottled shared token is the entire human gate —
   fine for local single-operator use, not for a public deployment.
8. Rejected ties never leave the queue — a reviewer will be re-served the
   same rejected tie indefinitely.

## 8. Cleanup

No `.pglite-copy-money` was created this batch (no graph query/materialization
needed — build + research only). No temp PGlite dirs left behind (test
fixtures use `fs.mkdtempSync`, cleaned up by the test framework / OS temp
dir).
