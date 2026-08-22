# /zakony — LawWatch

## Current contract

**Routes** — `/zakony` (LawWatch index: statute tiles, forensic register,
dependencies) · `/zakony/[cislo]` (bill dossier) · `/zakony/predpis/[ref]` ·
`/zakony/kolize` (close-read pairs, with public RSS/JSON feeds).

**Reads** — `getLawData.ts` reads at `KG_READ_CAP` in one `Promise.all`,
`cache()`d and memoized on the imported `MONEY_MEMO_TTL_MS` (the readiness gate
stays deliberately OUTSIDE the memo); `getCollisionData` the same, refusing
store-less and title-less reads. Disk payloads (`bill-summaries-cz.json`,
`batch-017-sector-attribution-para.json`) are read the same way: missing or
malformed → an empty index, **never a page failure**.

**Owned rules** — `sectorAttribution.ts` (projection + the exact-and-unique
label→IČO resolver: ambiguous, unknown and non-canonical all refuse) ·
`forensicIndex.ts` (census closure + severity distribution) · `lawClaims.ts`
(the census-closure and statute-coverage claims) · `billRef.ts` / `statuteRef.ts`
(the two id codecs) · `publicWire.ts` (`LAW_WIRE` / `BILL_WIRE` under
`satisfies Record<keyof …>`; `/zakony/[cislo]` keeps the FULL shape).

**Standing rules.** The graph carries no paragraph diffs and no bill-stage
pipeline, so neither is drawn — fabricating them would violate the brand rule.
A WITHHELD forensic verdict is disclosed as withheld; "zadrženo" is not "chybí".
Adjudicated prose passes the Czech-language + pipeline-jargon gate or the row is
DROPPED, never rendered incomplete. The gate sentence is DERIVED from the stored
token through `features/overeni/gateVocabulary.ts` — the corpus is QUEUED at the
gate, not bypassing it. **No pass number is typed**: no `census_provenance` prop
exists, so the census has no honest pass value and the copy says it is
unrecorded (restoring one is an INGEST change). CZK formats through
`lib/format.ts` — the local `czkCompact` fork is deleted and must not return.
`sponsorContractCzk` is never claimed: its attribution rule is looser than
/penize's.

**Live state** — 141 bills → 101 laws via 150 `amends` edges; 141/141 forensic
verdicts, all `pending_review`, ONE ref across 14 distinct passes (so
`uniformPass` is null); 29 sector-attribution flags on 8 bills; 272 close-read
pairs, 27 incidental.

## Dated record

