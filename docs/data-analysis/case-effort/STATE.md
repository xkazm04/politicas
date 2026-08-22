# Effort loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.**
> (2026-08-22 architecture review: the resume point is a short current-state page, not
> the append-only log.)

**As of:** batch 010 · 2026-08-04 · last graph write **pass 43** (21 nodes, props-merge)
· mode: **staleness-driven** (population closed 207/207 at batch 006).

## Where the case stands

| fact | value |
|---|---|
| population | **207/207 PSP10 MPs** carry a work dossier (closed b006) |
| public-copy gate | `lib/analysis/public-copy.ts` + language gate at the loader; **0/207 withheld field-instances** (re-measured b009) |
| pass-42 correction (committee dedupe) | numbers corrected; prose invalidated by it found and fixed at b010: committee contradictions **15 → 1** (adjudicated FP), stale score citations **16 → 9, 0 on any rendered field** |
| independent re-verification of pass 42 | 15/15 contested MPs reproduce the stored `committee_count` |

## Rules now in code (do not re-derive)

- `lib/analysis/committee-claims.ts`, `lib/analysis/score-citations.ts` — imported by
  `gate.ts` and the scans; no forks.
- `scripts/data-analysis/kg-contribution-recompute.ts` reports every dossier field that
  quotes a score it supersedes (a recompute is not finished when the numbers are right).
- Code owns the number; the analyst adjudicates only the claim (score numerals swapped
  deterministically before the army sees the text).

## Open items (priority order)

1. **9 internal stale-score citations** (`effort_psp9_trend_note` ×7, `effort_analyst_note`
   ×2) — bounded; needs the PSP9 before/after pair extracted, since the prior-term score
   carries its own pass-42 correction.
2. **Q-effort-17 — the aggregation gap**: nine independent agents flagged the committee
   double-filing in prose across b001–b006 and the loop had no path from "many units flag
   the same anomaly" to "the formula is wrong". A per-unit anomaly repeated across N
   dossiers must surface as a signal.
3. Q-money-13 residue: **7 items** held here (stale IČO prop mentions).
4. Test harness: 5–6 PGlite files intermittently time out in `open()` under parallel load
   on this machine (pre-existing; all pass with `--no-file-parallelism`).

## Durable tools (`scripts/case-loops/effort/`, see its README)

`triage.ts` · `gate.ts` · `extract-dossiers.ts` / `extract-role-inputs.ts` /
`extract-q16-inputs.ts` · `merge-batch.ts` · `finalize-ledger.ts` · `measure-baseline.ts` ·
`tenure.ts` · `roles-triage.ts` · `psp9-contribution.ts`.
