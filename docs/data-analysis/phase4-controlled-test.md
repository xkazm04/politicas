# Phase 4 — the controlled test: does write-back buy the flywheel?

The design's core hypothesis (`knowledge-graph-loop.md` §7): *when analysis can write
derived knowledge back to a store it later reads, discovery compounds.* The null: write-back
is ceremony and a blind, read-only analysis does just as well. This is the test, run
2026-07-23. Metrics tool: `npm run da:kg-metrics` (`scripts/data-analysis/kg-metrics.ts`).

## Design

Same synthesis task to two Sonnet arms: *"produce the 5 most important, evidence-grounded
findings about the chamber's voting behaviour, each with a product feature; ground every
claim in real numbers."* The **only** difference is context:

- **COLD** (control) — the deterministic substrate only: club×club co-voting matrix, per-club
  cohesion + rebellion, top vote subjects + counts, ballot distribution. Exactly what a
  from-scratch, read-only analysis computes. No named blocs, themes, contestedness, or control.
- **WARM** — the same substrate **plus the 6 prior passes' accumulated graph + vault**: named
  blocs, the 13-theme taxonomy with contestedness, the control timeline, theme-grain
  rebellion, and patterns P1–P16.

Both arms gated by the same output shape. A **third Sonnet, blind** to which arm was which,
scored all 10 findings on grounding, depth, and *derivability* (1 = re-derivable from raw
stats in one sitting, 5 = requires prior multi-layer analysis).

## Result — the flywheel holds, decisively

| axis (blind judge, mean of 5) | COLD | WARM |
|---|---|---|
| grounding | 4.6 | 4.6 |
| **depth** (surface stat → structural insight) | 2.0 | **4.6** |
| **derivability** (needs prior analysis) | 1.2 | **4.6** |
| **token cost** | 41 121 | **35 999** |

**Blind verdict: WARM stronger.** The judge's unprompted `note_on_derivability` reconstructed
the manipulation without being told it existed: *"Analysis A's findings are almost entirely
producible from a single pass over raw data … None of B's findings could be produced by
simply grouping and counting raw fields — each requires theme classification + per-vote
outcome/time modelling."*

- **WARM reached findings COLD structurally cannot**: the consensus→majoritarian regime change
  (needs dates × bloc × outcome), *support ≠ control* (needs the win-rate layer), ODS as the
  hidden fiscal faction (needs bloc × theme × rebellion), contestedness-reweighted independence
  (needs theme contestedness). All scored derivability 4–5.
- **WARM cost less** (36k vs 41k tokens) for **deeper** output — it inherited structure instead
  of spending tokens re-deriving it, then synthesised on top. Cost-per-*deep, grounded*
  discovery is far lower for warm; reuse-rate ~1.0 vs 0 by construction.
- Grounding was **equal** (4.6/4.6) — warm's edge is depth, not just citation.

## The honest nuance (which layers write-back actually helps)

COLD was not weak — it independently **re-derived the two blocs** and even **ODS-as-weakest-link**
from the co-voting matrix. So the *first* interpretive layer (community detection) is cheaply
reproducible from the deterministic substrate; writing it back saves little. **Write-back's
payoff is cumulative depth**: each *further* derived layer (contestedness, the control timeline,
theme-grain rebellion) is *not* re-derivable in one pass — each needed its own deterministic
pass (F11, F16, F17) — and once written back, all of them become available at once. WARM's deep
findings each stand on 2–3 of those layers stacked. The flywheel is real, and it is a **depth**
effect, not a first-interpretation effect.

## Corroborating evidence (outside the A/B)

The deterministic compounding passes are the sharpest, if indirect, proof: F11/F16/F17 produced
the term's headline findings at **~0 tokens** by consuming prior passes' written-back edges/props
— and are *literally impossible* read-only (a cold F11 has no blocs or themes to cross). And the
graph produced **two self-corrections** (C1, C2) where a later pass refuted an earlier
interpretive claim — a benefit only a durable, re-readable store can provide.

## Verdict

**Not a flat/negative result.** For the same grounding, WARM produced materially deeper,
prior-analysis-dependent findings at lower token cost, and a blind judge preferred it and
independently identified the derived-vs-raw split. Write-back buys the flywheel — concentrated
in accumulated **depth**, not the first interpretation.

## Limitations

One synthesis A/B (n=1 task), one judge, one dataset; token cost is output-token proxy. A
publishable version would repeat across several targets and judges and report variance. The
design's warm-vs-cold *sequence* (cost-per-discovery curve over many matched passes) is the
fuller test; this establishes the single-pass signal cleanly and cheaply.
