# Tender batch 002 — the layer exists, and the islands touched land immediately

Case ④ needles · 2026-08-24 · **pass 67**.

## 1. Schema + writer

- `tender` node kind + `procures` / `bids_on` / `wins` rels (kg-verdict enums, prop
  registry, graph-schema, kindStyle — tender draws as a steel diamond and is a BULK kind
  like contract; sourceLinks cites the ISVZ source file, since no per-lot public URL is
  verified yet).
- `scripts/case-loops/tender/persist-month.ts`: deterministic, replayable from the cached
  zips, pass-stamped, prop-key-gated before any write, idempotent (loop-owned layer →
  wholesale props replace on re-run is correct).

## 2. The identity gate grew a third state

b001's country gate said czech/foreign. Measured in the writer's first dry run: 3 735
participant entries carry **no IČO and no country** — the register anonymises losing
bidders in some tools. The first draft filed them as "foreign" and tripled that count.
Three-way now: **czech** (IČO + CZE/unstated) → company node · **foreign** (country stated
≠ CZE) → counted on the tender, never minted · **unidentified** → `unidentified_participants`
on the tender node, disclosed, because a participant list that hides 42 % of its entries
must say so.

## 3. Pass 67 — June 2026, CPV 45

| written | count |
|---|---|
| tender nodes | 3 625 |
| new company nodes | 3 377 (authorities + identified bidders/winners; company namespace 350 → 3 727) |
| procures / bids_on / wins | 3 609 / 5 257 / 1 832 |
| foreign kept off the namespace | 23 participants · 11 winners |
| unidentified disclosed | 3 736 entries |

`props-check` clean · 17 700 rows · backup `pass67-pre`.

## 4. The finding: islands touched land in the first month

**18 MP-tied companies appear in the tender layer without any join logic** — shared
`company:ico:*` identity did it. And they appear on the AUTHORITY side: **Teplárny Brno
procures 27 construction lots in one month**; Krajská zdravotní, the Zlínský-kraj
hospitals, VaK Vsetín/Vyškov all procure. The two graphs meet exactly where the money case
said they would: the steward institutions are the buyers. Person → company → **their
procurement behaviour** is now one walk.

## 5. Next (b003)

Ingest backward (2026-05 … 2026-01 + 2025-12…), then first flags per the b001 calibration:
`single_bid` (competitive procedures), `tight_spread` (<5 %), `short_deadline` (per-procedure
p10). Trailing-window flags wait for ≥12 months.
