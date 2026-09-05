# DB architecture guide — which database(s) for which operation

**Purpose.** A reusable, *measured* decision guide for database design: given an
operation and a data scale, which engine (single) or combination (hybrid) to use —
so Politicas and sibling projects can make the DB-choice from evidence, not folklore.
Every rule here is backed by an experiment on Politicas's real datasets
(`scripts/db-bench/`), which are rich enough to exercise every workload class — with
one labelled exception: the *method* rules under **Engine watch**, which say how to
read someone else's numbers and are marked as not case-backed:

| Dataset | Rows | Exercises |
| --- | --- | --- |
| `vote_ballot` | 406k | OLAP aggregates, analytical self-joins |
| `vote_event` | 2,030 | scans, group-bys, full-text (titles) |
| `person` / `mandate` / `organ` / `membership` | 7k / 207 / 1.8k / 1.3k | OLTP joins, entity resolution |
| KG `kg_edge` | 21k | graph traversal (co-votes, person→club→co-voters) |
| `vote_tag` | ~2k | derived-metadata joins |

## The framework

**Workload classes** (what shape is the query?):

| Class | Politicas example | The DB question |
| --- | --- | --- |
| **OLTP point/range** | one MP's ballots + profile | is the embedded row store enough? |
| **OLAP aggregate** | discipline / tally / agreement over 406k ballots | when do you need **columnar**? |
| **Graph traversal** | co-votes, person→club→co-voters (multi-hop) | when a **graph DB**? |
| **Full-text / fuzzy** | vote-title & MP-name search | when dedicated **FTS**? |
| **Vector / semantic** | semantic vote/person search (embeddings) | **in-DB vector vs dedicated**? |

**Engine candidates** (✓ = benchmarked; cases #1–3 on the ARM box, #4 on an x64/Windows box):

- **PGlite** ✓ — embedded Postgres (the incumbent); row store, JSONB, window fns, recursive CTEs.
- **DuckDB** ✓ — in-process columnar, vectorized; analytical joins/aggregates; Parquet/Lance/Iceberg.
- **node:sqlite** ✓ — built-in row store (Node 24, `--experimental-sqlite`); zero-dep baseline.
- **pgvector / LanceDB / Qdrant** ✓ (installable) — vector similarity.
- **Kuzu** ✓ (x64) — embedded property graph; **now benchmarked (case #4)** — installs from a
  bundled prebuilt on win32-x64, no cmake build. **ClickHouse / Polars** ⚠ (x64/service).

**Metrics.** correctness (cross-engine checksum) · warm-median latency · load/build
time · memory · code ergonomics. **Decision axes for single-vs-hybrid:** data
volume · query shape · write pattern · operational cost · and the *one-engine
reconciliation* rule (from the LLM benchmark: any number the app cites must be
produced by the same engine that defines it — see hybrid-benchmark-plan.md).

## Measured cases

### Case #1 — OLAP over 406k ballots (PGlite vs DuckDB vs SQLite) — 2026-07-23

Warm-median query latency (ms). Load: **DuckDB 81ms** (from CSV) · SQLite 368ms ·
PGlite resident. Correctness identical across all three (816 groups / 406,000;
2,030 / 406,000; **14,890,662** agreement pairs).

| Engine | A1 group-by mandate×choice | A2 per-vote yes-rate | A3 self-join agreement pairs |
| --- | ---: | ---: | ---: |
| PGlite (incumbent) | 101.7 | 106.4 | **5,635.8** |
| **DuckDB** | **7.2** | **4.3** | **131.5** |
| SQLite | 141.8 | 36.0 | 3,755.6 |

**What it shows:**
- **DuckDB dominates, and the gap widens with query complexity:** ~14× on the
  simple group-by (A1), ~25× on A2, and **43× on the heavy self-join** (A3, the real
  `co_votes_with` agreement workload) vs PGlite. Columnar + vectorized execution is
  built for exactly this.
- **The incumbent PGlite is the *worst* at the analytical self-join** — **5.6 s** on
  A3, user-perceptible lag; SQLite (with an index) even beats it (3.8 s). Running
  heavy analytics on the OLTP engine is the anti-pattern.
- **DuckDB's load is trivial** (81 ms for 406k rows from CSV), so a hybrid that
  exports canonical rows to Parquet/CSV and runs analytics in DuckDB pays almost
  nothing to stand up.
- Numbers reconcile exactly — so a hybrid (Postgres serves, DuckDB analyzes) does
  **not** violate the one-engine-reconciliation rule *as long as both read the same
  canonical rows*; the agreement count is identical whichever engine computes it.

### Case #2 — vector kNN, in-DB vs dedicated (PGlite+pgvector vs LanceDB) — 2026-07-23

Synthetic deterministic 128-d vectors (identical across engines — measures store
performance + architecture, not embedding quality). Flat/exact search (ANN indexing
is the scale lever). Top-1 identical at both scales (exact ⇒ MATCH).

| Scale | Engine | build (ms) | kNN median (ms) |
| --- | --- | ---: | ---: |
| 20k | PGlite + pgvector (in-DB) | 4,154 | 8.3 |
| 20k | **LanceDB** (dedicated) | **327** | 9.2 |
| 100k | PGlite + pgvector (in-DB) | 20,733 | 40.2 |
| 100k | **LanceDB** (dedicated) | **1,510** | 36.5 |

**What it shows:**
- **Query latency is a wash** — single-digit ms at 20k, ~40 ms at 100k, either way.
  At Politicas's realistic vector scale (few-k to low-tens-of-k: vote titles +
  persons), kNN is a non-issue in *either* store.
- **Build/load is where they split — LanceDB is 12–14× faster** (327 ms vs 4.2 s at
  20k; 1.5 s vs 20.7 s at 100k). pgvector's weakness is *write/index throughput*,
  not query; LanceDB's columnar bulk load is purpose-built.
- Both exact ⇒ identical results; recall only diverges once you add ANN indexes at
  ≫100k, which is where a dedicated store earns its keep.

### Case #3 — full-text: index vs scan (tsvector/GIN vs FTS5 vs LIKE) — 2026-07-23

Real Czech text (2,030 vote titles + 7,045 MP names) replicated to 200k docs. Query
warm-median over 6 real terms (all whole tokens ⇒ substring-LIKE and token-FTS agree
at 69 hits each).

| Engine | approach | index build (ms) | query median (ms) |
| --- | --- | ---: | ---: |
| PGlite | LIKE scan | — | 115.2 |
| PGlite | **tsvector + GIN** | 577 | **2.2** |
| SQLite | LIKE scan | — | 13.6 |
| SQLite | **FTS5** | 164 | **0.2** |

**What it shows:**
- **A real FTS index is 52–68× faster than a LIKE scan** (PGlite 2.2 ms vs 115 ms;
  SQLite 0.2 ms vs 13.6 ms) — it turns an O(n) scan into an index lookup. Build is a
  cheap one-time cost (164–577 ms for 200k docs).
- **SQLite FTS5 is available in Node 24's built-in SQLite** and is the fastest option
  overall (0.2 ms), a lean inverted index at zero dependency cost.
- **PGlite's naive LIKE is the slowest** (115 ms — 8× slower than SQLite's LIKE) —
  Postgres-WASM per-row overhead. On PGlite, use `tsvector`+GIN, never rely on ILIKE
  for a hot text path.

