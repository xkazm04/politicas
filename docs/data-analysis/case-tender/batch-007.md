# Tender batch 007 — Havířov, read by hand

Case ④ needles · 2026-08-24 · no graph writes (deep-read batch; evidence
`deep-read-authority-00297488-2026-08-24-1236.json`). New durable tool:
`deep-read.ts` — the case file for one authority or one winner, register numbers
only, no judgments.

## 1. The machine, in numbers

**1 553 lots · 2,21 mld. CZK floor · 513 flagged (33 %)** — and now the cadence:
a continuous **20–70 lots every month since 2023-10** (peak 2025-05: 71). The
procedure mix is the mechanism: **733 uzavřená výzva + 651 otevřená výzva
(89 % below-threshold výzvy)**, 119 ZPŘ, only 37 open procedures. In an
uzavřená výzva the city chooses whom to invite — the concentration below needs
no further explanation, and none is asserted: the shape is procedural and
lawful, which is exactly what makes it a needle picture rather than a kauza.

## 2. The conveyor and its specialists

| winner | lots | CZK floor | avg/lot |
|---|---|---|---|
| VLAMAG Czech s.r.o. | 121 | 17,2 M | **142 k** |
| Havířovský sociální podnik, s.r.o. | 102 | 21,9 M | 215 k |
| Ristorispetto s.r.o. | 81 | 30,6 M | 378 k |
| Petr Kuš (OSVČ) | 70 | 5,7 M | **81 k** |
| MATOSA PROFISTAV s.r.o. | 49 | 21,6 M | 441 k |

VLAMAG's 121 wins are **all of its wins in the whole 20-month corpus** — 100 %
dependence, same as Petr Kuš (70/70) and Hornosušská stavební (19/19). The
`repeat_winner` flag caught this live: VLAMAG at 41–46 prior wins/365 d in
December 2025 alone. The dominant lot species is „Oprava volného bytu …" —
flat renovations at 300–550 k, one address at a time.

## 3. What the register hop corrected (ARES VR, read this batch)

„Havířovský sociální podnik" — the name suggests a municipal social enterprise.
**The register says otherwise:** founded 2015 by two individuals, and since
2024-02-14 **100 % owned by HMF Group s.r.o.** (jednatelé Horáková Matušínská,
Horák) — a private firm with a city-flavoured name winning 102 lots from the
city. VLAMAG: two Havířov individuals. **Names are not facts; ownership hops
are** — the money-loop's rule holds here verbatim.

## 4. The big flagged lots read differently from the small ones

The conveyor lots fire marginal flags (7-day windows vs class p5 of 8 — the
inputs disclose exactly how marginal). The **large ZPŘ lots** are the other
species: roof repair 8,1 M with spread 3,2 %, and a retention basin at
**7 449 999,59 CZK with spread 0,8 %** — two bids landing within 60 k of each
other on a 7,4M job, the textbook cover-bid shape (stated as a spread fact, not
an accusation). A city can host both species at once; the case file separates
them.

## 5. Tool defects the hand-read caught (fixed in `deep-read.ts`)

1. **Counting `bids_on` edges undercounts bidders** — anonymised losing bidders
   (b002's `unidentified` class) carry no edges. The case file now reports the
   register's own `bid_count`, and the first run's „bidders=0/1 with two
   evaluated bids" contradiction disappeared.
2. **Cadence needs a date fallback chain** (`endedOn → startedOn → decided_on`):
   Havířov's výzva lots carry no lhůta end at all; the first cadence was one
   „bez data" bucket. 493 lots still have no date anywhere — disclosed, not
   interpolated.

## 6. Next (b008)

The needle-city profile generalises or it doesn't: run the same case file over
the next 2–3 high-flag-share authorities from the pictures (Bytová správa MV →
OTISTAV; a hospital; an archive) and see whether „conveyor + specialists +
below-threshold výzvy" is Havířov's shape or the genus. Then the product
surface has its first two rendering species: conveyor pictures and cover-bid
shapes.
