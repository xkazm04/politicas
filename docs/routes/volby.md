# /volby — Volby: zrcadlo

## Current contract

**Routes** — `/volby` (lookup „Kde volíte?" + national context: arena census
tiles, latest dated findings), `/volby/obec/[ico]` (the obec as zadavatel for
the komunální ballot + its kraj + the sněmovní lists carrying this kraj's MPs),
`/volby/kraj/[slug]` (the kraj as zadavatel + its MPs by list),
`/volby/snemovna/[slug]` (one elected party list, its members' findings rolled
up; `?kraj=<slug>` pins that kraj's MPs).

**What it derives** — a **severity ledger of findings (nálezy)** per accountable
subject, composed **at read time** from persisted, cited signals by the
deterministic rules in `lib/analysis/volby/rules.ts` (N1 konvejer, N2 dvorní
dodavatel, N3 rotace, N4 krátké lhůty, P1 čistý radar for authorities; law
posudek, sponsor-money conflict, became-law-clean, effort badges for MPs →
their **elected party list**, never their club; money ties as an unrated
count). Plus a **dated-outcome timeline**: the date of the choice → the later
dated fact the graph holds (`fate_published_on`, forensic/flag provenance
dates). Contested votes render as a *record* (positions), never as a finding.

**What it refuses to derive** — a composite score (three of four sources are
`pending_review`; a party with unverified ties is „nezhodnoceno", never
scored); any obec↔authority link beyond IČO equality (příspěvkovky and city
companies are the national `nejasne` count, disclosed, never localised); a
council's political composition (no source); any person name on a komunální or
krajské card (only the gated `/penize` lane names people); positions on a vote
as good or bad.

**Reads** — one memoised tender fold (`features/volby/tenderLayer.ts`: kind
`tender` nodes + `procures`/`wins` edges + authority `company` nodes with
`electoral_arena`/`tender_winner_circle`, at `KG_READ_CAP`), the leaderboard
chamber pass (`buildLeaderboard`), `listMandates({termCode:"PSP10"})` for
`partyListPspId`, the 6 254-obec registry (`features/budget/mirrorData.ts`),
bill nodes for forensic/conflict/fate props. Term windows and the 14-row kraj
crosswalk (psp organ label ↔ NUTS3 ↔ VOLKRAJ ↔ kraj IČO) are constants in
`lib/analysis/volby/{terms,kraje}.ts` — they existed nowhere before 2026-08-27.

## Dated record

**2026-08-27 — born from `/spark election-replay`** (design record:
`docs/spark/ideas/election-replay.md`). Stands on the tender loop's binding
decisions R1–R4 of 2026-08-24 (`docs/data-analysis/case-tender/STATE.md`):
„Radar zakázek" is the tender section of this surface, lookup-first per R3, no
new data campaign per R4. Rule thresholds are the gated artefact: candidates
were hand-read against the b007 Havířov case before merge.

**2026-08-27 — loaders (WP2) measured on the live store.** Cold tender fold
3 814 / 4 065 ms (61 421 `tender` nodes · 61 383 `procures` · 31 744 `wins` ·
17 728 `company` → 5 240 authorities), memoised cross-request; warm requests
134–242 ms; the 12-vote ballot read rides the index (2 400 rows / 33 ms).
`czkFloor` sums `wins.price_czk` (present on 16 955/31 744 wins) and says so.
Three things the data forced:
- **The arena is registry-corrected.** 1 296 obce from the 6 254-obec registry
  carry `tender_authority_category` „Příspěvková organizace kraje" (Havířov
  among them), 129 „Kraj", 70 „Česká republika"; Středočeský kraj is declared
  `komunalni`. So an obec IČO → `komunalni`, a crosswalk kraj IČO → `krajske`,
  else the declared arena; `arenaDeclared` is kept and the corrected count
  (1 518) is in provenance. Pass-74 data is untouched; without this, Havířov
  would run under the krajské term window and cite the krajské baseline.
- **The current-holder signal** is `membership` on the PSP10 chamber organ
  (pspId 174) with `to_at IS NULL`: exactly 200 persons; `mandate_from/to` are
  null on all 1 332 PSP10 rows. The loader discloses when it has to fall back.
- **Two rules were recalibrated on the first read** (`lib/analysis/volby`):
  a posudek is a finding only from `medium` up (every one of the 141 bills has
  one, so `low` posudky made SPOLU carry 346 negatives over 52 seats), a list's
  ledger counts each bill once (`dedupeByObject` — co-signing is one bill, not
  twelve), and a roll call needs ≥ 100 positional ballots to rank as contested
  (a 1:1 vote of 2026-07-02 topped the term without the floor).
Rule fire rates after correction: komunální N1 1,1 %, N4 0,2 %, P1 0,4 %;
krajské N1 0,7 %, P1 0,5 %; N2/N3 one authority each nationally — all far under
the 15 % recalibration bar. Havířov (00297488): N1 medium + N4 medium over 1 553
lots, as the b007 case file predicts.
Known: the baseline `source` refs (`claim:volby-census:…`) are labels, not yet
resolvable at `/zdroj`; no sponsorship date exists on any bill prop, so law
findings carry `decidedOn: null`. Registry Czech (organ names, obec names, vote
titles) is the only prose these loaders emit, so no language gate applies.
