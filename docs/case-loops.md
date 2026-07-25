# Case loops — the shared kernel for the golden-trio analyst-builder loops

> **STATUS 2026-07-25: RUNNING — batch 006.** The manifestation pause is CLOSED.
> Four frontend executors landed list→detail routes at real volumes across all
> three cases plus the `/admin` progress/review hub — and the pause's decisive
> find was that **PGlite never opened inside the Next runtime**: every surface
> had been silently serving mock data while the loops looked perfectly healthy
> (fixed with `serverExternalPackages`; verified by a build resolving 207 real
> MP profiles). That is why cycle step 6 now exists. Batch 006 adds two external
> sources cleared during the pause: **dataor** (bulk OR export — operator
> accepted the non-commercial + GDPR-controller conditions) and **kiosek**
> (úřední desky — unanonymized IČOs + statute citations; feeds BOTH cases).

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
   **Validate discriminative power before trusting a signal** (batch-001 lesson):
   a signal that saturates on one value or fires on >50% of units is degenerate —
   fix it (log-scale, class-partition, densify its basis) before it ranks
   anything. A suspiciously high hit rate also deserves a **substring-collision
   check**: Czech keyword classifiers must use word-boundary regex, never
   `.includes()` (P42 — "vydání" contains "daní"; the bug drove batch-001's 89%
   routing over-fire and propagated silently through shared code). And **pre-filter structural false positives in code** before the
   army runs: both money and effort spent Opus dossiers proving leads false that
   a 5-line deterministic check (tie-class; `never_cast_ballot`) would have
   filtered.
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
   date; when a planned pull is resource-constrained, spend a small bounded
   probe on whether the SAME source exposes a cheaper access path — law's
   e-Sbírka SPARQL discovery replaced a shelved 1.24GB bulk plan with
   negligible point queries) → **wire** (proposed KG nodes/edges/props — gated, never direct) →
   **signal** (story-worthiness score + a one-line why — AND cross-cutting
   leads: data-quality gaps, sibling-unit collisions, quiet riders; batch 001's
   richest yield was non-headline classes). **Model tiering (CONFIRMED by the
   batch-002 experiment — three independent Opus audits):** the loop DRIVER
   and the army run **Sonnet**; **deterministic code before either** (money's
   population reconciliation ran at ~75× lower cost/unit with a BETTER
   honest-negative rate by coding the bulk and spending Sonnet only on the
   ambiguous slice). **Opus runs at maximum reasoning effort** (`effort:
   'xhigh'` where exposed; otherwise instruct maximum depth) and is reserved
   for three verified-value uses: (a) **batch QA/reflection** — in every
   batch-002 loop the Opus audit caught real defects a Sonnet-only pass had
   accepted (undated-money conflation, an IČO mismatch, a citation-kind
   mislabel, an over-strong headline); (b) **targeted verification of
   money-touching claims** — the ONE weakness class Sonnet showed (both
   effort quality gaps were money claims); (c) **the conditional top-signal
   trigger, kept ARMED** — batch 002's all-low populations provided zero
   evidence on the high-signal case Opus exists for; fire it on genuine
   severity, never retire it. **Pre-extract each unit's full
   context into a batch inputs file** (effort's `dossier-inputs.json` pattern)
   so army agents never open the single-connection DB copy; grouped Sonnet
   agents hold quality at 3–5 units each. **Concurrency budget:** the platform
   caps ~20 parallel subagents TOTAL — in fleet mode budget ≤6–8 concurrent per
   case or stage waves.
4. **Gate + persist.** Every wire proposal passes schema + entity-id membership
   validation (the `kg-verdict.ts` pattern; case gates listed in each skill).
   Vault batch note written FIRST, graph second (exclusive `.pglite` window),
   ledger update last — atomic per batch.
5. **Reflect (every batch).** Cross-unit patterns → `[[patterns]]`;
   disagreements with prior batches → `[[contradictions]]`; cited entries →
   `[[feature-opportunities]]`; emergent questions → the case section of
   `[[frontier]]`; steering (batch size, ranking tweaks) + a metrics row into
   the case ledger: units done/total, **signal yield** (new signals ÷ units —
   the convergence measure), cost/unit, reuse-rate. **Absence of signal is a
   finding, not a failure** — 0 conflicts in a top-flagged head, a clean-hands
   population, a quiet workhorse are the non-partisan-symmetry outputs that
   make the accusatory ones credible; record them with equal weight.
6. **Manifestation check (new, from the pause retro): data that doesn't render
   doesn't exist.** Every batch's reflection must answer: *does what this batch
   persisted actually RENDER, and does the surface scale to the data volume it
   now carries?* A batch that grows the graph without growing its surface incurs
   manifestation debt — track it in the ledger like any other debt. The fleet
   includes a **Frontend executor** role for exactly this: an agent whose whole
   batch is wiring persisted data into product surfaces (information
   architecture, list→detail routes, filters/search/pagination at real volumes,
   Konstrukt discipline) rather than producing new analysis. Dispatch one
   whenever manifestation debt spans more than one surface; the `/admin` hub
   tracks per-case progress and the review pipeline.
7. **Build-review (adaptive cadence).** Review interval R in batches: **start
   R=1**; when a review ships nothing, R doubles; when something ships, R
   resets to 1. A build phase = implement the top build-ready opportunity end
   to end: server-loader pattern (`app/<route>/page.tsx` awaits a server-only
   `features/<case>/get*Data.ts`, typed props into the `"use client"`
   component), `SourceNote` on every number, `npm run check` green, docs
   synced, one atomic Conventional commit. **This is how the analyst becomes
   the app builder.**
8. **Converge.** K=3 consecutive batches under the signal-yield threshold →
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
  only a human verifies — since batch 003, exclusively through `ReviewRepository`
  + the token-gated `/penize/kontrola` server action, with an append-only
  `review_audit` row before every flip.
- **A human write layer over a re-derivable ingest needs an explicit durability
  contract** (P44/D1): the ingest must merge-preserve human-written fields (or
  the audit trail must replay after ingest) — `props = excluded.props`
  wholesale-replace silently erases a reviewer's work. When reviewing ANY
  write-path build, the reflection must ask "what ELSE in this repo writes to
  this same field/table", not just "does the write path work".
- **Deferred-three-batches is a decision point**: an item that rolls through
  three build-reviews without running gets committed to the next batch or
  retired — never deferred a fourth time.

## Fleet mode (parallel runs)

Solo mode (one loop per session) may write everything itself. When several case
loops run in parallel in one repo — **fleet mode** — three resources are
single-writer and are handed off to the orchestrator instead:

| Resource | Fleet rule |
|---|---|
| live `./.pglite` | NEVER write. Analyze on a case-suffixed copy (`cp -r .pglite .pglite-copy-<case>`; `PGLITE_PATH=`). Emit materialization payloads + scripts; the orchestrator serializes live writes via `scripts/case-loops/persist-batch.ts` (props-merge writer: nested annotation provenance, refuses to insert missing targets). |
| shared vault files (`frontier`, `feature-opportunities`, `graph-log`, `patterns`, `contradictions`) + shared code (`lib/analysis/kg-verdict.ts` enums, `package.json`, `messages/*.json`) | do not edit; put proposed additions in the case handoff. |
| git | do not commit — **no exceptions, not even a boundary-clean commit of your own build** (a law driver did exactly that in batch 004; the commit was kept because it happened to be surgical, but the rule exists so the orchestrator can review BEFORE history is written, and staging races with siblings are only safe when one process touches the index). Leave changes in the tree; the orchestrator reviews and commits per case. |

**A driver never ends its run waiting.** If a sub-agent is still working, the
driver stays alive until the result lands and the handoff is WRITTEN — ending a
turn with "I'll report when it finishes" strands the batch (it happened twice
in batch 003; the orchestrator had to resume the driver both times). The
handoff document is the only valid last act of a fleet run. Working scraps go
in the case folder or a gitignored dir, never the repo root.

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
- **Never assert ABSENCE of a company tie without the ARES VR endpoint**
  (`/ekonomicke-subjekty-vr/{ico}`) — the plain `/ekonomicke-subjekty/` endpoint
  never contains officers, so a negative from it is an unverified negative
  (batch 003 caught 5 false clearances this way, C11). Over-claiming AND
  under-claiming are both live failure modes on money-touching claims.
- **A research agent's confidence label is a claim to verify, not a fact** —
  independently spot-check the primary source before accepting "high"
  (batch 003: PRaK "high" → medium once ARES 404s were checked).
- **Presence claims verify by grep, not by a second model read** — for
  "does text X appear in document Y", deterministic search of the fetched
  text is cheaper and stronger (P49). Corollary: a prose-vs-props numeric
  cross-check belongs in the gate, in code (Q-effort-11).
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
