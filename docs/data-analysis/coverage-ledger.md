# Coverage ledger — civic corpus analysis

> **Next major direction:** a self-expanding **knowledge-graph loop** is designed in
> [`../knowledge-graph-loop.md`](../knowledge-graph-loop.md) (Case 2 — agents build a derived
> graph that accretes across passes; memory lives here in the vault + the app DB, DataHub is an
> optional mirror). The per-slice loop below is its deterministic foundation.
>
> **Phases 1–3 are BUILT (2026-07-23).**
> - **Phase 1** (schema + deterministic edges): `kg_node`/`kg_edge` in the store (`lib/db/`,
>   snapshot `migrations/0001`); `lib/analysis/kg.ts` (unit-tested); `npm run da:kg-compute [--commit]`.
>   Committed seed graph: **248 nodes** (207 person · 8 party · 33 organ), **21 304 edges**
>   (co_votes_with 20 496 · influential_in 605 · rebels_against 203).
> - **Phase 2** (vault): [[frontier]] (F1–F6 seeded), [[graph-schema]], [[graph-log]],
>   [[feature-opportunities]], [[contradictions]], + the graph-metrics block below.
> - **Phase 3** (the loop): skill `.claude/skills/knowledge-graph.md`; the gate
>   `lib/analysis/kg-verdict.ts` (schema + membership check, unit-tested) via
>   `npm run da:validate-kg-verdict`; verdict-derived nodes/edges persist through
>   `npm run da:kg-promote`.
>
> **Six passes run** (graph: 263 nodes / 21 359 edges + contestedness, rebellion & control props):
> **P2 F1 blocs** ([[cluster-blocs]]); **P3 F2 themes** ([[cluster-themes]]); **P4 F11
> bloc × theme** ([[cluster-bloc-theme]]); **P5 F16 theme-grain rebellion**
> ([[cluster-theme-rebellion]]); **P6 F17 agenda control over time** ([[cluster-agenda-control]]).
> P4–P6 are deterministic, reuse-rate ~1.0 at ~0 tokens — findings: deep polarization, ODS
> the fiscal outlier, contestedness-reweighted independence, and control that is
> consensus→majoritarian (bloc A the majority governs). **Two self-corrections** held
> ([[contradictions]] C1, C2). Frontier 5 → 8 → 11 → 12 → 12 → 12 open (F1/F2/F8/F11/F14/F16/F17
> done; spawned F7–F21) — converging. See [[graph-log]] + graph-metrics below.
> **Phase 4 DONE** ([[phase4-controlled-test]], `da:kg-metrics`): a blind judge confirmed the
> flywheel — WARM beats COLD on depth 4.6 vs 2.0 at equal grounding and lower cost. **Pass 7
> convergence** closed F19/F20/F21 ([[cluster-convergence]]) — the frontier **turned down** 12 → 9.
> **Phase 5 DONE** ([[phase5-datahub-projection]], `da:kg-datahub-sync`): the optional, disposable
> DataHub projection of `kg_*` as datasets + lineage (a bloc traces back to the raw ballots).
> **Pass 8** ([[cluster-committees-and-money]]): **F12 done** — new `owns` relation, 27
> committee→theme edges (vote→theme→committee chain closed). **F6 money graph WIRED** —
> `lib/analysis/kg-money.ts` (IČO join + human gate, 6 tests) is built and tested. **As of
> 2026-07-23 it emitted nothing** (blocked on Registr smluv / ARES / the sensitive MP↔company
> linkage). **UNBLOCKED 2026-07-24** — see the trio reconciliation note below. F15 (formal
> per-bill committee routing) remains blocked on the psp.cz `tisky→výbor` assignment, but the
> `tisky` dataset itself is now ingested (bill/law nodes exist). **Case 2 phases 1–5 complete.**
> **Passes 9–13** closed the remaining analytical items: **F23** (foreign-affairs theme; education
> declined), **F13** (full theme coverage), **F18** (contestedness re-score; oversight → mixed, C3),
> **F3/F7** ([[cluster-contested]] — blocs sharpen to **0.998 opposition on close votes**; CivicScore
> Independence = f(`contested_vote_rebellion`)), **F4/F9** (both modest/negative, honestly recorded).
>
> **⇒ THE ANALYTICAL LOOP CONVERGED (13 passes, 2026-07-23).** Frontier grew 5 → 12 then shrank to
> **2 open**, both **staleness-only** (F5/F10 — nothing to recompute until the corpus re-ingests). No
> open item could add new knowledge from *that* corpus — everything genuinely new needed **external
> data**. Design doc §0 carries the full build sync. §10 = phase list.
>
> **⇒ THE EXTERNAL DATA LANDED (2026-07-24) — the "golden trio."** Three investigative cases
> ingested the previously-blocked feeds and materialized them into the same `kg_node`/`kg_edge`
> store (an independent pass-10/11 sequence, not a continuation of the loop above — see
> [[graph-schema]] track note):
> - **① FollowTheMoney (F6, pass 10, deterministic):** 196 `company` + 2 287 `contract` nodes;
>   260 `linked_to` (person→company, **all `pending_review`** — the human gate holds) + 2 290
>   `supplies` edges. ~18.7 bn CZK reachable public money across 73 MPs. → `/penize`.
> - **② Effort / contribution (pass 11, deterministic):** all 207 `person` nodes carry a
>   `contribution_score` + 6 exposed components + `absentee_manager_lead`
>   (`lib/analysis/contribution.ts`). → `/zebricek` + `/poslanec`.
> - **③ Law forensics (F15-adjacent, pass 11, deterministic):** 141 `bill` + 101 `law` nodes;
>   150 `amends` (bill→law) + 528 `sponsors` (person→bill) edges; 1 bill (tisk 58) carries a
>   gated `forensic_*` verdict (`pending_review`). → `/zakony`.
>
> Graph: **263 nodes / 21 359 edges** (loop) → **2 989 / 24 749** (trio). The four feature surfaces
> `/penize`, `/zebricek`, `/poslanec`, `/zakony` were wired off the mock onto these real nodes on
> 2026-07-24 (loader pattern per `/hlasovani`; mock retained only as graceful fallback).

