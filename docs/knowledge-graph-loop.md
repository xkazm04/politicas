# Self-Expanding Knowledge-Graph Loop — design plan

> **Status:** ✅ **BUILT & RUN (2026-07-23).** Phases 1–5 complete; 12 analysis passes executed;
> the flywheel confirmed by a blind controlled test. See **§0 Build status** below and the vault
> (`docs/data-analysis/`: [[coverage-ledger]], [[graph-log]], [[frontier]]).
> **Scope:** Politicas civic dataset (psp.cz, 467k rows). This is the concrete build of
> "**Case 2**" from the DataHub experiment — *agents incrementally build a knowledge graph over
> a dataset too large for any single context window, and the graph is the product that accretes.*
>
> **The claim being tested:** when analysis can **write derived knowledge back** to a store it
> later reads, the loop becomes a **flywheel** — each pass inherits everything prior passes
> learned, so discovery *compounds* instead of plateauing. Read-only context gives a one-time
> lift; a writable graph gives a growing one.

Read first: `.claude/skills/data-analysis.md` (the resumable analysis loop this extends),
`docs/data-analysis/coverage-ledger.md` (the current ledger), and the DataHub A/B write-up in the
grant repo (`grant-writing-nonprofits/docs/data-analysis/ab-datahub-2026-07-23.md`) for the
provenance of the verdict-gate + deterministic-pre-pass discipline reused here.

---

## 0. Build status (2026-07-23) — BUILT & RUN

This section is the living sync; the design below (§1–§12) is preserved as authored.

**All five build phases (§10) are complete:**
1. **Schema + deterministic layer** — `kg_node`/`kg_edge` in the pglite store (`lib/db/`); pure,
   unit-tested compute in `lib/analysis/kg.ts`; `npm run da:kg-compute`. Seed graph: 248 nodes,
   21 304 edges.
2. **Vault** — [[frontier]], [[graph-schema]], [[graph-log]], [[patterns]], [[feature-opportunities]],
   [[contradictions]], per-cluster notes, and the graph-metrics block in [[coverage-ledger]].
3. **The loop skill** — `.claude/skills/knowledge-graph.md`; the gate `lib/analysis/kg-verdict.ts`
   (schema + entity-id membership check, unit-tested) via `da:validate-kg-verdict`; verdict-derived
   nodes/edges land through `da:kg-promote`.
4. **Metrics + the controlled test** — `da:kg-metrics`; the **warm-vs-cold A/B with a blind judge**
   ([[phase4-controlled-test]]).
5. **DataHub projection** — `da:kg-datahub-sync`, the optional/disposable mirror ([[phase5-datahub-projection]]).

