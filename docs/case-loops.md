# Case loops — the shared kernel for the golden-trio analyst-builder loops

The third generation of the loop family, and the design doc the three case skills
(`.claude/skills/{money-loop,effort-loop,law-loop}.md`) extend. Read this before
running any of them.

| Generation | Skill | Question | Unit |
|---|---|---|---|
| 1 | `data-analysis` | is the data any good? | slice (source×term×entity) |
| 2 | `knowledge-graph` | what structure does it hold? | frontier item (one question) |
| **3** | **case loops** | **what VALUE does it hold — and ship it** | **population unit** (tie, contract, MP, bill) |

Everything proven in generations 1–2 carries over unchanged: the vault as memory,
deterministic-owns-numbers / LLM-interprets, schema-gated verdicts, atomic pass
finalization, self-awareness metrics. Generation 3 adds three things: **unit
ledgers** over enumerable populations, a **triage-ranked batch engine**, and
**build phases** — the loop doesn't just propose features, it implements them.

**The mentality.** Large open datasets + a strong LLM with web search + a hard
deterministic gate = the capability the state portal can never assemble: we can
*identify relations no one else can* and represent them with product-grade UX.
The value is DISCOVERED as analysis progresses — the app's feature principles
exist, but the loops decide what is worth building from what the data shows.

## The batch cycle

```
resume → triage → dispatch army → gate + persist → reflect → build-review → loop
```

1. **Resume.** Read the case ledger (`docs/data-analysis/case-<x>/ledger.md` +
   machine state `ledger.json`: unit id → {stage, batch, signal, flags}). The
   ledger IS the resumable state — no prior-session context needed.
2. **Triage (deterministic, no LLM).** Recompute per-unit **signal scores** and
   rank the queue. The army processes systematically but in VALUE ORDER — stop
   after any batch and the best-covered head is always the highest-value units.
   Engine choice follows the measured guide (`docs/db-architecture-guide.md`):
   **R4** — populations under ~100k rows (ties, contracts, bills, MPs) triage
   fine in PGlite SQL on a copy; **R3** — reach for DuckDB only when the pass
   joins the 406k-ballot table or similar analytical self-joins; **R6** —
   pgvector (in-DB) for subject-similarity signals (embed once, query many);
   **R9–R11** — when full texts land (steno, e-Sbírka), index with
   tsvector+GIN from the start, never LIKE-scan a large corpus.
3. **Dispatch the army.** N units → parallel subagents. Each unit passes four
   stages: **clean** (anomaly flags — code-first; LLM only where judgment is
   needed) → **enrich** (web + API research; EVERY claim carries URL + access
   date) → **wire** (proposed KG nodes/edges/props — gated, never direct) →
   **signal** (story-worthiness score + a one-line why). Model tiering: Sonnet
   is the default worker; Opus for top-signal units, synthesis, and build
   phases; deterministic code for anything countable.
4. **Gate + persist.** Every wire proposal passes schema + entity-id membership
   validation (the `kg-verdict.ts` pattern; case gates listed in each skill).
   Vault batch note written FIRST, graph second (exclusive `.pglite` window),
   ledger update last — atomic per batch.
5. **Reflect (every batch).** Cross-unit patterns → `[[patterns]]`;
   disagreements with prior batches → `[[contradictions]]`; cited entries →
   `[[feature-opportunities]]`; emergent questions → the case section of
   `[[frontier]]`; steering (batch size, ranking tweaks) + a metrics row into
   the case ledger: units done/total, **signal yield** (new signals ÷ units —
   the convergence measure), cost/unit, reuse-rate.
6. **Build-review (adaptive cadence).** Review interval R in batches: **start
   R=1**; when a review ships nothing, R doubles; when something ships, R
   resets to 1. A build phase = implement the top build-ready opportunity end
   to end: server-loader pattern (`app/<route>/page.tsx` awaits a server-only
   `features/<case>/get*Data.ts`, typed props into the `"use client"`
   component), `SourceNote` on every number, `npm run check` green, docs
   synced, one atomic Conventional commit. **This is how the analyst becomes
   the app builder.**
7. **Converge.** K=3 consecutive batches under the signal-yield threshold →
   declare coverage in the ledger; the loop drops to staleness-driven mode
   (re-ingest / Pumper watch events re-open it).

## Authority (decided 2026-07-24)

