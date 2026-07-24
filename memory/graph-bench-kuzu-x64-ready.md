---
name: graph-bench-kuzu-x64-ready
description: Graph benchmark (case #4) DONE on this x64 box — Kuzu lost every workload; no graph DB needed at Politicas scale
metadata:
  type: project
---

**RESOLVED 2026-07-24 — case #4 ran; verdict: NO graph DB.** `scripts/db-bench/graph.ts`
(4 engines: PGlite/SQLite/DuckDB recursive-CTE vs Kuzu Cypher) over the real
`co_votes_with` graph (θ≥0.9: 10,056 edges / 203 MPs, near-complete + bimodal).
All counts cross-checked identical. **Kuzu won nothing:** deep traversal `*1..3`
enumerates paths → **922 ms, ~130× slower** than the row-store recursive CTE
(reach saturates at 2 hops anyway — H2==H3); the heavy triangle self-join is a
**DuckDB** win (20 ms, mirrors OLAP A3), not a graph-DB win; the sparse
heterogeneous join is sub-5 ms everywhere. Recorded as case #4 + rules R12–R15 in
`docs/db-architecture-guide.md`; DEFERRED markers flipped there + in
`hybrid-benchmark-plan.md`. A graph DB would only earn its keep on a
*millions-edge sparse* graph with deep path queries — not this dense 203-node one.

Setup facts that made it runnable (still true):

The DB-architecture graph benchmark (`docs/db-architecture-guide.md` roadmap #2 /
"case #2-graph") was **deferred as "ARM can't build Kuzu"** — but that caveat is
specific to the original ARM dev box. **This machine is `win32 / x64` (Node 24)**,
so the blocker is gone:

- `kuzu@0.11.3` installs from a **bundled prebuilt** (`prebuilt/kuzujs-win32-x64.node`,
  copied by its `install.js`) — **no cmake/MSVC build** despite the deprecation
  warning and `cmake-js` dep. Added to `scripts/db-bench/package.json` (isolated
  bench tree, not the product). ~36s install, ~525 MB unpacked tarball. Note: the
  Kuzu GitHub release only ships CLI/libkuzu assets; the Node addon prebuilts ride
  *inside* the npm tarball.
- **Data comes from `benchmark-data/*.csv`** (committed on the remote
  `github.com/xkazm04/politicas` master, one commit ahead — fast-forwarded in). The
  gitignored `.pglite` / `.data` never transfer between devices; these CSVs are the
  portable substitute (406k `vote_ballot`, 22,560 `kg_edge` incl. the 20,496
  `co_votes_with` traversal edges). Directory is **TEMPORARY** (README says delete +
  re-gitignore after cross-device runs). Also carries the money edges (`supplies`
  951, `linked_to` 88) the doc's 21,521 count predates.
- **PGlite is the recursive-CTE baseline and was MISSING** from root `node_modules`
  (declared dep, stale tree → `npm ls` empty). A root `npm install` restores it
  (0.4.6); without it *every* bench script fails, not just the graph one — they all
  `import { PGlite } from "@electric-sql/pglite"` ("comes from the root install").
- **Validated end-to-end:** loaded real co_votes into both engines; 2-hop undirected
  reachability from a seed **cross-checks at 202** (PGlite recursive-CTE == Kuzu
  var-length `*1..2`). Stack is READY.

Gotcha for future graph work: Kuzu's idiomatic Cypher variable-length `*1..k`
**enumerates every path** (degree^k), so on a *dense* graph a recursive CTE with
`UNION` (set-dedup per depth) crushes it for *reachability*. Native var-length paths
only pay off on *sparse* graphs and genuine path-ranking questions. See
[[rendering-gotchas]] for sibling SSR-determinism caveats.
