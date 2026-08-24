---
name: tender-loop
description: Run the tender-by-tender needle loop over Czech public procurement (ISVZ/RVZ open data) — ingest tenders as their own small graphs, compute deterministic red flags per tender, accumulate authority and supplier pictures from thousands of small inefficiencies, and connect them to the MP graph only where the data reaches it. Use when the user says "run the tender loop", "loop the tenders", "flag tenders", "process procurement", or wants Case ④ to advance.
---

# Tender loop — Case ④ needle-picture analyst-builder

Extends the shared kernel — **read `docs/case-loops.md` first**, then
`docs/data-analysis/case-tender/STATE.md` (the resume point). Vault home:
`docs/data-analysis/case-tender/`.

## The doctrine shift this case exists for (2026-08-23, user-set)

The money loop hunts registered person→company ties — **big fish, most of them
already public knowledge by the time a register records them**. The state does
not primarily lose money there. It loses by **a death of thousands of needles**:
individually small tenders with one bidder, a two-week window, the same winner
for the ninth time — each defensible alone, devastating in volume, and invisible
to person-first analysis precisely BECAUSE no politician appears in them.

So this loop inverts the direction:

```
money loop  (Case ①):  person  → company → contracts     (registered ties)
tender loop (Case ④):  tender  → flags   → groupings     (behavioural patterns)
                                  ↘ authority picture ↙
```

Every tender is ingested as **its own small graph** (tender ⋈ authority ⋈
bidders ⋈ winner). It may connect to the existing MP graph through shared
`company:ico:*` nodes — or not. **Connection is a bonus, never a filter.** The
picture composes from volume: group flagged tenders by authority and by winner,
and inefficiency clusters name themselves. Whether a cluster is corruption or
incompetence is NOT the loop's call — both waste public money, both are
findings, and the surface says "signál", never "vina".

## Population & unit

**Unit = one tender lot** (`část veřejné zakázky` — bids and winners are per
lot). Source: **ISVZ / Registr veřejných zakázek open data** — monthly JSON,
`https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/VZ-MM-YYYY.zip`
(~10–75 MB/month, refreshed the 5th; aggregates Věstník + NEN + Tender arena +
TENDERMARKET). Verified 2026-08-23 on VZ-06-2026: 16 662 tenders / 20 023 lots,
81 % with bid counts, 79 % with full participant lists (7 433 distinct bidder
IČOs in one month), 10 % single-bid. Coverage: record-level from **2024-12**
(earlier months 404; pre-2024-02 is aggregate-only — a longer series needs TED,
out of scope for now). Raw zips cached in `data/raw/isvz/` (gitignored).

**Area scope (first campaign): CPV division 45 — stavební práce.** Largest
division (~3 600 lots/month), the user's named suspect, high needle density.
One area at a time so flag calibration reads one market, not an average of all.

## Graph model (additive; enums in kg-verdict.ts, keys in prop-registry.json)

- node `tender:<lot NIPEZ id>` — props: `vz_nipez_id, name, cpv, cpv_division,
  procedure_type, regime, estimated_czk, bid_count, evaluated_bid_count,
  deadline_days, started_on, ended_on, lowest_bid_czk, highest_bid_czk,
  objections_count, eu_funded, nuts, tool (NEN/VVZ/…), flags[], flag_*` fields.
- edge `procures` company(authority IČO) → tender.
- edge `bids_on` company(bidder IČO) → tender — props `{evaluated, value_czk}`.
- edge `wins`  company(winner IČO) → tender — props `{price_czk}`.
- Authorities and bidders are ORDINARY `company:ico:<8-digit>` nodes — the same
  namespace as the money graph. That is the whole island-connection mechanism:
  no join logic, just shared identity. IČOs zero-padded to 8, ALWAYS
  (memory/ico-node-id-canonical-form).

## Red flags (deterministic; each one a register fact, not a judgment)

Grounded in the Fazekas/GTI corruption-risk method (single bidding in
competitive markets + composite red flags) and zIndex practice. Each flag is
computed by code from ISVZ fields, carries its inputs on the node, and renders
only as „signál k prověření":

| flag | fires when | field basis |
|---|---|---|
| `single_bid` | competitive procedure, exactly 1 bid | podane_nabidky…pocet |
| `exceptional_procedure` | JŘBU only (b004: přímé zadání is routine → authority statistic) | druh_zadavaciho_postupu |
| `short_deadline` | window < per-competitive-class p5 (b004: p10 fires at the boundary) | historie_lhut + start |
| `tight_spread` | ≥2 evaluated bids and (max−min)/min < corpus p10 | hodnoty_podanych_nabidek |
| `repeat_winner` | same authority×winner ≥N wins in trailing 24 m | wins edges |
| `supplier_lock` | authority×CPV HHI above threshold in trailing 24 m | wins edges |
| `estimate_gap` | won price vs estimated value out of band (either way) | predpokladana_hodnota / price |
| `objections` | námitky filed in the procedure | namitky |

Thresholds are CALIBRATED PER AREA from the data's own distribution (percentiles
measured on the scoped corpus, recorded in the batch note) — never imported as
literals from another country's paper. **Every flag's fire rate is validated by
hand-reading a sample of survivors before it is persisted** (the kernel's guard
rule: a guard whose failures nobody has read is not evidence).

