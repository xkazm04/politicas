---
name: knowledge-graph
description: Run the self-expanding knowledge-graph loop over the politicas civic corpus — pick a frontier target, compute the deterministic substrate, fan a gated Sonnet subagent that names structure (blocs, themes) + proposes graph edges/patterns/feature-opportunities + spawns its own next questions, then persist the accreting graph to the vault + kg_node/kg_edge. Use when the user says "run the knowledge-graph loop / kg loop", "discover blocs/themes", "expand the graph", "work the frontier", or wants Case 2 to run a pass.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Knowledge-Graph Loop — the self-expanding graph over the civic corpus

The concrete build of **Case 2** (design: `docs/knowledge-graph-loop.md`). A
resumable loop that turns the raw Politicas entity tables into a **derived
knowledge graph** that *accretes across passes*, plus two by-products — **data
patterns** and **feature opportunities**. Each pass inherits everything prior
passes learned (the graph + the vault), so discovery is meant to **compound**.

Extends `.claude/skills/data-analysis.md` (read it first). The new parts are the
**frontier**, the **graph write-back**, and the **self-expansion**: discovering an
edge or pattern *spawns its own next questions*. Read `docs/knowledge-graph-loop.md`
(the full design) and, at the start of every pass, `[[coverage-ledger]]`
(graph-metrics block) + `[[frontier]]`.

## The persistence contract — memory of record is the vault + the app DB

Three tiers (design §2). **Never let the optional DataHub mirror be the only home
of any fact.**

1. **Vault** (`docs/data-analysis/*.md`) — narrative + provenance + the frontier.
   Git-tracked markdown; survives everything. System of record for *why* an edge
   exists and *what's been explored*. Notes: `[[frontier]]`, `[[graph-schema]]`,
   `[[graph-log]]`, `[[patterns]]`, `[[feature-opportunities]]`, `[[contradictions]]`,
   `cluster-<name>.md`, and the graph-metrics block in `[[coverage-ledger]]`.
2. **Graph** (`kg_node` / `kg_edge` in PGlite, `lib/db/`) — the structured, queryable
   graph the app reads. Deterministic edges are written by `kg-compute`; gated
   verdict-derived nodes/edges by `kg-promote`.
3. **DataHub** — optional, disposable, rebuildable projection. Out of scope until
   the loop is proven.

## The two-writer rule — the LLM never authors a number

- **Deterministic layer owns every count** (`lib/analysis/kg.ts` via
  `npm run da:kg-compute`): co-voting agreement, rebellion rates, cohesion,
  committee degree. A subagent that authored a count is the documented failure mode
  (a grant-sweep subagent overcounted 2×). Over 406k ballots this is a computation,
  not a prompt.
- **Subagents own interpretation only**: name a bloc/theme, read a pattern, propose
  a feature, spawn frontier items — all *grounded in* the deterministic matrices and
  gated before anything lands.

## The loop — one pass

1. **Read state.** `[[coverage-ledger]]` graph-metrics + `[[frontier]]`. The pending
   frontier items ARE the remaining work; the metrics block says how far along.
2. **Pick a frontier item** — highest `priority`, `open`, not `blocked`. Prefer
   unexplored high-degree targets and contested structure over staleness early on.
3. **Deterministic pre-pass (NO LLM) — owns all numbers.**
   ```bash
   # refresh + verify (dry-run prints the hand-check block); PGlite is single-connection
   cp -r .pglite .pglite-copy
   PGLITE_PATH=./.pglite-copy DB_DRIVER=pglite npx tsx scripts/data-analysis/kg-compute.ts
   ```
   Deterministic edges are already in `kg_edge` (re-`--commit --reset` only if the
   source re-ingested). For an interpretive item, compute the **aggregates the
   subagent will reason over** from `kg_node`/`kg_edge` (e.g. for blocs: each MP's
   top co-voting neighbours + club + rebellion_rate; the cross-club high-agreement
   pairs). Write them to `./.kg-analysis/<target>.json`. **Aggregates + sampled
   exemplars only — never 406k raw ballots.**
4. **Fan a cost-efficient Sonnet subagent** (parallel + one message if several
   independent targets). Give it: the frontier target, its aggregate file, the graph
   neighbourhood, the accumulated vault notes for the target — and the **KgVerdict
   schema requirement**, nothing else. Prefer tool-layer enforcement:
   `agent(prompt, { schema: kgVerdictJsonSchema, model: 'sonnet' })`. It returns a
   verdict that **names/interprets structure → proposes `kg_node`s + verdict edges**,
   **records patterns**, **proposes feature opportunities (cited to entity ids)**,
   and **emits new frontier items** (the self-expansion).
5. **Gate every verdict** — schema + the entity-id membership check. This is what
   keeps a *hallucinated politician or a fabricated edge* out of the graph.
   ```bash
   npm run da:validate-kg-verdict -- ./.kg-analysis/verdicts/<target>.json
   ```
   Rejects: an invented field, an out-of-vocab kind/rel/module, an edge endpoint or a
   prose-cited `psp:*` urn that is not a real entity/declared node. **On drift:
   discard, keep nothing, re-run the subagent — never persist a drifted proposal.**
