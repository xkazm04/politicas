# Money loop — unit ledger (Case ① FollowTheMoney)

Resumable state for the FollowTheMoney analyst-builder loop. Machine state:
[`ledger.json`](./ledger.json) (260 tie units → {stage, batch, signal, corroboration,
flags}). Human batch log + metrics below. Skill: `.claude/skills/money-loop.md`; kernel:
`docs/case-loops.md`. Vault home: `docs/data-analysis/case-money/`.

Unit = one `linked_to` tie (person→company), the accountability atom. Population: **260
ties** (all `pending_review`), 196 companies, 2 287 contracts, **19.76 bn CZK** reachable.

## Batch log

### Batch 001 — calibration (2026-07-24)

- **Triage:** all 260 ties scored deterministically (`triage.ts`, PGlite copy). Added the
  **tie-class** dimension (owner-operator 37 · manager 23 · steward 200) so the queue ranks
  by *genuine* FollowTheMoney value, not raw money volume (which is dominated by public-body
  stewardship seats). Skipped pgvector this batch (calibration) — **next-batch work**.
- **Army:** top **15 ties**, four stages each (clean → enrich → wire → signal). 15 parallel
  subagents (Opus ×3 for the head, Sonnet ×12). Enrichment hit ARES subject + ARES VR,
  Registr smluv (via Hlídač web), psp.cz, with every claim cited. **No Hlídač API token in
  this env** (`.env.example` documents only Sentry) — enrichment degraded to token-free ARES
  + web registries; it still resolved all 15.
- **Gate:** `validate-payloads.ts` → **15/15** corroboration proposals validate against the
  graph copy. 0 drops, 0 fabricated ids.
- **Persist (fleet):** batch note `batch-001.md`; graph payloads
  `payloads/batch-001-corroboration.json` (NOT written to live DB — orchestrator serializes);
  ledger.json updated (15 units → stage `signal`, batch 1).

## Metrics block

| metric | batch 001 |
|---|---|
| units done / total | **15 / 260** (5.8%) |
| owner-operator ties in head | 37 identified; top 15 processed |
| **signal yield** (signals ÷ units) | 15/15 produced a scored dossier; **4 live conflicts (signal ≥4)**, ratio 0.27 |
| registry-confirmed | 11/15 · conflicting 3/15 · (all IČOs exist) |
| **stale/misattributed period caught** | **11/15** (the dominant finding) |
| gate pass rate | 15/15 (100%) |
| est. cost / unit | ~30 k subagent tokens/tie, 3–7 web calls, ~90 s wall (parallel) |
| reuse-rate | triage + signal helpers shared between `triage.ts` and the live console (`reviewTypes.ts`) |

**Convergence read:** batch is calibration, not convergence. Signal yield is high because the
head of the queue is the richest 15. The *structural* finding (stale periods) is itself the
highest-value output — it means the whole 260-tie population needs an ARES-VR period
reconciliation pass before any tie is presented as "active".

## Steering (next batch)

1. **Ties 16–30** by signal (owner-operators #16+; then the manager class). Batch size 15 held
   up well under the 20-concurrent subagent cap — keep 15, but launch in one wave (2 of this
   batch's 15 hit the cap and were relaunched).
2. **Temporal reconciliation as a first-class signal.** Re-run triage with an ARES-VR
   `role_valid_to` fetch so "ongoing-but-actually-ended" and "money-postdates-role" become
   deterministic flags, not per-tie discoveries. This is the single biggest calibration lever.
3. **pgvector subject-similarity** (R6) for contract-splitting candidates — deferred this batch.
4. **Sponzoring pass** — resolve the three surfaced company→party donation leads against the
   Hlídač donor registry (needs the API token → user gate) and propose donation edges.
5. **Indirect-ownership modelling** — the Babiš/CS CABOT scope gap shows the graph needs an
   `owns`/`controls` company→company layer (Agrofert→DEZA→CS CABOT) to catch indirect ties.

## Build-review

- **R=1 → shipped:** the **verification console** (`/penize/kontrola`) — the seed backlog's
  #1 build-ready increment. See `handoff.md`. R resets to 1 (something shipped).
