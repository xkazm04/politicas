# Q-law-8 — amends edge regeneration: impact analysis (batch-004, prepare only)

Edge count: **150 (current) → 282 (regenerated)**, Δ+132. 53 bills use the census `amended_laws_full` list, 85 fall back to the title-derived `amended_laws` prop, 3 have neither (logged, not dropped).
Missing law nodes: **188 distinct statutes** cited with no corresponding `law` node in the graph, affecting **289 bill-citations** — proposed follow-up census, not built this batch.

## Churn re-ranking — top 10 most-amended statutes, before vs after

| rank (after) | statute | after count | before rank | before count | Δ |
|---|---|---|---|---|---|
| 1 | 40/2009 | 12 | 2 | 6 | +6 |
| 2 | 586/1992 | 9 | 1 | 7 | +2 |
| 3 | 256/2004 | 7 | 5 | 4 | +3 |
| 4 | 117/1995 | 6 | 4 | 4 | +2 |
| 5 | 134/2016 | 6 | — | 2 | +4 |
| 6 | 2/1969 | 6 | — | 1 | +5 |
| 7 | 89/2012 | 6 | — | 2 | +4 |
| 8 | 243/2000 | 6 | 8 | 3 | +3 |
| 9 | 187/2006 | 6 | 10 | 3 | +3 |
| 10 | 427/2011 | 6 | 3 | 4 | +2 |

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
| 424/1991 | 4 | 6, 7, 64, 77 |
| 21/1992 | 4 | 7, 64, 65, 143 |
| 256/2000 | 4 | 7, 64, 77, 221 |
| 12/2020 | 4 | 24, 65, 77, 172 |
| 365/2000 | 4 | 24, 64, 65, 77 |
| 111/1998 | 4 | 64, 145, 215, 228 |
| 49/1997 | 4 | 64, 67, 77, 83 |
| 234/2014 | 3 | 7, 67, 76 |
| 280/2009 | 3 | 7, 64, 215 |
| 372/2011 | 3 | 7, 14, 64 |
| 87/1995 | 3 | 7, 64, 143 |
| 15/1998 | 3 | 13, 64, 143 |
| 200/1994 | 3 | 55, 56, 234 |
| 127/2005 | 3 | 56, 64, 77 |
| 114/1995 | 3 | 64, 67, 83 |
