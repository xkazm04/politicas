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
