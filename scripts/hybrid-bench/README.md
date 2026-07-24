# hybrid-bench — direction #9: semantic-operator cascade

The first mapped point of the [hybrid benchmark plan](../../docs/hybrid-benchmark-plan.md).
Benchmarks the **hybrid framework itself**: a LOTUS-style `sem_filter` with a
**model cascade** over PSP vote titles, measuring quality (agreement with a gold
reference) vs efficiency (tokens, opus calls).

## What it does

`sem_filter` labels each vote title against a natural-language predicate
([`predicates.ts`](./predicates.ts)) — batched (one LLM call per batch, never per
row). Four arms are compared:

| Arm | Who labels | Cost |
| --- | --- | --- |
| **deterministic** | crude keyword regex (Execution-Plane floor) | free |
| **proxy** | a cheap model (haiku) on every batch | low |
| **cascade** | haiku on all; the low-confidence tail (`confidence < τ`) escalates to opus | low + a little |
| **gold** | a strong model (opus/high) on every batch — the **reference** | high |

Quality = each arm's agreement (accuracy / precision / recall / F1) with the gold
labeling. Efficiency = output tokens, LLM calls, and **opus calls** (the real
lever — avoiding the expensive model). The design-space questions: *does the
cascade match gold at a fraction of the opus calls, and how far is the free
keyword floor from the LLM?*

## Run

```bash
npm run hybrid:semop -- --pred=personnel-appointments --limit=377 --batch=64 --tau=0.75
#   --gold-model=opus --gold-effort=high --proxy-model=haiku --proxy-effort=
#   predicates: personnel-appointments · fiscal-budget · housing-construction
```

Reads titles from `.data-analysis/rows/psp-hlasovani__PSP10__vote_event.json`
(voided excluded). Writes `.hybrid-bench/semop-<pred>.{md,json}` (scorecard +
per-item labels). Engine = Claude Code CLI (`engine.ts`), subscription-unmetered,
model/effort per call so the cascade can switch mid-run.

## Files

`engine.ts` self-contained `claude -p` spawn (model+effort per call) · `semop.ts`
the batched `sem_filter` operator · `predicates.ts` predicates + keyword baselines
· `run.ts` orchestrator + scoring + scorecard.

## Notes / next

- Output-token count is a weak efficiency metric here — a verbose cheap model can
  emit *more* tokens than a terse opus/high. **opus-calls and wall-clock** are the
  real levers; the scorecard reports opus-calls.
- Only the 377-row title export is used; the full 2,030 vote_events (and 406k
  ballots for `sem_agg`) come from PGlite via the typed Store when this graduates.
- Next operators to add: `sem_agg` (LLM-summarize groups), `sem_join` (link votes
  to laws/entities) — the same cascade + gold-reference method.