`/zakony` — **LawWatch** (features/lawwatch): **wired 2026-07-24 to the real
graph** (`getLawData.ts`) — **141 bills → 101 laws via 150 `amends` edges**,
grouped by most-amended statute, with sponsors (→ `/poslanec/<pspId>`),
Case-① conflict flags, and one gated forensic posudek (tisk 58, rendered as
derived/`pending_review`). The mock's **paragraph diffs (before/after) and the
bill-stage pipeline stepper were dropped** — the graph carries no such data
(the `č. N/RRRR Sb.` title citation is the only structured bill→law link
psp.cz publishes); fabricating them would violate the brand rule. Mock kept as
fallback.
**§-level sector attribution reaches the reader (2026-08-05, law-loop batch-020
P2).** `docs/data-analysis/case-law/payloads/batch-017-sector-attribution-para.json`
— 29 DERIVED, UNGATED flags (bill × company × statute), each already carrying
the disposition of a PUBLISHED forensic verdict — sat on disk unrendered. It now
joins the bill's conflict block: `features/lawwatch/sectorAttribution.ts` (pure,
colocated test) projects each raw row and **drops** — never renders incomplete —
a row whose `verdictDisposition` fails the same Czech-language + pipeline-jargon
gate `readForensic()` already runs on forensic prose, because an adjudicated flag
may never read as a bare neutral lead. `getLawData.ts` reads the payload file the
same way it reads `bill-summaries-cz.json` (missing/malformed → an empty index,
never a page failure) and attaches `sectorAttributionFlags` per bill by `cislo`.
Each rendered flag names the company, its sector (`lawwatch.sector.*`, closed
vocabulary, unmapped renders verbatim), the statute, its operative §§ **when the
census isolated them** — a `null` §-list states in one Czech sentence why (census
carries no §-bucket vs. the census's own partitioner fell back), the verdict's
disposition verbatim, and a `deterministické odvození — lidskou branou neprochází`
label reusing the /overeni `ungated` vocabulary rather than inventing a second
phrase for the same fact. Live: 8 of 141 bills carry flags (cislo 11/67/77/103/
121/154/201/221), 27 of 29 flags carry operative §§, 2 carry none (both a census
gap, not a partition fallback — 0 rows in the payload set that flag).
`features/lawwatch/messages.test.ts` is the feature's first messages test: cs/en
key parity, ICU-variable parity, the Czech gate over every `sectorAttribution.*`
string, and no `dávka`/`batch`/`pass` token leaking into reader-facing copy.
**The forensic corpus has an index (2026-08-10).** The corpus closed at 141/141
gated verdicts (law-loop pass 55) and `features/lawwatch/forensicIndex.ts`
derives the census closure + severity distribution the page's §03 register
renders — browsable, not one-per-dossier; a WITHHELD verdict is disclosed as
withheld („zadrženo neznamená chybí").
**The triangle closes (2026-08-10).** The bill dossier's conflict block links
every sponsor's `/penize/<pspId>` case file plus `/penize/strety`, and PRINTS
the attribution-rule difference (the stored figure sums steward seats; /penize
attributes an institution's money to the institution) — it still names NO
company, because the graph stores only counts. Sector flags render their
sponsor (linked only on an exact-unique name match) and link the company via
`buildCompanyIcoResolver` in `sectorAttribution.ts` — exact-and-unique label→IČO
or nothing (ambiguous/unknown/non-canonical all refuse; 9 tests).
`/zakony/kolize` bill chips link the tisk's deník through the IMPORTED codec
(`billEntityKey` + `entityDenikHref`); the dossier crumb links back to /zakony
(only the „zákony" segment); the dependency section renders ALWAYS (honest
empty state on an unreadable census) so navModel can carry `#zavislosti`;
`/zakony/predpis` gets an honest empty state; mock MP chips stopped minting
404 addresses (slug ids ≠ pspIds — the shape-refusal precedent).
**The wire diet (2026-08-10).** `features/lawwatch/publicWire.ts` (the
TIE_WIRE pattern): `LAW_WIRE`/`BILL_WIRE` classify every field under
`satisfies Record<keyof …>`, applied in `app/zakony/page.tsx` between loader
and client — /zakony stops shipping ~1 MB of forensic prose, §-diff text and
rosters the index never renders; four measured booleans (`hasForensic` etc.)
replace fields the browser only measured; `/zakony/[cislo]` keeps the FULL
shape. MockLawWatch is code-split via `next/dynamic` (no ssr:false).
`getCollisionData` is `cache()`-wrapped + memoized on `MONEY_MEMO_TTL_MS`
(refusing store-less, title-less reads); `getLawData` reads at `KG_READ_CAP`
in one `Promise.all` with the same memo — readiness gate deliberately OUTSIDE
it. The 27 incidental close-read pairs (same §, different statute) are now
counted and disclosed on /zakony/kolize (`incidentalPairCount`).
**The law number gets an address, and the register stops denying its own gate
(2026-08-11).** The forensic register printed „deterministické odvození —
lidskou branou neprochází" (GATE_UNGATED) directly beside `pending_review ·
141` — a sentence its own neighbour falsifies: `kg-forensics.ts` writes every
verdict `pending_review` and /dukazy is their sign-off path (zero signed
today), so the corpus does not bypass the gate, it is QUEUED at it. The gate
sentence is now DERIVED from the stored token through the ONE vocabulary
(`features/overeni/gateVocabulary.ts`, where `pending` ≡ `pending_review`),
the verbatim token renders beside the translated label, a new sentence names
and links /dukazy, and a corpus with more than one stored state gets NO
single headline state. `features/lawwatch/lawClaims.ts` (pure + tested)
mints the surface's first claims: the CENSUS CLOSURE (chamber-wide
3-segment ref, status `pending` — `ungated` would deny a gate that exists
and is empty; derivation `<uniformRef>@<uniformPass>` ONLY from the
corpus-wide aggregate, never `LawData.pass`) and per-tile STATUTE COVERAGE
(subject `law:sb:<n>-<rok>` via `statuteRef.ts`'s own codec, status
`ungated` — census arithmetic; a ref that cannot be canonically formed
REFUSES a claim). `sponsorContractCzk` is deliberately NEVER claimed (looser
attribution rule than /penize) and the per-bill verdict claim stays deferred
(blocked by the `lawwatchLabels.czkCompact` duplicate). Both render through
`CitableNumber` (byte-identical visible text); `liveFigures.ts` re-derives
both at /overeni through `getLawData()`/`deriveStatuteDossier()` — a dark
law layer answers `unavailable`, an absent statute `zaznam-nenalezen`, and
the subject check moved INTO the branches that need one (a chamber-wide ref
has none and was answering `gone` before the metric was read).
**The verdict's confidence is citable, and CZK has one formatter
(2026-08-12).** `lawwatchLabels.czkCompact` — the repo's ONE unsanctioned
fork of `lib/format.ts`, measurably different (NaN/∞ passed through as
„NaN Kč" into the PUBLIC /zakony/kolize feeds; negatives ungrouped) — is
DELETED; BillDetail formats via `formatByKind(..., "czkCompact")` and
deriveRadar reads `formatCompactCzk` pinned to `cs` (the feed is
single-voice by its own declaration). The deferred per-verdict claim
exists: `LAW_METRIC.forensicConfidence` („4/5", the surface's most-quoted
number), subject = the bill NODE id via the new `features/lawwatch/
billRef.ts` codec (sibling of statuteRef — `bill:tisk:<tiskId>` is NOT the
public `cislo` that addresses /zakony/<cislo>, and tiskId 0 — getLawData's
read-failure fallback — is REFUSED), gate state `pending`, basis = THAT
verdict's own `forensic_provenance.ref@pass` — a deliberate refinement of
the corpus-basis rule, because a corpus basis for one bill doesn't exist
(measured: 141 verdicts, ONE ref, 14 distinct passes 12…55 → uniformPass
null). `FORENSIC_CONFIDENCE_SCALE = 5` is the one constant behind both the
visible „/5" and the claim's unit. /overeni re-derives via `getLawData`
(dark layer → `unavailable`; unknown/non-canonical id or verdict-less bill
→ `gone`); a bill with no public číslo issues at `/zakony#posudky`, never
an invented path. The `sponsorContractCzk` never-claim rule is now recorded
IN `lawClaims.ts` where the next builder will actually see it.
**The kolize cards lead somewhere, and no pass number is typed (2026-08-12).**
The 272 pair cards on /zakony/kolize labelled PUBLIC print numbers with
`printInternal` and linked nothing — they now use `printNumbered` and link
both bills to `/zakony/<cislo>` (live: 104 distinct links), and the stat
band renders through `f.int`. `collisions.statsSource` / `clustersAside` /
`czechPending` became real ICU plurals („11 dávek", correct at 1 and 2–4).
The three „průchod grafu 20" literals are GONE — and not replaced by an
interpolation: no `census_provenance` prop exists anywhere in the repo, so
the census HAS no honest pass value and all three sentences now say the
pass is unrecorded (a number would have been `LawData.pass`, which
`lawClaims.ts` rule 2 bans for census claims; restoring a real pass is an
INGEST change — stamp `census_provenance` on the 53 bills carrying
`amended_laws_full`). The messages-test jargon gate now covers ALL
lawwatch keys in BOTH locales incl. a Czech-phrase pattern (it was scoped
to three families, cs-only, with a regex that could not match the Czech
phrase — „graph pass 20" in en was structurally invisible). §02 counts its
population BEFORE the slice (`topLawsTotal`) and prints „20 z 284" plus a
door to /zakony/predpis — the cap's own doc comment falsely claimed
`totalLaws` (293, every law node — a different population) reconciled it.
`data.pass ?? "?"` paths render the no-pass sentence pattern; dead
`lawwatch.back` deleted.
**A committee step nobody labelled stopped rendering as „navrženo"
(2026-08-13).** The defect sat on BOTH sides. In the parser,
`STATUS_BY_TYP[…] ?? "navrzeno"` turned an unknown or NULL `hist_vybory.typ`
into the weakest REAL status — and the code space is provably open, the dump
carrying a `typ = 4` no constant covers — against the house doctrine
(`packages/czech-civic-data/src/normalize.ts`: an unknown code maps to an
explicit „unknown", never to a guess). In the READER,
`getLawData.ts` did `asStr(p.status) ?? "navrzeno"`, so an `assigned_to` edge
written by an older pass with no `status` still rendered the claim; fixing only
the parser would have left that half running over the corpus already in the
graph. `unknown` is now a fourth FULL token — in `COMMITTEE_STATUS_KEYS` with
a sentence in both catalogs, so the reader gets „krok zdroj neoznačil" rather
than a bare token, while a token OUTSIDE that set still renders verbatim (the
`tieFlags.ts` doctrine). Same pass, same parser: the committee date stopped
being decided by dump ROW ORDER (`rank >= prev.rank` let the LAST row at the
strongest status win — 180 tied pairs, 175 resolving to different dates, **1
live in PSP10: tisk 43204 → organ 1772, 2026-02-03 vs 2026-02-12**, and that
is the date /denik prints), and **a weaker step's date is no longer lent to a
stronger status** — an undated strongest status now yields no date, because
„přikázáno · <the day it was merely proposed>" is a false sentence the
consumer renders side by side. And `parseBillFates` stopped minting a Sbírka
citation from anything regex-shaped: `zaver_publik = "28.08.0202"` would have
published `sb: "88/0202"`. It now goes through the ONE boundary
(`lib/analysis/plausible-date.ts`, imported, never forked) bounded ABOVE by
the dump's own `retrievedOn` rather than „now" (the `SUPPLIERS_RETRIEVED_ON`
precedent), refuses calendar-invalid dates a lexicographic range check would
pass (`32.13.2025`), keeps the row and its `stav`, and COUNTS the refusals
into `BillFate.refusedPublications` — a silent refusal is the same defect as
a silent guess.