**The graph today:** 264 nodes (207 person · 8 party · 33 organ · 2 bloc · 14 theme) and 21 521
edges (`co_votes_with` 20 496 · `influential_in` 605 · `rebels_against` 203 · `about` 179 ·
`owns` 30 · `belongs_to` 8), plus deterministic enrichment props on every derived node. New edge
relation `owns` (committee → theme) was added during the run (§3's catalogue grows).

**12 passes run** (see [[graph-log]]). Headline discoveries: a clean two-bloc party system
(coalition vs opposition) that **sharpens to 0.998 opposition on close votes**; a 13-theme agenda
where the **budget is the sharpest battleground** and consensus is only symbolic/technical; **ODS
is its coalition bloc's fiscal outlier**; control is **consensus → majoritarian** at the Jan-2026
confidence vote (*support ≠ control*); and a **contestedness-weighted independence** measure that
correctly demotes free-vote rebels. Committee jurisdiction (`owns`) closes the vote→theme→committee
chain.

**The flywheel — CONFIRMED (§7):** the blind controlled test found WARM (accumulated graph+vault)
beats COLD (raw substrate) on finding depth (4.6 vs 2.0) at equal grounding and *lower* token cost;
the judge independently identified that WARM's findings require prior derived layers while COLD's
are re-derivable from raw stats. The compounding is concentrated in **accumulated depth** — the
deterministic passes (F11/F16/F17/F3-F7) produced headline findings at ~0 tokens by consuming prior
passes' written-back edges/props, which is impossible read-only. Three **contradictions** (C1–C3)
were caught and resolved — the loop corrected its own earlier reads, a benefit only a re-readable
store provides.

**Convergence:** the frontier grew (5→8→11→12) then **turned down** (→4 open) as passes closed more
than they spawned. Remaining open items are **staleness-driven** (F5/F10 — re-run on re-ingest) or
narrow (F4/F9). Everything genuinely new from here needs **external data**: the money layer (F6 —
`lib/analysis/kg-money.ts` is built + tested but blocked on Registr smluv/ARES + an MP↔company
linkage; fabrication forbidden per §11) and the formal bill→committee source (F15 — psp.cz `tisky`).

**The risks in §11 held up:** the flywheel was NOT weak (§7 test positive); bloc/theme naming stayed
disciplined (gated, membership-checked); the money layer is honestly blocked, not faked; write-order
(vault + pglite first) kept tier 3 a pure projection; cost stayed near-zero on the deterministic
compounding passes.

---

## 1. What we are building

A loop that, over many cost-bounded passes and sessions, turns the raw Politicas entity tables
into a **derived knowledge graph** plus two by-products the app needs — **data patterns** and
**feature opportunities** — while staying **aware of its own progress** so any session resumes
cleanly.

Three outputs, one loop:

1. **Knowledge-graph edges** — relationships the raw data does *not* state but that analysis can
   derive and ground: `MP —co-votes-with→ MP`, `MP —rebels-against→ Party`, `MP —belongs-to→
   VotingBloc`, `Vote —about→ Theme`, `MP —influential-in→ Organ`, and (once money data lands)
   `MP —linked-to→ Company —supplies→ Contract`. The graph is the accreting product.
2. **Data patterns** — durable findings ("party X's cohesion collapses on EU votes"), written to
   the vault, feeding the graph and the app.
3. **Feature opportunities** — the app's five modules (CivicScore, VoteTrack, FollowTheMoney,
   BudgetMirror, LawWatch) are *vaguely specified*; each pattern grounds a concrete, evidence-cited
   product proposal (e.g. "CivicScore's Independence pillar should weight *contested-vote*
   rebellion, not raw rebellion — here's why, with MP ids").

The **self-expansion**: discovering an edge or pattern *spawns its own next questions* (the
frontier). Finding a rebel cluster → "what themes do they rebel on?" → finding a theme → "which
committees own it?" The loop generates its own work-list; it doesn't run a fixed checklist.

---

## 2. Persistence — three tiers, memory of record is Lite-independent

This is the load-bearing decision, and it is what makes the whole thing survive dropping DataHub
Lite. **The durable memory is the vault + the app's own database. DataHub is an optional mirror.**

| Tier | What it holds | Durability | Role |
|---|---|---|---|
| **1. Obsidian vault** (`docs/data-analysis/`) | Narrative findings, the coverage ledger, the frontier queue, per-cluster notes, the graph change-log, feature opportunities — all `[[wikilinked]]` | **Git-tracked markdown. Survives everything.** | **Primary memory.** Human- and agent-readable. The system of record for *why* an edge exists and *what's been explored*. |
| **2. pglite graph tables** (`kg_node`, `kg_edge` — new) | The structured graph: typed nodes, typed weighted edges, provenance per edge | **The app's own DB. Survives.** Feeds the product's features directly. | **The queryable graph.** What the app reads; what deterministic passes compute into. |
| **3. DataHub (Lite or GMS)** | A projection of tiers 1–2 as datasets + lineage, for cross-system context and external agent access | **Disposable.** Rebuildable from tiers 1–2 at any time. | **Optional mirror.** If we drop Lite, we lose nothing durable — a sync script re-projects. |

Rule: **never let tier 3 be the only home of any fact.** Every edge and finding lands in tier 1
(narrative + provenance) and tier 2 (structured) first; the DataHub sync is a downstream,
idempotent re-projection. This is exactly the decoupling the DataHub experiment argued for.

---

## 3. The knowledge-graph schema (tier 2)

New pglite tables, following the existing `slice_quality` pattern (derived metadata, never a
source-of-truth for raw entities, never clobbered by a corpus re-sync).

```
kg_node(
  id            text primary key,      -- e.g. "bloc:eu-sceptics", "theme:defense", or a raw urn "psp:person:6790"
  kind          text not null,         -- person | party | organ | bloc | theme | company | contract (extensible)
  label         text not null,
  props         jsonb,                 -- derived attributes (rebellion_rate, cohesion, centrality…)
  first_seen_pass int,                 -- which pass created it (self-awareness)
  provenance    jsonb                  -- how it was derived (deterministic computation id or verdict id)
)

kg_edge(
  src           text not null,         -- kg_node.id (or a raw entity natural key)
  rel           text not null,         -- co_votes_with | rebels_against | belongs_to | about | influential_in | linked_to | supplies
  dst           text not null,
  weight        real,                  -- agreement rate, rebellion rate, centrality, amount…
  props         jsonb,
  provenance    jsonb not null,        -- {pass, method: "deterministic"|"verdict", ref, computed_at}
  primary key (src, rel, dst)
)
```

- **Every edge is provenanced and recomputable.** A deterministic edge (co-voting rate) can be
  rebuilt from raw ballots; a verdict-derived edge (a named bloc) cites the gated subagent verdict.
- **Nodes are typed and extensible** — money nodes (`company`, `contract`) are declared now but
  only populated once Registr smluv / ARES land (flagged in the frontier as `blocked-on-data`).
- The app's features read `kg_edge`/`kg_node` directly — this is what makes the analysis *ship*
  into the product, not just sit in a report.

---

## 4. The loop — one pass

Extends the base `data-analysis.md` loop; the new parts are the **frontier**, the **graph write**,
and the **self-expansion**.

1. **Read state** — load `[[coverage-ledger]]`, `[[frontier]]`, and current graph metrics from the
   vault. This is the resume point; a fresh session starts here with zero prior context.
2. **Pick a frontier item** — the highest-value unexplored target. Frontier items are typed:
   `analyze-cluster`, `test-hypothesis`, `expand-node`, `recompute-edge`, `blocked-on-data`.
   Prioritize by potential (unexplored high-degree nodes, contested votes) and staleness.
3. **Deterministic pre-pass (NO LLM) — owns all numbers.** Compute the quantitative substrate in
   SQL/matrix over pglite: co-voting agreement matrices, rebellion rates, party cohesion, organ
   centrality, absence patterns. **The LLM never authors a count** (the hard-won rule — a subagent
   overcounted 2× in the grant sweep). Over 406k ballots this is a computation, not a prompt.
   Deterministic edges (co-voting, rebellion) are written to `kg_edge` here, provenance
   `method: deterministic`.
4. **Fan cost-efficient subagents (Sonnet) — the qualitative layer.** Each reads the deterministic
   matrices as ground truth + accumulated context (vault notes + graph neighborhood) for its target,
   and returns a **gated verdict** that:
   - names/ interprets structure (a bloc, a theme) → proposes `kg_node`s + verdict-derived edges,
   - records data patterns,
   - proposes feature opportunities (cited to entity ids),
   - **emits new frontier items** (the self-expansion — what this finding makes worth exploring next).
   Feed each subagent computed aggregates + *sampled exemplar* roll-calls, never 406k raw ballots.
5. **Gate every verdict** — schema validation + **entity-id membership check** (reuse
   `validate-verdict.ts --rows`): reject any asserted MP/party/edge whose id is not a real entity.
   This is what keeps a *hallucinated politician or fabricated edge* out of the graph. Non-conforming
   verdicts are discarded and re-run; the graph accretes only grounded, valid knowledge.
6. **Persist (all three tiers, in order):**
   - **Vault:** append findings to the cluster note, `[[patterns]]`, `[[feature-opportunities]]`;
     append the pass's added edges to `[[graph-log]]` (audit trail); update `[[frontier]]`.
   - **Graph (pglite):** upsert the verdict-derived `kg_node`/`kg_edge` (deterministic ones already
     written in step 3).
   - **DataHub (optional):** idempotent re-projection via a `kg-datahub-sync` script.
7. **Update self-awareness** — write graph metrics to `[[coverage-ledger]]`: node/edge counts,
   edges-added-this-pass, frontier size, coverage %, cost (tokens) this pass, cost-per-edge.
8. **Loop** — until budget or the frontier is dry (K consecutive passes add no new nodes/edges/
   frontier items). In autonomous mode, self-pace with a wakeup between passes so a fresh session
   can interleave.

---

## 5. Memory design — the vault (tier 1)

Mirrors the grant repo's proven vault, extended for the graph. All notes `[[wikilink]]`.

- **`[[coverage-ledger]]`** — THE DRIVER. Per-cluster/target: status (`pending`/`covered`/`stale`),
  lastPass, quality, notes-link. Plus a **graph-metrics block** updated each pass (nodes, edges,
  density, frontier size, cost-per-edge over time) — the self-awareness surface.
- **`[[frontier]]`** — the self-expanding work queue. Each item: kind, target, why (which finding
  spawned it), priority, blocked-on. This is what makes the loop generate its own next work.
- **`[[graph-schema]]`** — the evolving node/edge-type catalogue (starts with §3, grows as new
  relationship kinds are discovered).
- **`[[graph-log]]`** — append-only, per-pass: edges/nodes added, with provenance. The audit trail
  that lets a human (or a contradiction check) see how the graph grew.
- **`cluster-<name>.md`** — per-cluster qualitative findings (e.g. `cluster-eu-sceptics.md`).
- **`[[patterns]]`** — durable data patterns.
- **`[[feature-opportunities]]`** — product proposals, each tagged to a module (CivicScore /
  VoteTrack / FollowTheMoney / BudgetMirror / LawWatch) with the evidence entities.
- **`[[contradictions]]`** — where a re-analysis disagreed with a stored finding (see §7).

Because tier 1 is git-tracked markdown, **the entire memory survives if DataHub Lite is deleted** —
and a future session with no context can reconstruct the full state from it.

---

## 6. Cost efficiency — the subagent economics

The user's constraint: *systematically dispatch cost-efficient subagents.* Concretely:

- **Deterministic-owns-numbers.** All counting/matrix work is SQL, not tokens. The single largest
  cost saving: co-voting over 406k ballots is never an LLM task.
- **Sonnet for the qualitative layer, Opus sparingly.** Routine pattern/edge interpretation = Sonnet.
  Reserve Opus for a periodic **completeness-critic** pass ("what modality is unexplored, what claim
  is unverified, what should the frontier prioritize next?").
- **Sample, never dump.** Subagents get computed aggregates + a handful of exemplar roll-calls, not
  raw ballots. Full descriptions where they exist are never truncated (a clipped field reads as a
  data defect), but volume is bounded by aggregation.
- **The ledger prevents rework.** Covered targets aren't re-analyzed unless stale; the frontier
  steers tokens at unexplored high-value nodes.
- **Parallel fan-out where independent** (the workflow pattern), barrier only where a pass needs the
  whole prior round (dedup/synthesis).
- **Budget-aware loop.** Scale fan-out and depth to a per-session token target; log what was dropped
  (no silent truncation).

---

## 7. Self-awareness & observation (test the flywheel)

The hypothesis is that discovery **compounds**. That is measurable, and measuring it *is* the test.

**Per-pass metrics** (written to `[[coverage-ledger]]`, optionally rendered by a small
`scripts/data-analysis/kg-metrics.ts`):
- nodes added, edges added, frontier size (should grow early, then shrink as coverage completes),
- coverage % of the seeded question space,
- tokens spent, **cost-per-edge and cost-per-pattern** (the efficiency signal),
- **reuse rate** — fraction of a pass's cited evidence that references *prior-pass* findings/edges
  (the flywheel signal: is later work standing on earlier work?).

**The controlled test (does writing buy us the flywheel?):**
- **Warm arm:** run the loop normally — each pass reads the accumulating graph + vault.
- **Cold-control arm:** run the same targets with the graph/vault context *withheld* (each pass
  blind, like the current independent mode).
- **Compare:** discovery rate (edges/patterns per pass), quality (gated-verdict pass rate,
  contradiction rate), and cost-per-discovery, across the sequence.
- **Success = the warm arm's cost-per-discovery falls and its reuse-rate rises across passes,
  while the cold arm stays flat.** That is the flywheel, quantified. If both are flat, write-back is
  ceremony and read-only suffices — a real, publishable negative result.

**Contradiction detection** (a distinct benefit of writing): when a pass re-touches a node, diff its
new finding against the stored one; log disagreements to `[[contradictions]]`. Catches data-refresh
degradation and model drift on a dataset that's otherwise static.

---

## 8. Politicas-specific graph targets (seed frontier)

Concrete, discoverable, grounded in the tables that exist today:

1. **Co-voting graph** (deterministic) — agreement matrix over `vote_ballot`; edges `co_votes_with`.
   Seeds bloc discovery.
2. **Rebellion** (deterministic) — per-MP votes against party majority; edges `rebels_against`,
   node prop `rebellion_rate`. Excludes the 16 voided (zmatečné) votes (known ledger caveat).
3. **Voting blocs** (Sonnet over the matrix) — name clusters, `belongs_to` edges. Frontier spawn:
   "what themes bind each bloc?"
4. **Themes** (Sonnet over vote titles/aggregates) — `Vote —about→ Theme`. Frontier spawn: "which
   organ owns each theme?"
5. **Committee influence** (deterministic centrality over `membership`/`organ`) — `influential_in`.
6. **Money graph** (`blocked-on-data`) — `MP —linked-to→ Company —supplies→ Contract`, via IČO joins
   to Registr smluv (the `smlouvy-dump-watch` Pumper app now surfaces the dumps) + ARES. Declared in
   the schema, flagged in the frontier as blocked until ingested — a self-aware gap, not a silent one.

Each closed target *should* leave the frontier larger than it found it (early passes) — that growth,
then its eventual convergence, is the observable signature of a healthy self-expanding loop.

---

## 9. Feature-opportunity output (feeding the vague app)

The app's modules are under-specified; the loop grounds them from evidence:
- **CivicScore** — propose pillar definitions/weights from what actually differentiates MPs
  (e.g. rebellion on *contested* vs unanimous votes).
- **VoteTrack** — define rebellion/discipline/attendance metrics from the deterministic layer.
- **FollowTheMoney** — the money sub-graph (blocked on Registr smluv/ARES; the opportunity note
  states the dependency and the expected edge shape).
- **BudgetMirror / LawWatch** — flagged as data-blocked until their sources ingest; opportunities
  captured for when they do.
Each opportunity in `[[feature-opportunities]]` cites the entities/patterns that motivate it, so the
product decision is evidence-backed, not vibes.

---

## 10. Build phases (for the execution session)

1. **Schema + deterministic layer.** Add `kg_node`/`kg_edge` to the pglite store + Store interface;
   write `scripts/data-analysis/kg-compute.ts` (co-voting, rebellion, cohesion, centrality → edges).
   *No LLM yet.* Verify edge counts against hand-checks. Gate green (`npm run check` + tests).
2. **Vault scaffolding.** Create `[[frontier]]`, `[[graph-schema]]`, `[[graph-log]]`,
   `[[feature-opportunities]]`, `[[contradictions]]`; extend `[[coverage-ledger]]` with the
   graph-metrics block. Seed the frontier (§8).
3. **The loop skill.** Author `.claude/skills/knowledge-graph.md` (extends `data-analysis.md`):
   pick → deterministic pre-pass → Sonnet fan-out (verdict schema + graph-edge proposals) → gate →
   persist 3 tiers → update awareness → expand frontier → loop. Reuse the verdict gate + membership
   check verbatim.
4. **Metrics + the controlled test.** `scripts/data-analysis/kg-metrics.ts` (per-pass metrics);
   run the warm vs cold-control arms (§7) over the seed frontier; record cost-per-discovery and
   reuse-rate curves.
5. **Optional DataHub projection.** `scripts/data-analysis/kg-datahub-sync.ts` — idempotent
   re-projection of `kg_node`/`kg_edge` as datasets + lineage. *Explicitly optional and disposable*;
   the loop must be fully functional with it turned off.

Land phase 1 properly before 3 — a real deterministic graph beats a hallucinated LLM one, and it's
the ground truth the subagents read.

---

## 11. Risks & open questions

- **Flywheel might be weak.** The controlled test (§7) is designed to *disprove* it cheaply. Run it
  early — if cost-per-discovery doesn't fall, stop and reconsider before building the money layer.
- **Bloc/theme naming is subjective.** Mitigate with the deterministic matrix as ground truth and
  the membership gate; blocs are *named* by the LLM but *defined* by the computation.
- **Money layer is blocked** on Registr smluv/ARES ingestion — the highest-value edges
  (FollowTheMoney) can't land until that data does. The frontier tracks this honestly; don't fake it.
- **Vault/graph divergence.** Enforce write-order (vault + pglite first, DataHub last) and make the
  DataHub sync a pure projection so tier 3 can never hold an unbacked fact.
- **Cost creep** on 467k rows. The deterministic-owns-numbers rule is the guardrail; watch
  cost-per-edge in the ledger and cap fan-out per pass.

---

## 12. How a future session starts here

1. Read this doc, then `[[coverage-ledger]]` + `[[frontier]]` — the pending frontier items *are* the
   remaining work; the graph-metrics block says how far along we are.
2. If phase 1 isn't built, start there (schema + deterministic edges). Otherwise pick the top
   frontier item and run one pass.
3. Everything needed to resume is in the vault + `kg_*` tables — no context from the design session
   is required. That is the point: the memory outlives the session *and* outlives DataHub Lite.
