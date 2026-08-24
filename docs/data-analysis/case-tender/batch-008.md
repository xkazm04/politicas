# Tender batch 008 — the needle-city profile does NOT generalise, and that is the finding

Case ④ needles · 2026-08-24 · no graph writes (deep-read batch; evidence
`deep-read-authority-{65737393,00064220,70978956,03447286,00094871}-*.json`).

## 1. The question

b007 asked whether „conveyor + specialists + below-threshold výzvy" (Havířov) is
the genus or one species. Five case files later: **one flag-share number covers
at least five different authority species**, and ranking them on that number
compares incomparables.

## 2. The species, as read

| species | case | markers, from the register |
|---|---|---|
| **Conveyor city** | Havířov (1 553 lots, 33 %) | 20–70 lots/month sustained; 89 % below-threshold výzvy; 100 %-dependent specialists (121/121, 70/70) |
| **House-supplier lock** | Bytová správa MV (42 lots, 17 %) | 1–3 lots/month only, but OTISTAV takes 23/42 lots (44,7 M) across výzvy and open procedures alike |
| **Framework oligopoly** | TSK Praha (339 lots, 25 %) | 103× „Postup s obnovením soutěže" + 72 užší řízení; winners are the giants (DAP 30 lots, PORR 24, EUROVIA 23, STRABAG 19+26); CZK floor 16,6 mld — **framework-estimate ceilings, not awarded cash** (czkFloor semantics disclosed) |
| **Rotating micro-pool** | Moravská galerie (43 lots, 33 %) | the SAME 4–6 bidders on every výstavnické-práce micro-lot, spreads 1,4–3,5 %, wins alternating among three individuals (Adam Máchal 11, Marcela Jirotová 10, Miloš Měřinský 7) — the textbook rotation *shape*, stated as spreads and bid lists, nothing more |
| **Data-poor / small-n** | Bohnice (34 lots, 0 prices, 0 dates), SOA Třeboň (22 lots) | flag shares of 35–41 % that sit on missing fields or on n barely above the floor — fragile, must not rank |

## 3. What this decides for the product surface

1. **Species before rank.** An authority picture renders its species first
   (procedure mix + cadence + dependence markers, all register facts); flag
   share is a within-species comparison. A 22-lot archive at 41 % must never
   sit „above" a 1 553-lot conveyor at 33 % in one table.
2. **czkFloor must carry its own label** — for framework authorities it is an
   estimate ceiling (TSK: 16,6 mld), for conveyor cities it is near awarded
   cash (Havířov: 2,2 mld). One column, two meanings → the surface says which.
3. **The rotation shape needs a per-authority bidder-pool statistic** (distinct
   bidders / lots, repeat-pool share) — visible in the galerie file by eye, not
   yet computed. Candidate for the next flag pass, with the same hand-read
   discipline (it may be one framing workshop, lawfully invited each time).

## 4. Corrections the read forced

- TSK Praha's cadence gap 2022-04 → 2024-07 is a **coverage artifact** (old
  snapshot lots carry start dates; record-level coverage starts 2024-12) — a
  cadence over mixed-coverage eras must be read per era, never as decline.
- Bohnice's „0,0 M" winner totals are missing prices, not free construction —
  `deep-read.ts` already floors with estimates for the scope line, but winner
  tables show what the register carries (absence stays visible).

## 5. Next (b009)

Compute the bidder-pool statistic (distinct-bidder ratio + repeat-pool share
per authority, small-n floors) as an authority-level measure — the rotation
species' deterministic marker — hand-read the top of the distribution, and
persist it as the first AUTHORITY-level (not lot-level) signal layer if it
survives the read.