THE DRIVER for `/data-analysis`. One row per slice (`source × term × entity`).
The loop picks the stalest `pending`/`stale` row; a slice goes `stale` when its
source re-ingests after `lastAnalyzed`. Numbers come from the deterministic
scorer (`lib/analysis/quality.ts`) via `scripts/data-analysis/slice-stats.ts` —
never from an LLM. `slice_quality.analyzedAt` is the source of truth if this file
and the DB disagree.

Snapshot: 2026-07-23 (founding onboarding). Term PSP10 = the 10th electoral term
(chamber opened 2025-10-04), the current parliament.

| Slice | Rows | Composite | Status | lastAnalyzed | Notes |
|---|---|---|---|---|---|
| psp-hlasovani×PSP10×vote_event | 2030 | 4.2 | analyzed | 2026-07-23 | tallies reconcile 100%; short titles empty (richness cap); 16 voided votes → `verdicts/psp-hlasovani__PSP10__vote_event.json` |
| psp-poslanci×PSP10×mandate | 207 | 3.8 | analyzed | 2026-07-23 | current-term contacts empty corpus-wide (0/207); club≠party_list verified → `verdicts/psp-poslanci__PSP10__mandate.json` |
| psp-hlasovani×PSP10×vote_ballot | 406000 | 4.5 | pending | — | 22% merged K bucket (abstain/not-voting) — richness cap, cannot split |
| psp-hlasovani×PSP10×absence | 6425 | 5.0 | pending | — | all timed windows; future-dated excuses are real (filed ahead) |
| psp-poslanci×all×person | 7045 | 4.5 | pending | — | historical registry; ~419 unlinked (expected); 1900 birth sentinel handled |
| psp-poslanci×all×organ | 1790 | 4.6 | pending | — | 2% validity dip — check parent/date edges |
| psp-poslanci×PSP10×membership | 1334 | 4.5 | pending | — | far-future placeholder date (year 2925) inflates newest-row freshness |
| pumper-psp-opendata×all×source_release | 17 | 3.8 | pending | — | validity 0 by design — Pumper charset defect (U+FFFD), a SPEC item |

## Analyzed this pass

Two slices, each authored as an `AnalysisVerdict` and passed through the
deterministic gate (`npm run da:validate-verdict -- --rows=<slice>.json`, which
also rejects a cited `entityId` that is not a real row). The deterministic
`slice_quality` rows (all 8) were promoted via
`scripts/data-analysis/promote-verdicts.ts --commit`. Verdict scores were
cross-checked against the deterministic composite (no deviation > 0.6).

---

# Graph-metrics block — the self-awareness surface (KG loop §7)

Per-pass metrics for the [[knowledge-graph-loop]]. The flywheel hypothesis is that
discovery **compounds**; these columns are how we'd see it. **reuse-rate** = fraction
of a pass's cited evidence that references *prior-pass* findings/edges (should rise);
**cost/edge** and **cost/pattern** should *fall* across warm-arm passes while a
cold-control arm stays flat (§7). Numbers here come from `kg_node`/`kg_edge` counts +
per-pass token accounting — never from an LLM. `kg_edge`/`kg_node` are the source of
truth if this table and the DB disagree.

