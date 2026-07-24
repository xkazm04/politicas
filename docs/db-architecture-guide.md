# DB architecture guide — which database(s) for which operation

**Purpose.** A reusable, *measured* decision guide for database design: given an
operation and a data scale, which engine (single) or combination (hybrid) to use —
so Politicas and sibling projects can make the DB-choice from evidence, not folklore.
Every rule here is backed by an experiment on Politicas's real datasets
(`scripts/db-bench/`), which are rich enough to exercise every workload class:

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