### Case #4 — graph traversal, recursive-CTE stores vs native graph (Kuzu) — 2026-07-24

The deferred graph case, now run on an **x64/Windows** box (Kuzu is x64-only but installs
from a bundled prebuilt — no build). Real KG `co_votes_with` at agreement **θ≥0.9: 10,056
edges over 203 MPs** — a *near-complete, bimodal* graph (two voting blocs, ~0.99 intra /
~0.4 cross agreement). Three workloads, warm-median latency, **counts identical across all
four engines** (cross-checked):

| Engine | build (ms) | G1 reach H2 | G1 reach H3 | G2 triangles | G3 hetero-join |
| --- | ---: | ---: | ---: | ---: | ---: |
| PGlite (incumbent) | 86 | 4.1 | 7.1 | 412.6 | **0.6** |
| node:sqlite | 11 | **2.5** | 6.0 | 188.3 | 0.9 |
| **DuckDB** | 22 | 3.8 | **5.4** | **20.3** | 2.1 |
| Kuzu (native graph) | 193 | 8.1 | **922** | 38.7 | 4.0 |

- **G1** = distinct MPs within H hops of a seed (recursive traversal; median over 8 seeds) ·
  **G2** = triangle count = mutually-≥θ triples (the graph self-join; **328,877**) · **G3** =
  committee colleagues (`influential_in`) who also co-vote (heterogeneous typed multi-hop; 8 seeds).

**What it shows:**
- **The native graph engine won nothing here — and lost badly on deep traversal.** Kuzu's
  idiomatic Cypher variable-length `*1..3` **enumerates every path** (~degree³ ≈ 10⁶ on a
  dense graph) before `DISTINCT`-collapsing to the same 766 nodes → **922 ms, ~130× slower**
  than the row stores' recursive CTE (5–7 ms), whose `UNION` dedups at every depth. On a dense
  graph, **path-enumeration ≠ reachability**, and the set-deduping CTE is the right tool.
- **Reachability saturates** — H2 == H3 (Σ 766 either way). On a near-complete graph 2 hops
  already reaches the whole bloc; there is **no "multi-hop that outgrows recursive CTEs"** here
  to justify a graph store (the exact trigger the recommended-architecture note reserved a graph
  DB for). Reach is a **non-workload**: trivial for the row stores.