- **Ship authority:** build phases implement, verify, and **commit to master
  autonomously**; **pushes happen only at user-declared milestones.**
- **Ingest authority:** loops build new ingest adapters for open sources
  **fully autonomously**, including registering for **free** API keys/accounts
  where needed. **Payment always waits for the user.**
- **The human gate is never delegated.** No loop, at any autonomy level, flips
  a `review_state`. Corroboration annotates and raises reviewer confidence;
  only a human verifies.

## Fleet mode (parallel runs)

Solo mode (one loop per session) may write everything itself. When several case
loops run in parallel in one repo — **fleet mode** — three resources are
single-writer and are handed off to the orchestrator instead:

| Resource | Fleet rule |
|---|---|
| live `./.pglite` | NEVER write. Analyze on a case-suffixed copy (`cp -r .pglite .pglite-copy-<case>`; `PGLITE_PATH=`). Emit materialization payloads + scripts; the orchestrator serializes live writes. |
| shared vault files (`frontier`, `feature-opportunities`, `graph-log`, `patterns`, `contradictions`) + shared code (`lib/analysis/kg-verdict.ts` enums, `package.json`, `messages/*.json`) | do not edit; put proposed additions in the case handoff. |
| git | do not commit. Leave changes in the tree inside your boundary; the orchestrator reviews and commits per case. |

Everything else — the case vault folder (`docs/data-analysis/case-<x>/`), the
case's feature/app boundary, case-owned `lib/` modules, new scripts under
`scripts/case-loops/<case>/` — is the agent's to write. Each fleet run ends
with **`docs/data-analysis/case-<x>/handoff.md`**: graph payloads (validated,
with the gate command to re-verify), shared-file additions (exact text to
append), proposed enum/schema changes, commit plan (files + suggested message),
and the lessons-learned block the orchestrator aggregates cross-case.

## Provenance — the track field

Investigative passes continue the shared numeric sequence (trio used 10–12) but
from now every case-loop node/edge provenance carries a **`track`** field:
`{track: "money"|"effort"|"law", pass: <n>, method, ref, computedAt}`. Pass
numbers are assigned at finalize time by whoever holds the write lock (the
orchestrator in fleet mode), in write order. This permanently resolves the
analytical-loop vs investigative-track numbering ambiguity documented in
[[graph-schema]].

## Web-research doctrine (non-negotiable)

- **A web finding is a LEAD, never a fact.** It lands as cited enrichment
  metadata (`{claim, url, accessedAt, sourceKind}`) and enters the graph only
  through a deterministic or human gate.
- **Primary registries outrank media**: psp.cz, e-Sbírka, ARES/VR (justice.cz),
  Registr smluv, Hlídač státu > news. Media coverage is *context* in narrative
  notes, never a graph fact.
- **Public-role facts only.** The platform holds public officials accountable
  for public roles; private life is out of scope, always.
- **Non-partisan symmetry.** Positive findings get equal surface: the quiet
  workhorse, the clean-hands MP, the committee that scrutinizes well. "134 MPs
  with zero detected ties" is a finding.
- Czech sources are read natively; every rendered number still cites its
  source (`SourceNote` — the brand rule).

## Vault layout

```
docs/data-analysis/
  case-money/   ledger.md · ledger.json · batch-NNN.md · handoff.md (fleet)
  case-effort/  (same)
  case-law/     (same)
  (shared, finalize-step only: frontier.md · feature-opportunities.md ·
   graph-log.md · patterns.md · contradictions.md)
```

`ledger.md` carries the human-readable batch log + metrics block (the
generation-3 analogue of the coverage-ledger's graph-metrics). `ledger.json`
is the machine state — derived, recomputable, but git-tracked so any session
resumes exactly.

## Guardrails (inherited + new)

- Deterministic owns every count; the LLM interprets, ranks, and narrates.
- Gate every wire proposal; discard and re-run on drift — never persist a
  hallucinated id or an invented number.
- One batch per cycle, atomic finalize (vault → graph → ledger).
- Respect the PGlite single writer; reads on copies, writes exclusive.
- Web claims cited or discarded; media never becomes a graph edge.
- The human gate is inviolable (see Authority).
- No silent truncation: a skipped unit, a dropped row, a sampled subset is
  logged in the batch note.
- Build phases meet the same bar as any session: `npm run check` green, docs
  synced same-session, tokens/colors discipline, Czech-first copy.
