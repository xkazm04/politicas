# Coverage ledger — civic corpus analysis

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