- **The heavy graph aggregate is a *columnar* win, not a graph-DB win.** G2 (triangle
  self-join — the graph analog of case #1's A3) → **DuckDB 20 ms**, 9–20× faster than the row
  stores (PGlite 413 ms is again the worst) **and ~2× faster than Kuzu**. Same verdict as OLAP:
  push the analytical self-join to DuckDB.
- **The heterogeneous join (G3) is small and bounded** (committee links are sparse: 605 edges)
  → sub-5 ms everywhere, **row stores fastest** (PGlite 0.6 ms). A fixed-length typed join over
  a sparse relation doesn't need a graph engine either.
- **Build cost:** Kuzu's on-disk DB creation (193 ms) is the heaviest; the in-memory
  row/columnar stores stand up in 11–86 ms. Load is a non-issue for all.

Harness: `scripts/db-bench/graph.ts` — PGlite/SQLite/DuckDB recursive-CTE vs Kuzu Cypher, same
θ-filtered graph, cross-engine checksum on every count.

## Decision rules (accumulating)

_Derived from the measured cases as they land. Each rule cites the case that backs it._

- **R1 — Columnar for analytics at scale.** For OLAP aggregates / analytical joins
  over **~100k+ rows**, use **DuckDB**: 14–43× faster than the row stores here, and
  the advantage *grows* with join complexity. _(case #1)_
- **R2 — Never run heavy analytics on the OLTP engine.** PGlite (the serving store)
  was the slowest on the 406k self-join (5.6 s). Keep the transactional engine for
  point/range reads; push analytical joins elsewhere. _(case #1)_
- **R3 — Politicas: go HYBRID.** PGlite for OLTP + the entity graph + serving;
  **DuckDB for the analytical layer** (agreement matrices, club discipline, per-theme
  tallies — the `kg-compute` workload *is* A3). Both read the same canonical
  ballots (Parquet export; ~80 ms load), so numbers stay reconciled. _(case #1)_

  > **STATUS: MEASURED, NOT LANDED (as of 2026-08-27).** `kg-compute` still runs on
  > the incumbent — `scripts/data-analysis/kg-compute.ts` opens the PGlite store via
  > `getStore()` and nothing in the tree imports a columnar engine. DuckDB lives only
  > in the benchmark sandbox (`scripts/db-bench/package.json`), deliberately outside
  > the product dependency tree.
  >
  > **Why the deferral is defensible, for now.** R3's win is real (43×, 5.6 s → 131 ms)
  > but it is a win on an *offline* path: `kg-compute` is a CLI script (`npm run
  > da:kg-compute`), not a request handler, so nobody is waiting on the 5.6 s. R4's
  > "don't add an engine" reasoning therefore still applies here even though the row
  > count clears its threshold — the missing condition is **who waits**, not how many
  > rows there are.
  >
  > **What would flip it.** Any of: the agreement matrix moves behind a route or a
  > user-visible refresh; the ballot table grows enough that the offline pass stops
  > fitting its window; or the analytical pass starts contending with a running dev
  > server (note that case #1 already had to `cp -r .pglite .pglite-bench` to measure
  > the incumbent at all — that copy is the contention cost showing up as an operating
  > instruction).
  >
  > **Why this note exists.** A rule written in a doc and a rule present in the import
  > graph are different states, and only the second one runs. Nothing in CI can tell
  > them apart, because a guide that recommends an engine and a script that does not
  > use it are each individually valid. Recording the gap is what keeps "we decided
  > this" from being mistaken for "we did this."
- **R4 — Single DB is fine below the analytics wall.** With only simple group-bys or
  **< ~100k rows**, PGlite alone (~100 ms) is acceptable — don't add an engine. The
  hybrid earns its keep once analytical joins over 100k+ rows are frequent or need to
  feel interactive (A3 at 5.6 s is the tipping point). _(case #1)_
- **R5 — SQLite ≈ PGlite as a row store**, sometimes faster, and zero-dependency
  (built into Node 24) — but neither is an analytical engine (both seconds on A3).
  _(case #1)_
- **R6 — Keep vectors IN the database at small/medium scale.** For **≤ ~100k
  vectors**, `pgvector` in PGlite matches a dedicated store on kNN latency
  (single-digit–40 ms) with **zero sync tax**. For Politicas (few-k to low-tens-of-k
  vectors) a dedicated vector store is **premature** — use pgvector. _(case #2)_
- **R7 — Reach for a dedicated vector store (LanceDB) when** vector volume hits the
  **millions** (ANN indexing for sub-linear kNN) **and/or** you **re-embed
  frequently** (LanceDB builds 12–14× faster). The cost is keeping it in sync with
  the source rows. _(case #2)_
- **R8 — pgvector's bottleneck is build, not query** (12–14× slower to load). Static
  "embed once, query many" → pgvector is fine; churning vectors → the dedicated
  store's fast rebuild pays. _(case #2)_
- **R9 — For text search over more than a few-thousand rows, index — don't LIKE-scan.**
  A real FTS index is **52–68× faster** (2.2 ms vs 115 ms in PGlite; 0.2 ms vs 13.6 ms
  in SQLite), for a cheap one-time build. _(case #3)_
- **R10 — At Politicas's current text scale (~9k docs), LIKE is fine** (a 9k scan is
  sub-ms–few-ms). The FTS index earns its keep once the corpus reaches tens of
  thousands+ (ingesting bill texts / transcripts) or search is interactive. _(case #3)_
- **R11 — FTS stays in the existing store — no new engine.** Postgres `tsvector`+GIN
  keeps full-text in PGlite (in-DB, transactional); SQLite FTS5 is the free, fastest
  option if you're already on SQLite. Never LIKE-scan a large corpus on PGlite. _(case #3)_
- **R12 — No graph DB at Politicas's scale.** On the real co-voting graph (203 MPs,
  ~10–20k edges, near-complete), **Kuzu lost every workload** to PGlite / DuckDB / SQLite.
  Keep traversal in the incumbent (recursive CTE); push the heavy graph aggregate to DuckDB
  (R3). Don't add a graph engine. _(case #4)_
- **R13 — Reachability ≠ path enumeration; pick the set-deduping tool for dense graphs.**
  A recursive CTE with `UNION` dedups at each depth (766 nodes, ~7 ms); Kuzu's variable-length
  pattern enumerates all paths (degree^k → **922 ms at 3 hops** on a dense graph). For "who is
  reachable" on a dense graph the row-store CTE wins big; reserve native variable-length paths
  for **sparse** graphs and genuine *path* questions (enumerate/rank paths), not reach. _(case #4)_
- **R14 — The graph self-join is columnar's job (same as OLAP).** Triangle/clique counting over
  the agreement graph is an analytical self-join: **DuckDB 20 ms ≫ row stores (188–413 ms) and ≫
  Kuzu (39 ms)** — R1/R3 extend cleanly from ballots to the KG. _(case #4)_
- **R15 — When a graph DB WOULD earn its keep (untested, the honest boundary):** millions of
  edges, a **sparse** topology, and deep (≥4-hop) *variable-length path* queries where SQL's
  intermediate materialization explodes — none of which the dense 203-node co-voting graph
  exhibits. Re-run case #4 if the graph turns large-and-sparse (cross-term co-voting,
  bill-citation networks, the money graph at scale). _(case #4)_

### Recommended Politicas architecture (from the measured cases)

**This is the target, not the current state.** Politicas runs one engine today; the
DuckDB half below is measured and deliberately not landed — see the STATUS note under
R3 for why, and for what would flip it.

A **2-engine hybrid**, split by workload shape — *not* a separate vector or graph
store at current scale:

- **PGlite (Postgres)** — OLTP, the entity graph, serving, **vectors (pgvector)**, and
  **full-text (`tsvector`+GIN)**. One engine covers everything transactional +
  search + similarity at Politicas's scale.
- **DuckDB** — the **analytical layer** (agreement matrices, discipline, tallies —
  the `kg-compute` self-joins), reading the same canonical ballots (43× faster; §case #1).

Add a dedicated **vector** store only past ~1M vectors or high re-embed churn (R7);
**do not add a graph store** — case #4 measured Kuzu on the real co-voting graph and it
**lost every workload** to the recursive-CTE row/columnar stores (R12–R15). Reconsider only
for a millions-edge *sparse* graph with deep path queries.

## Store housekeeping — what the 2 GB is, and who checkpoints it (2026-08-24)

Two facts the guide could not answer until this date: **which table the store is**,
and **when the write-ahead log gets checkpointed**. Both are now measured, and both
have a door in the repo.

### Where the bytes are

`npm run db:accounting` (`lib/db/pglite/accounting.ts`) reports per table: an exact
`count(*)`, pages allocated (`pg_total_relation_size` — heap + indexes + TOAST), and
share of the total. Measured on the `pass73-pre` copy, 2 045 MB on disk:

| table | rows | total MB | share |
|---|---:|---:|---:|
| `vote_ballot` | 2 209 200 | 489,2 | 33,1 % |
| `kg_node` | 232 655 | 392,8 | 26,5 % |
| `kg_edge` | 371 137 | 327,6 | 22,1 % |
| `kg_edge_history` | 187 249 | 101,3 | 6,8 % |
| `kg_node_history` | 65 676 | 101,3 | 6,8 % |
| everything else (13 tables) | — | 67,5 | 4,7 % |

Plus **544 MB of `pg_wal` (27 % of the directory)**, which `pg_database_size` does
not count — the two figures disagree by construction and the report says so.

- **R16 — the growth is the corpus, not the history.** The two append-only history
  tables are 13,6 % of the store; the three corpus/derivation tables are 81,7 %. A
  retention policy on the history tables would therefore not be the fix for a 2 GB
  store — which is worth knowing *before* anyone proposes deleting an audit trail to
  save disk. Retention here is deliberately unbounded (declared per table in
  `accounting.ts`, operator decision 2026-08-24), and this measurement is what makes
  that a decision rather than a drift. _(accounting, 2026-08-24)_
- Reclaimable space (dead tuples / bloat) is **not measurable on this substrate**:
  PGlite runs no stats collector, so `pg_stat_user_tables` reads all-zero even after a
  measured 1 111-row delete, and `pg_class.reltuples` is −1 until an explicit ANALYZE.
  The report names the gap instead of printing a zero that would read as evidence.
- Cost of the report: **~1 s** on this store (the 18 `count(*)`s, dominated by the
  2,2 M-row ballot scan). It trips the instrument's own 60 ms read line, which is the
  scan being honest about itself, not a defect.

### Who checkpoints, and when

PGlite runs Postgres with **no background processes**, so there is no checkpointer to
honour `checkpoint_timeout` (300 s on this store — a setting nothing here can act on).
What is left is the `max_wal_size` trigger (1 024 MB), taken **inline on whichever
write crosses it**: maintenance scheduled by a counter that knows nothing about
interactions, with the stall charged to whatever the user was touching. The 625 MB of
`pg_wal` found in the 2026-08-22 backup review, and the 544 MB above, are what that
looks like from outside.

`lib/db/pglite/maintenance.ts` puts the pass under a two-condition gate instead — the
activity gauge (operations in flight on the one connection) must read zero **and** at
least 300 s must have passed — with an escalation ladder keyed to the harm a
checkpoint actually resets:

- **R17 — key WAL pressure to unckeckpointed bytes, never to the size of `pg_wal`.**
  A checkpoint recycles segments in place and never returns them to the OS, so the
  directory does not shrink; a ladder keyed to directory bytes latches open forever.
  `pg_wal_lsn_diff(pg_current_wal_lsn(), redo_lsn)` is the figure a checkpoint does
  reset — measured 151 240 B after a small write, 208 B after `CHECKPOINT`. The rungs
  are 64 MB (pressure, overrides the interval) and 512 MB (forced, overrides the gauge
  and says so on the warn channel), against the engine's own 1 024 MB inline trigger.
  _(maintenance, 2026-08-24)_

A pass costs **6,4–42,1 ms** measured on the 2 GB store. Every pass, every
wanted-but-deferred consideration and every failure lands in a bounded ledger
(`maintenanceReport()`), because a log that records only successes cannot tell a
healthy store from a scheduler that has been deferring for a month.

### What a crash costs

- **R20 — this store survives a process crash, not a power cut, and that is a
  decision.** Read from `pg_settings` 2026-08-24: `wal_level=replica`,
  `full_page_writes=on`, `synchronous_commit=on` — and **`fsync=off`, source
  `command line`**, i.e. set by PGlite itself, with no `set fsync = on` reachable
  from SQL and no config file this repo owns. So commits are journaled and an
  unclean exit recovers, but nothing is ever forced to the platter. That is
  defensible here for a reason worth stating rather than assuming: 13 of the 18
  tables are mirrors of published dumps or recomputable derivations (see the
  accounting table above), and the five that are not are what `npm run db:backup`
  copies. `lib/db/pglite/durability.ts` asserts the four settings on every boot —
  engines silently fall back on sandboxed or network paths — and a mismatch
  prints what the store promises **instead**. _(durability, 2026-08-24)_

The claim is tested, not cited: `durability.test.ts` has a child process commit a
row and exit without closing the connection, then reopens the directory and finds
the row after recovery — and, from the failure side, copies the store WITHOUT
`pg_wal` and asserts the copy is rejected rather than silently accepted. That
second one is the classic data-loss backup: between checkpoints, committed data
lives only in the journal.

### The schema door

`open()` replays the whole `CORE_DDL` at every boot behind `if not exists`
guards. That is a ledger-less design, and its cost is that a boot which CHANGES
the schema looked exactly like the thousand boots that only re-assert it — so
nothing could ever have snapshotted before a change.

- **R18 — a guarded-replay schema has an is-work-pending signal after all: the
  catalog.** Every step `CORE_DDL` performs is a guarded CREATE or ADD COLUMN, so
  the work it would do is exactly the difference between what it declares and
  what `pg_tables` / `pg_indexes` / `information_schema.columns` already carry.
  `lib/db/pglite/pending.ts` computes that difference in three reads (measured on
  the 2 GB copy: detect + full DDL replay = **42 ms**), which buys the refinement
  a ledger-less design is normally told it cannot have — snapshot when work is
  pending, take zero snapshots when it is not, instead of copying 2 GB on every
  boot. It is one-way by design (declared → present); the other direction is
  `npm run db:snapshot -- --check`. _(premigration, 2026-08-24)_
- **R19 — "it opened" is not a verified backup on this engine.** Given a
  directory it cannot read as a store, PGlite does not fail — it INITIALIZES A
  NEW ONE. Measured: deleting `global/pg_control` from a 19 MB provisioned copy,
  and deleting `base/` outright, both produced a connection that opened cleanly
  and answered queries with **zero tables**. A verifier that only asks "did it
  open" therefore certifies a gutted copy as recoverable. `verifyStoreCopy()`
  requires the reopened copy to come back carrying tables. _(premigration,
  2026-08-24)_

The ceremony lives in `npm run db:migrate` (detect → snapshot → verify by
reopening → apply → re-check) and `npm run db:restore` (verify the copy, move the
damaged store aside — never delete it — put the file set back, verify again). The
restore path is exercised in `lib/db/pglite/premigration.test.ts` rather than
first attempted in an incident. One Windows-specific fact found while doing that:
a PGlite open that FAILS still holds the directory in that process, so the rename
that moves a damaged store aside comes back `EPERM` — which is why restore is a
separate process and not a recovery branch inside the app.

## The as-of contract — record time enters the Store (2026-09-04)

`asOf(at)` had existed since the bitemporal kg tables landed, but it was declared
on the PGlite kg repository only, with a comment saying a later batch could lift
it, and its sole non-test caller was `scripts/data-analysis/kg-repair-orphans.ts`.
The consequence was not a missing feature but a missing *sentence*: no
reader-facing surface could answer "what did this address say on the day it was
cited". `KnowledgeGraphRepository` now carries it, plus the reads a citation
surface actually needs. Three things about the contract are load-bearing.

**The whole-relation lister and the point reads are different instruments, and
the type does not say so — the comments do.** `asOf(at).listKgEdges()` runs over
an un-indexed `UNION ALL` of serving + history: a forensic instrument, fine for
a script, wrong for a page. `asOfNode(id, at)` / `asOfEdge({src,rel,dst}, at)`
push the key filter INSIDE both legs of that union, so they ride
`kg_node_history_id_idx` / `kg_edge_history_key_idx` and touch one claim's
versions. Anything reader-facing takes the point reads; `getReceiptData` is the
worked example, and it deliberately does not spend a second `kgNeighbours` on
the as-of leg.

**The epoch rule is typed, not documented-and-hoped.** A point read before the
oldest `recorded_at` the store carries answers `{ known: false, epoch }` and no
value. The bitemporal migration stamped every pre-existing row with ONE shared
`recorded_at` (the same fact `repositories/changes.ts` calls its silent event
zero), so a span that "contains" an earlier day is an artefact of the migration,
not knowledge about that day; returning the value would render as "unchanged
since then", which the record cannot support. The union has a third arm that
matters as much: `{ known: true, value: null }` means "we kept records then and
this claim was not among them" — a different sentence, and surfaces must not
collapse the two.

**`bitemporalEpoch()` is memoised per repository instance, and that is safe for
a structural reason.** History is append-only and every write path archives
rather than deletes — `clearKg` included — so the minimum `recorded_at` never
moves. Without the memo, an un-indexed `min()` over four columns would run on
every receipt. A failed read clears the memo so the next caller retries rather
than inheriting a rejection.

`lastKgNodeVersion` / `lastKgEdgeVersion` complete the set: the newest version
the store ever recorded for a key, current or not. That is what an address
today's graph no longer carries can honestly show — disclosed as history, with
both instants, never re-promoted to a current claim (no ClaimReview, no counting
anywhere else).

No DDL changed. `BitemporalKnowledgeGraphRepository` survives as a deprecated
alias so no import moved.

## Roadmap — experiments to add

1. **OLAP** over 406k ballots — PGlite vs DuckDB vs SQLite _(✓ done — case #1)_.
2. **Graph traversal** — recursive-CTE co-votes/committee walks vs Kuzu _(✓ done — case #4,
   on an x64/Windows box; Kuzu installs from a bundled prebuilt, no build. Verdict: no graph
   DB needed at this scale)_.
3. **Full-text** — `tsvector`/GIN vs FTS5 vs LIKE _(✓ done — case #3)_.
4. **Vector** — pgvector (in-DB) vs LanceDB _(✓ done — case #2)_.
5. **OLTP** — one-MP-profile read path: PGlite vs SQLite; is Postgres overkill for
   the serving layer?

Each result appends a *Measured case* + one or more *Decision rules*, growing this
into a portable "single vs hybrid, and which engine" playbook.

## Engine watch — assessed on documentation, not benchmarked (2026-08-27)

Every rule above cites an experiment. This section deliberately does not, and says
so in its title: it records engines we **read about and declined to bench**, with
the reasoning that made benching unnecessary. It exists because "we never looked at
it" and "we looked and it does not clear our measured bar" are different states, and
only the second one is a decision.

### LatticeDB — declined for now (embedded property graph, Zig, row-oriented)

An embedded single-file property-graph engine with native HNSW vector search, BM25
full-text and durable change streams, queried through one Cypher dialect. On the face
of it, it is aimed at four of our five workload classes at once.

**Why it does not need a bench here.** Its own documentation concedes the class that
decides for us: a query touching most of the graph will lose to a columnar layout,
and it calls that a structural property of row orientation rather than a tuning
problem. That class is the analytical aggregate — case #1's A3 self-join and case
#4's G2 triangle count — and it is the **only** class in which any measured case here
recommended adding an engine (R1, R3, R14). The four classes it consolidates are the
four in which our measured verdict was already *stay in the incumbent* (R6 vectors,
R10/R11 full-text, R12/R13 traversal). An engine strong exactly where we measured "no
new engine needed" and structurally weak exactly where we measured "a new engine
pays" is not a candidate for our workload, whatever its latency table says.

**Its comparison figures do not change that, and it is unusually honest about why.**
The site's headline table puts LatticeDB against Kùzu, Neo4j, pgvector, Qdrant and
others; the docs then state, *above* the table rather than in a footnote, that only
the SQLite row is measured head to head on one machine and the rest are published
third-party numbers on hardware they do not control — and instruct the reader to
treat the graph comparison as "worth investigating on your own data", not as a
result. That is the disclosure most vendor tables omit, and taking it at its word is
what makes this a documentation assessment rather than a benchmark we skipped.

**Where it would be genuinely strong**, and worth remembering: the hybrid-retrieval
query, where vector distance, text relevance and traversal all constrain one result
set. Assembling that on our stack means pgvector plus `tsvector`/GIN plus a recursive
CTE, combined in application code. That is a real seam cost, and it is the one thing
here no per-class benchmark measures — see R17.

**Also noted, for R15's boundary:** Kùzu, the engine case #4 benchmarked, was
acquired by Apple and its repository archived in October 2025; it has had no commits
since. The live continuation is the community fork **LadybugDB**, which is columnar
and moving toward a lakehouse shape (Arrow/Parquet/DuckDB interop). If R15's
conditions ever fire, LadybugDB — not Kùzu — is the engine to re-run case #4 against,
and its columnar direction means R14 would have to be re-tested rather than assumed.

- **R17 — Price a multi-modal engine in seams removed, not latency won; and read a
  comparison table row by row for who measured it.** An engine covering several
  workload classes is a real reduction in assembled machinery, but the classes it
  consolidates are usually the ones already fast enough at our scale — the decision
  is made by the class it *omits* from its benchmark suite, which follows from its
  storage layout. Separately: a benchmark table mixing head-to-head runs with
  third-party published figures is a set of numbers from different machines in one
  grid unless it labels each row, and the number that would actually decide a hybrid
  adoption — the single query spanning three classes — is one nobody publishes.
  _(method rule; not case-backed — the engine verdict above rests on cases #1, #4)_
- **R18 — A dataset is not a workload; a workload is claimed by a reader.** Before
  pricing an engine for a class, enumerate the *readers* of the data that class would
  serve and classify each as request path, offline job, export, or admin view. A class
  with no request-path reader is a record we keep, not a workload we have. Case #4 is
  the strong form of this: we did the work of building a real graph workload before
  benching a graph engine, which is why its negative result means something. The weak
  form is the common one — a schema is the most persuasive possible argument for a
  decision nobody has made. _(method rule, generalised from case #4's construction)_

### Action plan

1. **No bench, no dependency, no change to the product tree.** LatticeDB is not
   installed, not in `scripts/db-bench/package.json`, and should not be — per the
   isolation rule, an engine enters the sandbox only when we intend to measure it.
2. **Return conditions, in priority order.** Re-open this entry if any of:
   (a) R15's conditions fire — the graph turns large-and-sparse with deep
   *variable-length path* queries, at which point bench **LadybugDB** and LatticeDB
   together and re-test R14, since one is columnar and one is not;
   (b) a hybrid-retrieval path appears — a single user-facing query that must
   constrain on vector distance *and* text relevance *and* traversal — which is the
   one shape our current three-part assembly serves worst, and the only case where
   the seam argument in R17 could outweigh the analytical concession;
   (c) it ships an analytical/columnar read path, which would remove the structural
   objection above.
3. **If (b) arrives, measure the seam, not the engines.** The comparison is our
   assembled query — pgvector + GIN + recursive CTE, fused in application code —
   against the single-engine equivalent, on latency *and* on the code that
   disappears. Per R17 that number does not exist in anyone's published table.
4. **Nothing here changes R3's standing deferral.** The analytical half of the
   recommended architecture is still measured-and-not-landed, and that remains the
   highest-value open item in this guide.

## Provenance becomes a join key — and the seal reaches the graph (2026-09-04)

`kg_node` and `kg_edge` carried a free-form `provenance jsonb` and nothing else.
Three consequences, all of them things a reader could see:

- `/atlas` scored **3 of 14** declared sources. The eleven that land in the
  graph — including both that carry the whole of `/penize` — printed a paragraph
  explaining that no join key ran from a graph row to `ingest_run`.
- The Merkle seal covered eight entity tables and **zero** graph rows.
  `supplies` (19 266 rows in the snapshot cut), `linked_to`, `amends`,
  `owns_stake` — the edges readers actually cite — had no run, no seal and no
  freshness, while a half-applied score pass tripped the sentinel the same day.
- The snapshot could not say where a row came from.

### The contract, and why the columns are generated

`lib/kg/provenance.ts` declares one shape: `{source, ingest_run_id, pass, ref,
writer}`, with `source` a key of `INGESTED_SOURCES` **imported** from
`lib/analysis/atlas.ts` rather than re-listed, so a source the atlas declares is
immediately writable and a typo is a refusal instead of an unscoreable row.

`CORE_DDL` projects two of those keys into columns:

```sql
alter table kg_node add column if not exists source        text   generated always as (provenance->>'source') stored;
alter table kg_node add column if not exists ingest_run_id bigint generated always as ((provenance->>'ingest_run_id')::bigint) stored;
```

**Generated, not written by the writers**, so the column can never disagree with
the row it describes and no backfill has to keep two copies in step. **Stored,
not virtual**, because they are read by grouped counts over ~154 000 nodes and
~178 000 edges and an index over a virtual column is not available. The cast is
safe because `->>` yields NULL for an absent key and the only writer of that key
refuses anything but an integer or null.

The block is appended at the END of `CORE_DDL` under a `-- [G5 provenance
columns]` marker; `destructiveStatements()` stays empty, so `db:migrate`
proceeds loudly rather than refusing. It is proven on the PGlite test lane
(`premigration.test.ts`) — the columns project a real stamp, an absent run stays
NULL rather than becoming a fabricated 0 — and applied to the live store by
`npm run db:migrate`, never by a worktree.

### `RUN_TABLES` grows by two, at the end

`repositories/ledger.ts` seals `kg_node` and `kg_edge` filtered by
`ingest_run_id`. Two details are load-bearing:

- **Appended, never reordered.** A table added at the end can only add leaves
  for runs that actually wrote graph rows; every previously sealed run is
  byte-identical to what it was, so re-sealing an old run reproduces its root.
- **`kg_edge` seals in `(src, rel, dst)` order.** Its identity is the triple and
  it has no `id` column, so the pinned per-table order key is not cosmetic —
  ordering it by a column it lacks would throw rather than quietly produce a
  wrong root.

This had to happen BEFORE `/atlas` read the tables, not after: the integrity
rule PRINTS that the sealed set of tables and the scored set are the same set,
and scoring the graph first would have made that sentence false on the one page
whose subject is not saying false things.

### `sentinel_run`, and why it is `KEPT`

`sentinel_run(id, manifest_hash, ran_at, verdict, report)` — `id` is the
canonical content hash of the report, which makes replaying the outbox
idempotent; `verdict` carries the report's own three-state check constraint, so
a fourth value is a refusal rather than a release certified by a word nobody
defined.

Its `RETENTION` entry is `accumulating` with **its own dated decision**
(2026-09-04), not a share of the 2026-08-24 batch: a policy inherits a date only
from the day somebody actually weighed it. What was weighed — a verdict is a
historical claim ("on this date these invariants held over this exact release")
that no later run can reproduce, so pruning would erase the audit history the
table exists to keep. It grows by roughly one row per night.

### The outbox: how a read-only auditor writes

`lib/db/pglite/sentinelQueue.ts`. The sentinel never opens the live handle —
that guarantee is why it can be pointed at production data — so it appends to
`.data/sentinel-queue.jsonl` and the next live `open()` drains the file into the
table. The append fails loud; the drain is idempotent, never fatal, and empties
the file only after every entry landed. It is the same shape as the
pre-migration snapshot's discipline: the risky step is the one that gets the
verification, and nothing is discarded until its replacement is proven.

## How to run

```bash
# cases #1–3 read the live store — stage a PGlite copy (single-connection):
cp -r .pglite .pglite-bench
NODE_OPTIONS=--experimental-sqlite npx tsx scripts/db-bench/olap.ts --pglite=.pglite-bench
rm -rf .pglite-bench

# case #4 (graph) reads the portable CSV export instead of a live .pglite —
# so it runs on any device the data is shuttled to (x64, for Kuzu):
NODE_OPTIONS=--experimental-sqlite npx tsx scripts/db-bench/graph.ts --th=0.9 --seeds=8 --hops=2,3
```

Bench deps live in an isolated `scripts/db-bench/package.json` (DuckDB, LanceDB, **Kuzu**;
SQLite is Node built-in, PGlite comes from the root install) — never in the product tree.
Kuzu is **x64-only** but installs from a bundled prebuilt (no cmake build). Output goes to
`.db-bench/` (gitignored). Case #4's data is the temporary `benchmark-data/*.csv` bundle
(portable CSV export of the PSP store; see its README).

## The review door: one writer, two hash domains, no rehash (2026-09-04)

`review_audit` was tie-shaped — `src / rel / dst`, a decision, a chain position
and two hashes — and `setTieReviewState` was its only writer. That made three
other machine-produced claim kinds unreviewable by construction.

### The schema change, and the statement that is deliberately NOT in it

`CORE_DDL` grew three columns in a block marked `[G2 review door v2]`:
`subject_kind`, `subject_id`, `hash_domain`. All additive, all `if not exists`.

There is **no backfill `update` in the DDL**, for two independent reasons and
the second is the real one:

1. `pending.ts::destructiveStatements` flags `update … set` and `db:migrate`
   would refuse the DDL outright — correctly.
2. Rewriting the old rows' subject columns would make the stored bytes disagree
   with the preimage their hash was taken over. **A stored hash is evidence
   about the bytes that existed when it was taken.** Recomputing it to match new
   bytes does not preserve the evidence; it destroys it while leaving something
   that looks like evidence behind.

So legacy rows are read as `tie` + their triple **at read time** (`mapAuditRow`
in `repositories/review.ts`), their bytes are untouched, and their v1 hashes
still cover exactly what they always covered.

### Two domain tags in one chain

`politicas-audit-v1` hashes the narrow preimage; `politicas-audit-v2` hashes it
plus `subjectKind` + `subjectId`. `verifyAuditChain` walks a chain that changes
tag partway through and reads `hash_domain` **strictly**: null means v1, and only
the literal v2 tag means v2. It is never inferred from the subject columns —
those are derived for legacy rows and so prove nothing about which preimage was
hashed. Getting that backwards would fail every row written before 2026-09-04.

The one sequence it refuses is a **regression**: a v1 row appended after a v2
row. The writer only ever moves forward, so that ordering can only be authored
by hand.

### What `setReviewState` guarantees

One skeleton for every kind, in one transaction: read the subject's state → map
the decision (`confirm`→`verified`, `reject`→`rejected` **terminal**,
`needs-more`→`pending_review`) → refuse a reasonless reversal of an
already-decided claim, **writing nothing at all** → append the chained audit row
→ only then write the subject's state, superseding the prior version into
`kg_edge_history` / `kg_node_history`.

Node prop writes go through `props || $patch` (jsonb concatenation, a SHALLOW
merge) — the rule from `memory/kg-upsert-replaces-props.md`. `||` does not
recurse, so the effort branch reads `effort_provenance` first and hands back a
fully merged object; a whole-object write would have dropped every `effort_*`
prop the loop computed.

`machine` is **not producible by this function**. Only the enrichment loops write
that state, so no script can promote its own verdict to a human-confirmed one,
and no human decision can be demoted back to "nobody looked at this".

**`clubByMandate` answers the club TODAY by rule, not by scan order (2026-09-06,
scan-sweep, bounty-hunter).** The one-club-per-mandate read had no `ORDER BY`, so an
MP who changed clubs mid-term resolved to whichever membership row PGlite returned
last — insertion order, while `/zebricek`, `/penize` and `/volby` all print that
value as the current club. The query now orders closed windows first and open
windows by start date, so the last row per mandate is the open window with the
latest start; `clubByMandate.test.ts` seeds a switcher with the current club
inserted first and pins the answer.

**`listIngestRuns` carries the truncation guard every sibling lister has
(2026-09-06, scan-sweep, parity-auditor).** It was the one lister in
`repositories/` reading without `warnIfTruncated`, while `/data` derives
`lineage.runsTotal` and the release changelog from its length; the guard now fires
when the read returns exactly its cap, and `truncationGuards.test.ts` pins it.
