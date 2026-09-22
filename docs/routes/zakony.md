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

**The bill dossier gained its roll calls (2026-09-04).** `/zakony` promised the
vote→impact loop at founding and drew 141 bills with **zero** votes: `BillDetail.tsx`
contained no occurrence of `vote`/`hlasov` at all, and this file said so — „the graph
carries no bill-stage pipeline, so neither is drawn". The missing piece was one edge.
`decides` (roll call → print) joins `vote_event(sessionNo, agendaItem)` to
`bod_schuze(bod, id_tisk)` through the sitting's agenda; `LawBillView.rollCalls` reads
it, and `RollCallBlock` renders how the chamber and each club stood, roll call by roll
call, with the psp.cz address on every one.

**Not a second derivation.** The chamber tally and the club lines come from
`getFullVoteRecord().voteIndex` — the same memoized artifact `/hlasovani` renders. This
route now imports it. Computing the tallies here instead would have given two surfaces
two different numbers for one roll call, which is the failure `voteIndex` was extracted
to prevent in the first place.

**Three refusals ride on the block, all visible to the reader.** A roll call whose
agenda item carried several prints (`itemPrintCount > 1` — six items in PSP10, every one
a „písemné interpelace" block) prints a line saying the vote was on the block, and the
edge stays on all of the block's prints rather than being narrowed to a plausible one.
`chamber === null` prints „we hold no ballots", never a zero tally — „no ballots" and
„nobody voted" are different claims. And the reading stage is **not drawn at all**:
`readingStage` is null on 100 % of edges because no dump column labels it, and inventing
one would publish a procedural fact the source does not carry.

**Wire ruling.** `rollCalls` is `internal` in `BILL_WIRE` — the index neither filters,
searches nor renders it, and the field carries a whole-chamber tally plus every club's
line, i.e. more bytes than the rest of a row put together. It stays on `/zakony/[cislo]`.
`publicWire.test.ts` holds that adressably, with a non-empty fixture so the assertion has
something to fail on.

**Population, printed on the surface.** Of 2 075 valid PSP10 roll calls, 473 link to at
least one print and 1 602 do not (828 of them procedural, carrying `bod = 0`). Measured
2026-09-04; the writer has not been run against the live store, so until it is, every
dossier renders this block empty — an honest empty state, not a failure.

## 2026-09-04 — the gate state is READ, and an absent one renders as absent (G2, deck #5)

`getLawData.ts:201` used to be `reviewState: state ?? "pending_review"`. That
default was not a harmless fallback — it was a fabrication with a very specific
shape: **it promised a queue.** „Pending review" says a human will get to this,
and until today no writer of `forensic_review_state` existed anywhere in the
tree (grep found readers in `triage-core.ts` and this loader, and nothing else).
So `/zakony` printed `pending_review · 141` beside an „ungated" note and meant
nothing by either.

Two changes, and they are one change:

1. **The default is gone.** `LawForensicView.reviewState` is `string | null`,
   and a bill with no stored state renders as HAVING NO STATE
   (`forensic.reviewStateAbsent`). `ForensicReviewStateCount.state` is nullable
   for the same reason and „no stored gate state" is its OWN bucket in the index
   line — merging it into `pending_review` was exactly the conflation being
   removed. It sorts last on a count tie, because it has no token to compare and
   pretending it has an empty one would hide it among the others.

2. **There is now a writer.** `ReviewRepository.setReviewState({ kind:
   "bill_verdict", billId })` writes `forensic_review_state` after appending a
   chained audit row, in one transaction, with the same terminal-reject and
   reasoned-reversal rules money ties have had since batch 004. The bill detail
   prints the decider beside the state when one exists.

**What the surface still refuses.** It does not rank severity, it does not
translate an unknown token, and it does not infer a state from the presence of a
verdict. A bill that carries `forensic_severity` and no gate state is a machine
finding nobody has looked at, and that is what it says.

**Measured.** Bill forensic verdicts with a writer: 0 → 1 code path (the one
door). Fabricated `pending_review` labels on this surface: 141 → 0. The decided
count is 0 today and the surface says 0 of its real denominator, which is the
first time that sentence has been true here.

**Carry-over.** `/overeni`'s gate modifier for bill claims and the
`/penize/kontrola` lane for this kind are out of this wave by design; the
`/admin` coverage board is the first door.

**A collision pair's batch is the batch of its file (2026-09-07, scan-sweep,
bounty-hunter).** `/zakony/kolize` resolved the batch badge and the method
sentence under each pair by PAIR ID through a ladder of per-file id sets. Pair
ids are not unique across payloads: the same two prints get re-read on a later
topology, and 18 ids occur in more than one file. The ladder gave both rows the
batch it checked first, so four rendered pairs described a batch that did not
produce them (102-111 and 7-221 from batch 008 read as 009; 85-88 and 4-121 from
batch 004 read as 009 and 005). `collisionBatch.ts` dates a row by its file and
carries the per-batch method sentence; `collisionBatch.test.ts` reads the real
payload directory and pins that shared ids resolve to distinct batches. The three
`collision-close-reads-groupN.json` files stay unloaded on purpose: they are the
per-army-group inputs whose union is the batch-003 file, and loading them would
double every batch-003 pair.

**One definition each for the print URL, the origin order and the law-id parser
(2026-09-07, scan-sweep, parity-auditor).** `CollisionsPage` built its own psp.cz
history address beside `lawwatchLabels.pspBillUrl`; `LawWatchPage` and
`BillBrowser` each spelled the origin display order; `getLawData` parsed a law
urn with its own `.replace()` beside `statuteRef.refFromLawNodeId`. All four now
read the shared definition, and `lawwatchLabels.test.ts` pins `pspBillUrl` and
`esbirkaUrl` byte-for-byte to the addresses `lib/kg/sourceLinks.ts` builds (they
were held together by a comment) and gives `citationRef` its first tests.

**2026-09-07 — the collision-radar feeds read the feeds' one origin definition (scan-sweep, parity-auditor).** `feed.json` and `feed.xml` under `/zakony/kolize` each carried a local `host` + `x-forwarded-proto` copy — the fifth and sixth in the tree — while `/denik` and `/dukazy` share `requestOrigin` from `features/denik/feedRequest.ts` (itself on `lib/routing/liveUrl.ts` since round 39). Both radar feeds now import it; `lib/testing/legislationRouteSource.test.ts` forbids the copy.

**2026-09-07 — a radar feed's 503 is never cached (scan-sweep, parity-auditor).** The dukazy feeds send `cache-control: no-store` with their 503 (2026-09-05) so an outage is not stored by a proxy as the feed's answer; the two collision-radar feeds sent a bare 503. Both now carry the header.