## Stages per batch

1. **ingest** — next month(s) of the scoped area: adapter parse → lot rows →
   validate (IČO forms, dates, amounts; drops logged, never silent).
2. **flag** — recompute deterministic flags over the WHOLE accumulated scoped
   corpus (not just the new month — trailing-window flags shift as data grows).
3. **compose** — group by authority and by winner: needle counts, flagged CZK,
   flag mixes. Islands that touch the existing graph (shared IČO with a tied
   company, a publicly-owned authority, an MP-linked supplier) are noted as
   `graph_touch` — a bonus signal, never a requirement.
4. **persist** — payloads through the insert writer with a pass number; vault
   note FIRST, graph second, STATE.md last (kernel order).
5. **reflect** — THE POINT OF THE FIRST TEN BATCHES: what could we actually
   extract? which flags fired honestly, which are noise, what does the picture
   show that a single tender cannot? Update THIS SKILL FILE's "calibration log"
   and the flag table when reality disagrees with the design.

## Case gates

Kernel gates plus:
- (a) a flag never renders as an accusation — Czech copy says „signál",
  „koncentrace", „jediná nabídka", states the inputs, and cites ISVZ;
- (b) corruption vs incompetence is never asserted — both are „neefektivita";
- (c) a tender with incomplete fields gets NO flag it cannot support (absence
  of bid count ≠ single bid) — fill-rate disclosed per batch;
- (d) person-level claims stay in the money loop's human-gated lane; this loop
  may at most note `graph_touch` (deterministic shared-IČO contact);
- (e) thresholds live in code with their calibration evidence, and a threshold
  change re-runs the whole scoped corpus (no mixed-vintage flags).

## Calibration log (living — append per batch)

- **b001 (VZ-06-2026, CPV 45, 3 625 lots):** single-bid 3,5 % overall (median 6 bids —
  competitive market, the flag is a real outlier); by procedure: JŘBU 18 %, přímé zadání
  17 %, uzavřená výzva 8,8 %, open 1,5–1,7 %. Deadline basis corrected to PROCEDURE START →
  lhůta END (the lhůta start is filled ~13 %; end−start would cover 1 % of lots) — fill
  72 %, p10 ≈ 11 days, and the percentile must be per procedure class. Spread p10 ≈ 4,9 %
  (351 lots/month computable). Estimate fill 14 % → `estimate_gap` demoted to an
  authority-level statistic, not a per-lot flag. 8-digit FOREIGN identifiers pass the IČO
  shape test (Slovak 53852869) — the company join gates on COUNTRY, never digits.
  Oligopoly visible in one month: EUROVIA 46 wins/12 authorities, STRABAG 36+23.
- **b002 (pass 67):** participant identity has a THIRD state — 3 736/9 049 entries carry
  no IČO and no country (register anonymises losing bidders) → `unidentified` class,
  disclosed on the tender node, never coerced. Island mechanism CONFIRMED: 18 MP-tied
  companies appeared in month one with zero join logic, on the AUTHORITY side (Teplárny
  Brno procures 27 lots/month) — the steward institutions are the buyers.
- **b003 (pass 68):** monthly files RE-PUBLISH snapshots of older procedures (January:
  71 k records; April: 240 k, 4,95 GB decompressed) — dedupe by lot id, last month wins
  (61 017 → 48 647). Size walls end with NDJSON, not bigger buffers. A new BULK kind
  arrives WITH its drawing policy: the mass map discloses the layer (`omitted`), does not
  draw it (first post-ingest map request: > 900 s CPU, never finished; now 10,5 s).
- **b004 (pass 69):** hand-reading rewrote two flags before persist — přímé zadání malého
  rozsahu is routine and lawful (2 734 per-lot hits were noise; its signal form is VOLUME
  PER AUTHORITY), and p10 deadline thresholds fire at the boundary of a discrete
  distribution (→ p5, competitive classes only). Final rates: single_bid 2,6 %,
  tight_spread 2,2 %, short_deadline 3,0 %, JŘBU 0,5 % — 8,0 % of lots carry ≥1 flag.
  tight_spread samples are textbook cover-bidding shapes. Flags carry their inputs AND
  thresholds on the node; a threshold change recomputes everything (no mixed vintages).
- **b005 (composition):** the pictures work — supplier-lock and one-authority-dependence
  shapes appear at small-n floors (≥20 lots / ≥10 wins), and Havířov (1 511 lots, 31 %
  flagged, two 100 %-dependent suppliers) is the first needle-city profile. CAVEAT CLASS
  DISCOVERED: monopoly counterparties (ČEZ Distribuce 81 %, EG.D 93 % flagged-win share —
  grid connection work is single-source BY LAW). Winner listings must name and exclude
  that class, disclosed, before anything renders publicly.

