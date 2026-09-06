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

**2026-08-27 — UI + routes (WP3).** Five thin routes; RSC everywhere except the
lookup (`features/volby/components/VolbyLookup.tsx`, two `Combobox`es over the
6 254-obec registry and the 14-row crosswalk). `generateMetadata` distinguishes
outage (`robots: {index:false}`) from a real 404; `?kraj=` is validated against
the crosswalk and silently dropped otherwise. NAV module `volby` lists `/kraj`
and `/kompas` as children a second time (their original parents keep
`entryFor` precedence); `/volby/snemovna` had to be a NAV child too — the
sitemap reads NAV. `features/shell/sidebarParts.test.ts` now pins six modules
and asserts `volby` is deliberately ABSENT from `lib/civic` MODULES: this
surface has no sample-data fallback, only `DataUnavailable`.
`features/volby/messages.test.ts` pins, besides parity and the language gate, a
no-accusation regex over every Czech string, the sentence that nejasné bodies
are NOT localised, and that „skóre" appears only in negation.
`/metodika` §05 (`features/civicscore/MetodikaVolbySection.tsx`) prints every
threshold as an import and gives each rule the anchor `#volby-<ref>` a finding
row links to; the catalog is flat (`metodika.volbyRule_<kind>_title/_rule`)
because the metodika parity test walks flat strings.
Known v1 limits: a `list:<pspId>` finding on the home feed links to the list
index (no slug on `Finding`); the zero-finding sentence names the term window,
not a lot count (an empty `SubjectCard` carries none); `ProvenanceCapsule`
receipts are not minted — `u.`/`h.` refs link to `/zdroj`, other refs render
as text. `custom/require-source-citation` warnings: 0 before, 0 after.

**The timeline got its first dated chamber outcome (2026-09-04).** Every `law_*` finding
on this surface shipped `decidedOn: null`, because `volbyLoader.ts` set
`sponsoredOn: null` on every sponsored bill — no bill prop carries the sponsorship date
— and `rules.ts` derived `decidedOn` from it. The dated-outcome timeline therefore had
nothing to anchor a legislative finding on.

The `decides` edges (roll call → print) date the chamber's own act on a sponsored print.
`SponsoredBill.finalVoteOn` is the day of the LAST roll call on it, and `law_final_vote`
(`volby:R1`) is emitted for it.

**It is a RECORD row, not a finding** — the `contested.ts` doctrine. Valence `unrated`,
so `rollupLedger` counts it and shows it but never adds it to `total`: that the chamber
voted on a print is neither a credit nor a charge against the member who tabled it, and
scoring it either way would be the surface inventing a judgment its rules do not hold.

**And it does not fill `decidedOn`.** The vote is a LATER fact about the bill, so it
lands on `laterOn` with `laterKind: "final_vote"`; `decidedOn` stays null until the graph
actually carries a sponsorship date. Putting the vote date in the decision slot would
have made „when the chamber acted" read as „when the member chose" — the timeline's whole
distinction. A roll call on a multi-print agenda item still dates each of its prints: the
vote genuinely disposed of the whole block, and a date claims nothing about which print
the block was about.

Until the writer runs against the live store there are no `decides` edges, so no
`law_final_vote` row is emitted and nothing on the surface changes.

**2026-09-07 — the person urn is read through `pspIdFromNodeId` (scan-sweep, parity-auditor).**
`volbyLoader.ts` spelled `/^psp:person:(\d+)$/` twice (ties per person, sponsors per
person); `lib/ingest/changeEvents.ts` owns that grammar. Both sites read it now.
