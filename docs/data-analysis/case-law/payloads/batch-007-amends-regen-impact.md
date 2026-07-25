# batch-007 — amends edge regeneration (post-N1/N2 census fix): impact analysis (prepare only)

Edge count: **150 (current) → 581 (regenerated)**, Δ+431. 55 bills use the census `amended_laws_full` list, 77 fall back to the title-derived `amended_laws` prop, 9 have neither (logged, not dropped).
Missing law nodes: **5 distinct statutes** cited with no corresponding `law` node in the graph, affecting **5 bill-citations** — proposed follow-up census, not built this batch.

## Churn re-ranking — top 10 most-amended statutes, before vs after

| rank (after) | statute | after count | before rank | before count | Δ |
|---|---|---|---|---|---|
| 1 | 40/2009 | 12 | 2 | 6 | +6 |
| 2 | 586/1992 | 9 | 1 | 7 | +2 |
| 3 | 141/1961 | 7 | — | 1 | +6 |
| 4 | 2/1969 | 7 | — | 1 | +6 |
| 5 | 256/2004 | 7 | 5 | 4 | +3 |
| 6 | 634/2004 | 7 | — | 1 | +6 |
| 7 | 89/2012 | 7 | — | 2 | +5 |
| 8 | 117/1995 | 6 | 4 | 4 | +2 |
| 9 | 134/2016 | 6 | — | 2 | +4 |
| 10 | 634/1992 | 6 | — | 2 | +4 |

### Before top 10 (current 150-edge graph), for reference

| rank | statute | count |
|---|---|---|
| 1 | 586/1992 | 7 |
| 2 | 40/2009 | 6 |
| 3 | 427/2011 | 4 |
| 4 | 117/1995 | 4 |
| 5 | 256/2004 | 4 |
| 6 | 491/2001 | 3 |
| 7 | 128/2000 | 3 |
| 8 | 243/2000 | 3 |
| 9 | 1/1993 | 3 |
| 10 | 187/2006 | 3 |

## Top missing-law-node statutes (no graph node — cannot become an edge)

| statute | citing bills | sample cislo |
|---|---|---|
| 132/2010 | 1 | 69 |
| 330/2025 | 1 | 250 |
| 387/2024 | 1 | 250 |
| 505/1990 | 1 | 250 |
| 539/1992 | 1 | 250 |