- **b006 (passes 70–72):** re-ingest WIPES loop-computed flags by design — corpus change
  means ingest-then-reflag, and the writer header says so. Threshold robustness check
  passed (26 % more corpus, spread p10 moved 0,01 pp). Percentile thresholds FAIL for
  tail-shaped signals: lock-share p90 = 0,125 flagged „3 wins of 23" — a lock flag needs a
  legibility bar calibrated AGAINST the distribution (0,5 > p99, disclosed), not a
  quantile of it. Trailing windows evaluate only where the FULL window sits inside
  coverage (`decided_on − 365 d ≥ 2024-12-01`; dated wins only, disclosed). Exclusion
  classes are defined by LAW, not data (`monopoly.ts`: DSOs in, PRAGOPROJEKT deliberately
  out — framework concentration is a real shape).

- **b007 (deep-read):** the deep-read is where tool defects surface — counting bids_on
  edges undercounts bidders (the anonymised class carries no edges; report the register's
  own bid_count), and every date field needs a fallback chain (endedOn → startedOn →
  decided_on) before a cadence means anything. NAME ≠ OWNERSHIP: „Havířovský sociální
  podnik" is privately owned (ARES hop) — never characterise a counterparty from its name;
  hop the register first. Flag species separate on size: below-threshold conveyors fire
  marginal disclosed flags; large ZPŘ lots fire the cover-bid shapes. Both can live in one
  authority, and the case file must keep them apart.

- **b008 (deep-reads × 5):** authority pictures come in SPECIES (conveyor city, house-
  supplier lock, framework oligopoly, rotating micro-pool, data-poor/small-n) and a flag
  share only compares WITHIN a species — ranking across species compares a 22-lot archive
  against a 1 553-lot conveyor. czkFloor means „estimate ceiling" for framework
  authorities and „near awarded cash" for conveyors — one column, two meanings, label it.
  Cadence over mixed coverage eras reads as decline when it is an archive boundary — read
  per era. The rotation species (same handful of bidders, alternating winners, tight
  spreads) has no deterministic marker yet — bidder-pool statistic is the candidate.

- **b009 (negative result, kept):** before designing a statistic, compute its
  DENOMINATOR'S visibility for the target population first — the bidder-pool marker died
  because losing bidders are anonymised for ~95 % of authorities (b002's own numbers
  predicted this). Ratio markers confound volume with closure at scale (ŘSD: 1 002
  distinct bidders "topping" the closed-pool list). A failed statistic stays in the repo
  with its verdict in the header + committed evidence, so no future session re-invents
  it. And when a batch doc states a pattern, mark inference vs register fact — b008's
  „same 4–6 bidders" was an inference and got a written correction.

- **b010 (pass 73):** the rotation/lock marker lives in the WINNER sequence: circle3_share
  × switch_rate (high/high = rotation, high/low = lock) — computed only where >= 20 dated
  wins exist, monopoly class skipped. First AUTHORITY-level persisted layer
  (`tender_winner_circle` on company nodes, ns=circle) — company-node props now carry two
  cases' layers side by side; the prop registry is the collision guard.

- **b011 (increment):** RVZ month files are write-once (Last-Modified proof) — the
  increment is "fetch the newest month only", and the chronological ALL-months replay is
  the only correct read (a month file alone can carry zero wins; its winners live in
  later snapshots). An orchestrator must END WHERE THE READING BEGINS: it may download,
  filter, and print the persist/reflag chain, never run the signal persists itself. A
  downloaded month is not an ingested month — persist writes a machine receipt
  (persisted.json) and the orchestrator reports disk-vs-store drift loudly.

- **b012 (synthesis track opens, pass 74):** the voter bridge was ALREADY IN THE DATA —
  `kategorie_zadavatele` maps 93 % of authorities onto their accountable ballot
  (komunalni/krajske/statni) with zero new downloads. Arena baselines turn every authority
  picture into a citable contrast (Havířov = 9× the komunalni baseline of 3,7 %). The
  synthesis unit is the FINDING: arena × term window × persisted shape × evidence bundle,
  deterministic rules, hand-read gate, „otázky pro zastupitele" language — never an
  accusation, person names only via the gated /penize lane. Categories that legally hide
  the principal (Jiná PO, Jiný zadavatel) stay „nejasne" until an ownership hop — 134,8
  mld. CZK floor waits there, which is the argument for doing the hop next.

## After ten batches (2026-08-24) — what this loop can and cannot extract

**Can (proven):** lot graphs with register facts verbatim; six deterministic lot flags
with corpus thresholds + per-node inputs; authority/winner pictures at small-n floors;
a five-species authority taxonomy (conveyor city / house-supplier lock / framework
oligopoly / rotating micro-pool / data-poor); authority-level statistics (winner circle);
deep-read case files with ARES ownership hops; MP-graph touches with zero join logic.
**Cannot (proven negatives — do not retry):** bidder-pool composition (losing bidders
anonymised, ~95 % of authorities unreadable); per-lot overpricing (estimate fill 14 %);
cadence across the 2024-12 coverage boundary. **The seven method rules** are in the
calibration entries above; the three that prevent the worst repeats: hand-read before
persist, denominator visibility before metric design, species before rank.

## History

- 2026-08-23: skill created from the user's doctrine notes; first campaign
  scoped to CPV 45, record-level ISVZ data 2024-12 → present.
