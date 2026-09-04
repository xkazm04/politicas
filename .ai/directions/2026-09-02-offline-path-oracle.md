---
subject: software-engineering/retrieval
project: politicas
raised_by: intake intake-lightrag-0902 (peer comparison)
source: librarian/sources/2026-09-02-lightrag.md
stage: evaluation — a twelfth sentinel invariant beside checkDeterminism in lib/testing/sentinel/invariants.ts
size: 2 files / ~120 lines / S
status: accepted
---

## Why the scope implies it

`scope.does` states the brand rule as *"every rendered number cites its source"*, and `CLAUDE.md:190-193`
escalates it: *"This is the brand rule — a violation is a failed task, not a nit."* A path returned by
`/graf` is a rendered claim of exactly that kind. It asserts that these are the shortest documented
hops between two public actors, under a printed ranking rule, and it is **permanently addressable** —
`features/graph/PermalinkPage.tsx` and `getPermalinkData.ts:123-136` mint a citable address for a
specific path. A reader is invited to repeat it in public.

Nothing checks that the claim behind that address survives a data refresh.

`features/graph/trailPath.ts` is careful, tested code. It excludes dense relations
(`EXCLUDED_RELS = ["co_votes_with"]`, `:34`, because *"96 % hustoty párů: matice, ne síť"*, `:11`),
prices hubs at two steps above `HUB_DEGREE = 120` (`:36`, `:206-208`) while exempting endpoints, caps
enumeration at `ENUM_CAP = 64` (`:38`) and reports `capped` honestly, and breaks ties by a printed
four-key rule ending in an alphabetical fingerprint so that *"determinismus nebyl slib, ale
vlastnost"* (`:5-6`). `trailPath.test.ts` (200 lines, 18 cases) pins every one of those rules —
including the input-order-independence property at `:177`.

But all eighteen run against a **hand-built synthetic fixture**. They prove the algorithm obeys its
rule; they say nothing about what the rule returns over the real graph. And the inputs to that
answer move constantly: `da:kg-compute --commit` after a `psp-hlasovani` re-ingest rewrites every
`co_votes_with` weight and every `rebellion_rate`; frontier item F5 (`docs/data-analysis/frontier.md:25`)
exists precisely to schedule that. A node crossing `HUB_DEGREE` in either direction silently re-prices
every path through it. A `linked_to` tie moving from `pending_review` to `verified` changes tie-break
key 2 and can promote a different path to winner. **Today all three of those are invisible.**

The peer supplies the shape and the argument for it. `lightrag/evaluation/offline_retrieval_check.py:2-5`
is explicit that the check *"does not start LightRAG, call the API server, compute embeddings, or call
LLM/RAGAS services"* — a frozen question→expected-document map (`sample_retrieval_oracle.json`,
6 entries) scored by a deterministic lexical ranker, with the oracle **mandatory and total** (`:157`
raises for any dataset question the oracle does not cover) and `--strict` (`:223-227`, enforced
`:248-249`) making it a CI gate. The front half of the intake called this *"the single highest-value
steal in the tree"*. It lands here more cheaply than it did there, because the harness already exists.

`retrieval`'s `retrieval-evaluation` technique owns this — *"labeled query sets, metrics with
predicates, leak checks, regression gates"* — and `politicas` has the doctrine written into its own
design (`docs/knowledge-graph-loop.md` §7) without an instrument pointed at the path lane.

## What the first context contains

**Not a new instrument. A twelfth invariant on the existing one.**

`scripts/sentinel/run.ts` already does everything the hard parts require: it copies the store to tmp
and points `PGLITE_PATH` at the copy so it *"never opens the source dir"* (`:10-13`); it runs eleven
invariants in a compile-checked order (`SENTINEL_CHECK_ORDER`,
`lib/testing/sentinel/invariants.ts:307`, where an id absent from the label record fails to compile,
`:543-544`); it takes `now` as *"an INPUT, never `Date.now()`, for determinism"* (`:534`); and when the
store cannot be read it emits `unevaluableSentinelReport` (`:596`) — the same eleven rows, all
`unevaluable`, exit code 2 — because previously *"nothing anywhere distinguished 'ran and passed' from
'never ran'"* (`run.ts:24-33`). `checkDeterminism` (`:499-527`) already reduces two independent
collection passes to a canonical-JSON sha256.

**The invariant contains:**
- A frozen fixture, `lib/testing/sentinel/path-oracle.json` — roughly twenty rows, each
  `{src, dst, expect: {hops: [{src, rel, dst}], cost, pendingCount, totalFound, capped}}`. Pairs are
  chosen to cover the rule's own clauses, not sampled at random: one through a hub, one *to* a hub,
  one whose winner turns on tie-break key 2 (fewer pending hops), one whose winner turns on key 3
  (documented amount), one at `MAX_COST = 6` (`trailPath.ts:38`), one with `capped: true`
  (`ENUM_CAP = 64`, `:40`), and one honest `paths: [], cost: null` — the *"čestná prázdnota"* the
  algorithm distinguishes from "no path" (`trailPath.test.ts:77`).
- `checkPathStability` — builds the adjacency from the copied store via the same
  `buildPathAdjacency` the loader uses (`features/graph/graphLoader.ts:680-690`), runs
  `findEvidencePaths` for each row, and compares against the frozen expectation. **No LLM, no
  network, no embedding** — this is pure symbolic retrieval, which is the whole reason the check can
  be exact rather than statistical.
