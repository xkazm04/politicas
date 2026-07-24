# Q-law-8 — amends edge regeneration: impact analysis (batch-004, prepare only)

Edge count: **150 (current) → 567 (regenerated)**, Δ+417. 59 bills use the census `amended_laws_full` list, 78 fall back to the title-derived `amended_laws` prop, 4 have neither (logged, not dropped).
Missing law nodes: **0 distinct statutes** cited with no corresponding `law` node in the graph, affecting **4 bill-citations** — proposed follow-up census, not built this batch.

## Churn re-ranking — top 10 most-amended statutes, before vs after

| rank (after) | statute | after count | before rank | before count | Δ |
|---|---|---|---|---|---|
| 1 | 40/2009 | 12 | 2 | 6 | +6 |
| 2 | 586/1992 | 9 | 1 | 7 | +2 |
| 3 | 256/2004 | 7 | 5 | 4 | +3 |
| 4 | 117/1995 | 6 | 4 | 4 | +2 |
| 5 | 134/2016 | 6 | — | 2 | +4 |
| 6 | 141/1961 | 6 | — | 1 | +5 |
| 7 | 2/1969 | 6 | — | 1 | +5 |
| 8 | 89/2012 | 6 | — | 2 | +4 |
| 9 | 243/2000 | 6 | 8 | 3 | +3 |
| 10 | 187/2006 | 6 | 10 | 3 | +3 |

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