| pass | date | method | nodes (Δ) | edges (Δ) | by rel | frontier open | reuse-rate | cost |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-07-23 | deterministic | 248 (+248) | 21 304 (+21 304) | co_votes 20 496 · influential 605 · rebels 203 | 5 (+1 blocked) | n/a (seed) | ~0 (no tokens) |
| 2 | 2026-07-23 | verdict (Sonnet) | 250 (+2) | 21 312 (+8) | + belongs_to 8 | 8 (F1 done; +F7–F10) | ~1.0 | ~33.6k tok (F1 blocs) |
| 3 | 2026-07-23 | verdict (Sonnet) | 263 (+13) | 21 359 (+47) | + about 47 | 11 (F2 done; +F11–F14, F15 blocked) | ~0.1 | ~56.5k tok (F2 themes) |
| 4 | 2026-07-23 | deterministic | 263 (+0, **13 enriched**) | 21 359 (+0) | props: contestedness on 13 themes | 12 (F11,F14 done; +F16–F18) | **~1.0** | **~0 tok** |
| 5 | 2026-07-23 | deterministic | 263 (+0, **203 enriched**) | 21 359 (+0) | props: contested-rebellion on 203 persons | 12 (F8,F16 done; +F19–F20) | **~1.0** | **~0 tok** |
| 6 | 2026-07-23 | deterministic | 263 (+0, **2 enriched**) | 21 359 (+0) | props: control-timeline on 2 blocs | 12 (F17 done; +F21) | **~1.0** | **~0 tok** |
| 7 | 2026-07-23 | deterministic | 263 (+0, **204 enriched**) | 21 359 (+0) | props: ODS fiscal-divergence + cross-bloc-agreement | **9** (F19/F20/F21 done; +0 spawned) | **~1.0** | **~0 tok** |
| 8 | 2026-07-23 | verdict (Sonnet) | 263 (+0) | 21 386 (+27) | + **owns** 27 (new rel) | 9 (F12 done; +F23; F6/F15/F22 data-blocked) | ~0.6 | ~42.5k tok (F12) |
| 9 | 2026-07-23 | verdict (self-authored) | 264 (+1) | 21 397 (+11) | + about 8, owns 3 | 8 (F23 done; education declined) | ~0.5 | ~0 tok |
| 10 | 2026-07-23 | verdict (Sonnet) | 264 (+0) | 21 521 (+124) | + about 124 (full coverage) | 7 (F13 done) | ~0.7 | ~41.4k tok |
| 11 | 2026-07-23 | deterministic | 264 (+0, **14 re-scored**) | 21 521 (+0) | props: contestedness re-score | **6** (F18 done) | ~1.0 | ~0 tok |
| 12 | 2026-07-23 | deterministic | 264 (+0, **205 enriched**) | 21 521 (+0) | props: per-vote contestedness (F3/F7) | **4** (F3/F7 done) | ~1.0 | ~0 tok |
| 13 | 2026-07-23 | deterministic | 264 (+0) | 21 521 (+0) | read-only (F4/F9 → vault) | **2** (F4/F9 done → **DRY**) | ~1.0 | ~0 tok |

**Flywheel signals so far:** three distinct signatures are now visible.
**(1) Compounding at near-zero cost.** Passes 4–6 are all deterministic, reuse-rate ~1.0,
**~0 tokens** — each reuses prior passes' written-back output (pass 5 fused *three* layers)
to produce headline findings (polarization; ODS the fiscal outlier; consensus→majoritarian).
The write-back thesis, three times.
**(2) Expansion → convergence — now confirmed.** Open count went 5 → 8 → 11 → 12 → 12 → 12
→ **9**: it grew early, plateaued, then **turned down** at pass 7, which closed three items
and spawned *nothing* (leaf closures). Exactly the "grows early, then converges" signature
the design predicts — the loop has stopped expanding; remaining open items are data-blocked,
staleness-driven, or narrow.
**(3) Self-correction — the graph catches its own errors.** *Two* contradictions in six
passes ([[contradictions]] C1, C2), both deterministic passes correcting an earlier
*interpretive* read (procedure ≠ churn; support ≠ control). This is write-back's other
payoff (§7): a durable graph lets later work refute earlier claims — impossible read-only.

**(4) Phase 4 controlled test — the flywheel confirmed, quantified** ([[phase4-controlled-test]]).
Same synthesis task, two arms: **WARM** (6 passes of accumulated graph+vault) vs **COLD**
(deterministic substrate only). A **blind** judge (not told which was which) scored WARM
higher on depth (4.6 vs 2.0) and derivability-requires-prior-analysis (4.6 vs 1.2) at **equal
grounding** — and WARM cost **less** (36k vs 41k tokens). The judge independently reconstructed
the manipulation: COLD's findings are re-derivable from raw stats; WARM's *require* the derived
layers. **Nuance:** the *first* interpretive layer (blocs) is cheaply re-derivable — write-back's
payoff is **accumulated depth** (contestedness, control, theme-rebellion), not first interpretation.
Not a null result: `da:kg-metrics` renders the per-pass curves.