- The liveness assertion first, per `lib/testing/contextMapRefs.test.ts:20-23`: the check asserts its
  own denominator — that every `src` and `dst` in the oracle still exists as a `kg_node` — before
  evaluating any path, because *"'I found nothing wrong' and 'I could not look' print identically"*.
  An oracle row whose endpoints have left the graph is `unevaluable`, never a silent pass.
- A drift report that names **which clause moved**: cost changed / winner changed / `totalFound`
  changed / `capped` flipped. A path that changed because a hub crossed 120 is a different finding
  from a path that changed because a tie was reviewed, and the report should say which.

**Its boundary — what it must NOT absorb:**
- **Not a correctness oracle.** It does not assert that the returned path is the *right* answer about
  Czech politics. It asserts that the answer is the same as it was, and that a change was noticed.
  Deciding whether a changed path is an improvement is an editorial act and stays human.
- **Not a replacement for `trailPath.test.ts`.** The unit tests own the *rules* on a synthetic
  fixture, where a counterexample can be constructed. This owns the *answers* on the real store,
  where one cannot. Both are needed and neither subsumes the other.
- **Not a blocker in the commit rung.** It belongs where the other eleven live —
  `.github/workflows/sentinel.yml`, which already goes red with an unevaluable report on a hosted
  runner that has no `./.pglite` (`run.ts:34-45`). It must not enter `npm run check`, which runs
  without a store.
- **Not an update-on-red script.** The temptation to add `--update` is exactly the failure the
  peer's judge harness demonstrates: a fixture that re-blesses itself measures nothing. Regenerating
  the oracle is a deliberate, reviewed commit — the discipline `npm run db:snapshot -- --check`
  already establishes.
- **Not scored.** No recall@k, no MRR. LightRAG needs those because its ranker is approximate;
  `findEvidencePaths` is exact and deterministic, so the honest metric is equality, and importing
  ranking metrics would suggest a tolerance the algorithm does not have.
- **Not a replacement for the permalink's own freshness flag.** `getPermalinkData.ts:189` already
  compares a stored hash against the current one and returns `fresh: currentHash === decoded.hash`,
  so a permalink whose graph has moved *"rozdíl přizná (fresh=false), místo aby tiše ukázala něco
  podobného"* (`:120-122`). That tells **a reader** their link is stale. This invariant tells **the
  operator** that a refresh moved answers, before any reader arrives. Different audiences, and
  neither substitutes for the other.

## The measurable

**Primary: oracle rows whose winning path changed across a `da:kg-compute --commit`.** That number
does not exist today and cannot be estimated — which is itself the finding. The direction has paid
off when the number is *observed at all*, on the first re-ingest after landing.

Both outcomes are useful, which is what makes this cheap to justify:
- **Non-zero** — a published, permalinked claim changed under a routine data refresh, and nobody
  would have known. That is a brand-rule incident found by an instrument, and it also tells the owner
  whether `/graf` permalinks need to record the graph version they were minted against.
- **Zero** — path ranking is stable under data refresh. That is currently an *assumption* the
  permalink surface makes on the reader's behalf, and turning it into a measurement is worth the
  twenty rows on its own.

**Secondary: time from a `kg-compute` run to knowing.** Today: unbounded — it would surface as a user
noticing a permalink says something different. After: one CI run.

**Test T2** in the study is the initiating experiment, and it is runnable before the invariant is
written: freeze the twenty rows by hand against today's store, re-run after the next re-ingest, and
count. If the count is 0 and stays 0 across two refreshes, the invariant is cheap insurance rather
than a discovered defect — still worth landing, but the owner should know which it is.

## What would make this wrong

- **The path surface is not load-bearing.** If `/graf`'s trail finder is an exploratory toy rather
  than a cited product, freezing its answers over-constrains a surface that is meant to move.
  `docs/routes/` has the route's dated detail record and it, not this proposal, is the authority on
  what `/graf` promises a reader.
- **The graph moves so much that the oracle is red every week.** A fixture that is always red is
  noise, and gets muted, and then a real regression passes. If the first two refreshes both change
  most rows, the answer is not a bigger tolerance — it is that path ranking is genuinely unstable
  under data refresh, which is a **product** finding (the permalink is promising more than the data
  supports) and should be routed to the route record rather than absorbed by loosening the check.
- **The oracle endpoints churn out of existence.** MPs lose mandates and committees empty —
  `guardKgReset`'s `orphanedNodeIds` (`lib/analysis/kg.ts:494`) exists because of exactly that. If
  most oracle rows go `unevaluable` within a term, the fixture needs to be keyed on structurally
  durable pairs (a party, a large organ, a long-lived company) rather than on individuals, and if no
  such pairs exercise the interesting clauses, the check cannot be built as specified.
- **Twenty rows is the wrong granularity.** If the interesting failure is not "this path changed" but
  "the *distribution* of path lengths changed", a fixture of specific pairs will miss it while a
  handful of aggregate statistics would catch it. The `score-sample` and `recompute-sample`
  invariants (`invariants.ts:227`, `:455`) are the in-tree precedent for the aggregate shape; if the
  first run suggests that is the better instrument, this proposal should be replaced by it rather
  than run alongside it.