6. **Persist — all three tiers, in order:**
   - **Vault first.** Append findings to `cluster-<name>.md`, `[[patterns]]`,
     `[[feature-opportunities]]`; append the pass's added nodes/edges to `[[graph-log]]`
     (audit trail); update `[[frontier]]` (mark the item `done`, add the spawned items).
   - **Graph second.** Upsert the gated verdict's nodes/edges:
     ```bash
     npm run da:kg-promote -- --verdict=./.kg-analysis/verdicts/<target>.json --pass=<N> --commit
     ```
     (Deterministic edges were already written in step 3.)
   - **DataHub last** — optional; skip until the loop is proven.
7. **Update self-awareness.** Append a row to the `[[coverage-ledger]]` graph-metrics
   block: nodes/edges added this pass (by rel), frontier size, tokens spent,
   **cost-per-edge / cost-per-pattern**, and **reuse-rate** (fraction of the pass's
   cited evidence that references prior-pass findings/edges — the flywheel signal).
8. **Loop** — until budget or the frontier is dry (K consecutive passes add no new
   nodes/edges/frontier items). In autonomous mode, self-pace a wakeup between passes.

## Subagent output — the ENFORCED KgVerdict contract

Single source of truth: `lib/analysis/kg-verdict.ts` (mirrors the per-slice
`verdict.ts`).
- `kgVerdictJsonSchema` — draft-07, `additionalProperties:false` everywhere (an
  invented field is rejected); enums `KG_NODE_KINDS`, `KG_EDGE_RELS`,
  `KG_FRONTIER_KINDS`, `APP_MODULES`. Pass it verbatim as the subagent's schema.
- `validateKgVerdict()` / `parseAndValidateKgVerdict()` — the deterministic gate.
  With `knownIds` (derived from the live graph by the CLIs) it enforces the
  membership check on edge endpoints AND sweeps every prose-cited `psp:*` urn.

**The prompt** (either path — the schema, not this text, defines the shape):

> You are a civic-data analyst extending politicas's knowledge graph — a public-
> accountability platform over one Czech-parliament entity graph. [PRODUCT PRIMER +
> the two data realities from data-analysis.md.] Frontier target: `<target>`. Read
> your aggregates at `<file>` (deterministic ground truth — computed, AUTHORITATIVE;
> never author or adjust a count). Interpret the STRUCTURE the numbers show: name
> blocs/themes, read patterns. Return a KgVerdict: `nodes` (new `bloc:`/`theme:` …
> with a rationale), `edges` (belongs_to/about … — every endpoint a real entity id
> or a node you declare here), `patterns` (statement + evidence citing ids/counts),
> `featureOpportunities` (module ∈ {CivicScore,VoteTrack,FollowTheMoney,BudgetMirror,
> LawWatch}, cited to entities), and `frontier` (the next questions this finding makes
> worth exploring). Rules: judge ONLY from your aggregates; cite real entity ids; a
> bloc is *named* by you but *defined* by the co-voting computation; never invent an
> MP/number/dimension; a parliamentary club is NOT the elected party list.

## Cost efficiency (design §6)

- **Deterministic-owns-numbers** — the largest saving: co-voting over 406k ballots is
  SQL/matrix, never tokens.
- **Sonnet for the qualitative layer; Opus sparingly** — reserve Opus for a periodic
  completeness-critic pass ("what modality is unexplored, what claim is unverified,
  what should the frontier prioritise?").
- **Sample, never dump** — aggregates + a handful of exemplars; full descriptions where
  they exist are never truncated, but volume is bounded by aggregation.
- **The ledger prevents rework** — covered targets aren't re-run unless stale; the
  frontier steers tokens at unexplored high-value nodes.
- **Parallel fan-out where independent; barrier only for dedup/synthesis. Budget-aware
  — log what was dropped (no silent truncation).**

## Self-awareness & the flywheel test (design §7)

The hypothesis is that discovery **compounds**; measuring it *is* the test. Track per
pass in the graph-metrics block: nodes/edges added, frontier size (grows early, then
shrinks as coverage completes), tokens, **cost-per-edge / cost-per-pattern** (should
fall), **reuse-rate** (should rise). The controlled test (Phase 4): a **warm arm**
(reads the accumulating graph+vault) vs a **cold-control arm** (context withheld);
success = the warm arm's cost-per-discovery falls and reuse-rate rises while the cold
arm stays flat. If both are flat, write-back is ceremony — a real, publishable
negative result. **Contradiction detection:** when a pass re-touches a node, diff the
new finding against the stored one; log disagreements to `[[contradictions]]`.

## Guardrails

- **Deterministic owns numbers; subagents interpret.** Never persist an LLM-authored count.
- **Gate every verdict** (`da:validate-kg-verdict`); discard/re-run on drift — never
  persist a fabricated node/edge or a hallucinated id.
- **Write order: vault + `kg_*` first, DataHub last.** Tier 3 is a pure projection and
  may never hold an unbacked fact.
- **One frontier item per pass, atomic vault update.** Mark `done`, record spawned items.
- **Respect the PGlite writer** — read a COPY (`PGLITE_PATH=`), never a 2nd connection;
  a `--commit` needs exclusive access to `./.pglite`.
- **Blocked stays blocked** (F6 money graph) — track the gap honestly; never fake an edge.

## Resuming

Read `[[coverage-ledger]]` (graph-metrics) + `[[frontier]]` → the `open` items ARE the
remaining work; `[[graph-log]]` is the audit trail. `kg_node`/`kg_edge` are the source
of truth if the vault and DB disagree. Then run the loop. Everything needed to resume
is in the vault + `kg_*` tables — no context from a prior session is required.
