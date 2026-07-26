# Graph explorer — scale analysis (round 2 input)

Measured 2026-07-26 against a copy of the live store (`PGLITE_PATH=./.pglite-ux`,
3 215 nodes / 25 350 edges). Purpose: size the `/graf` playground correctly
before designing round 2 — round 1's Sonda and Atlas were rejected because they
would not survive the real data volume.

## The one number that decides the design

**`co_votes_with` has 96,1 % density over MP pairs.** The median MP is connected
to 202 of 206 possible colleagues, and thresholding does not save it: even at
weight ≥ 0,97 there are still 7 996 edges. It is not a network — it is a
similarity **matrix** with the shape of an almost-complete graph.

Consequence: **co-voting must never be drawn as individual edges between more
than a handful of MPs.** Any canvas holding ~20 MPs with co-voting on is a
276-edge blanket that hides everything else. The correct renderings are:
top-K allies of ONE selected person (the profile page already does top 8), or
a pairwise readout ("shoda těchto dvou: 94 %"), or a heatmap — never a hairball.

## The evidence graph is small

Without co-voting the graph has **4 854 edges (19 %)** — supplies 2 290,
amends 581, influential_in 605, sponsors 528, linked_to 211, assigned_to 150,
about 179, rest < 100. We already render 2 385 of them at 60 fps in canvas.
**The whole evidence layer fits on one screen today.** The scaling problem is
(a) co-voting and (b) contract leaves — not the interesting edges.

## Degrees by kind (p50 / p90 / max)

| kind | p50 | p90 | max | note |
|---|---|---|---|---|
| person | 209 | 215 | 227 | ~202 of it is co-voting; 2 isolated |
| company | 9 | 26 | 30 | 1 isolated |
| contract | 1 | 1 | 2 | **pure leaves** |
| bill | 6 | 16 | 148 | max = tisk 64 omnibus (148 amends) |
| law | 2 | 4 | 24 | 7 isolated |
| party | 19 | — | 82 | 82 = ANO members via rebels_against |
| organ | 18 | 45 | 59 | |

**A person's evidence neighbourhood is tiny**: companies p50 = 0 (!), p90 = 4,
max 14; bills p50 = 2, max 12; organs p50 = 3. Expanding an MP's evidence ego
is 5–20 nodes — trivially drawable. The median MP has **no** company tie at
all, which is itself a finding worth showing, not hiding.

## Contracts are an aggregation target, not nodes

2 287 contracts hang as leaves off 149 companies, p50 = 17 per company,
**max = 25 — exactly 25 for the top five companies**, which smells like a
per-company ingest cap rather than reality (flagged; do not present contract
counts as complete). Correct UX: one satellite per company — „25 smluv ·
X Kč" — expandable to a paged list sorted by amount. Never 2 287 dots.

## Other constraints

- Label length p50 = 51 chars, p90 = 142 (bill titles). Truncation is
  mandatory everywhere; full title lives in the inspector.
- Isolated nodes exist (2 persons, 7 laws, 1 company) — "no edges" is a state
  the UI must render honestly.
- Payload: full evidence slice ≈ hundreds of KB; per-node expansion tens of
  edges. Only co-voting and contracts ever made payloads big.

## Design consequences adopted in round 2

1. **Multilevel by aggregation, not by hiding**: kind/party supernodes with
   counts at level 0, top-N individuals paged in on expand, leaves (contracts)
   stay collapsed into per-company satellites.
2. **Co-voting is excluded from canvas edges by default** and appears only as
   a per-selection readout; the evidence layer is the graph.
3. Aggregated edges carry their counts as labels — an edge „firma —211—
   poslanec" is a claim about the dataset, so it cites its size.
