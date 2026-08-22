# /poslanec/[id] — Spis

## Current contract

**Route** — `/poslanec/[id]`, the Person profile and politicas.md §3's "real
product": poster header + contribution score/rank, the six weighted components,
the score-legibility panel, the work dossier, money ties, club rebellions,
absence filings, committee seats, career spine, prev/next file nav. No mock
path — an unreadable store degrades honestly, it never invents a person.

**Reads** — `features/profile/getProfileData.ts`, `react.cache()`-wrapped.
Per-MP edges come through the indexed `store.kgNeighbours()`; it must **never**
scan a whole `kg_edge` relation (and every result is re-sorted with
`byListOrder` — see `lib/db/kgOrder.ts`). Registry reads are per person via
`PersonListOptions.personPspIds`; an EMPTY array matches NOTHING, never a
whole-relation read. The chamber pass (`buildLeaderboard()`) is shared and
cross-request memoized, so 207 prerendered pages cost one read pass.

**Nothing here derives its own numbers** — each section calls the loader that
owns the figure:

| Section | Owner |
| --- | --- |
| Money ties, contract lines, headline CZK | `getMoneyMpDetail()`; `profileMoney.ts` is a PURE projection — **zero CZK arithmetic in `features/profile`** |
| Rebellion instances | `getFullVoteRecord()` (features/votetrack) — the same derivation `/hlasovani` draws; `chronicleCap` is a pure prefix cut |
| Rebellion aggregate provenance | `rebellionProvenance.ts` — four states over the edges' own `{pass, ref, computedAt}` |
| Excused absences | `absenceRecord.ts` over `listAbsences({mandatePspIds})` |
| Career spine | `careerSpine.ts` — term code read from the data, both year bounds from ONE window |
| Score legibility | `lib/analysis/score-legibility.ts` |
| Verdict copy | `lib/analysis/{workhorse-flavour,rapporteur-load,low-score-reason,tenure-copy}.ts` |
| Deník / follow / case-file addresses | `deriveDenik`'s own key builders + `followCodec` |

**Server/client boundary.** `ProfilePage` and every section are SERVER
components; the client islands are `MotionIslands`, `AnimatedScore`,
`FollowButton`, `ExpandableText`, `RebellionInstancesPending`. Two rules fall
out of that and must not be broken quietly: **(1) never pass a FUNCTION to a
client component** (pass a `formatKind` instead), and **(2) never read a VALUE
out of a `"use client"` module from a server component**. Translations and
formatters come from `serverIntl.ts` so the two sides cannot render a number
differently. The rebellion section streams inside `<Suspense>` behind
`RebellionSlot`; a `<Suspense>` fallback must be its own client file.

**Standing rules.** Section numbers are DERIVED from what renders — the dossier
is omitted for an MP carrying none, so nothing may hard-code an index. Three
states are kept distinct everywhere: **unreadable ≠ absent ≠ empty** (an outage
must never become a claim about a person, and an empty rebellion record means
below the `MIN_ELIGIBLE_VOTES` floor, never "never deviated"). Every cap
discloses itself. `generateMetadata` distinguishes outage from non-MP and sets
`robots: { index: false }` on an outage. Steward money is read but never
attributed. A bad date loses its date, keeps its row, and is counted.

## Dated record

`/poslanec/[id]` — **Spis** (features/profile): the Person profile —
politicas.md §3's "real product". Wired to the real graph (no mock path):
poster header + contribution score/rank, the six weighted components, the
work-profile dossier (effort-loop enrichment + sponsored/rapporteur bills),
co-voting allies, club rebellions, committee seats, prev/next file nav.
The dossier also carries the **work record** (2026-07-28): floor speeches and
written amendments PER BILL (`spoke_on` / `proposes_amendment`, pass 35,
linked to `/zakony/<cislo>`), the interpellation count and the excused-absence
rate as standalone cited figures rather than invisible score inputs, and the
workhorse / rapporteur-load verdict copy reused verbatim from
`lib/analysis/{workhorse-flavour,rapporteur-load}.ts` (no second copy engine;
both are pinned to the Czech language gate by their own tests). `spoke_on`
covers only the bills the graph carries, so the section prints the whole floor
total AND states that the per-bill list is its evidenced subset. The three
counters are read straight off the person node so an ABSENT prop renders
"údaj v grafu chybí" instead of a fabricated zero.
Under the component tiles sits the **score-legibility panel** — per component
the MP's value in that component's own unit, the scorer's cap, the chamber
median and the rank the real ranked chamber gives at that cap (pure logic +
tests in `lib/analysis/score-legibility.ts`; all of it labelled *derived*, and
a missing input says so rather than rendering a zero).
The **Peněžní vazby** section (2026-07-28) puts the evidence next to the
claim: the MP's `linked_to` ties, each rendered with its own `pending_review`
state (all 211 in the graph are), its verbatim provenance string, the ARES-VR
temporal badge and a deep link to `/penize/<pspId>`. Money obeys /penize's
**attribution rule and nothing else** — only owner-operator/manager firms are
summed; a `steward` seat's institutional contracts are never attributed to the
person and the row says why. A contract whose `signedOn` could not have
happened (the corpus holds 0002 / 1970 / 2027 / 3062 — `lib/analysis/
plausible-date.ts`) keeps its row and its amount, loses its date, and the
count of such rows is disclosed; the date is never repaired. The
absentee-manager lead in the header now carries the `pending_review`
provenance of its money input instead of standing as a bare accusation.
**One money, since 2026-08-04.** The section used to run its OWN `supplies`
read (its own 5 000-row cap, its own `weight ?? contract.amount` fallback) and
its own per-TIE sum — a FOURTH implementation of reachable money beside
`features/money/reachableMoney.ts`, and a measurably divergent one: the spis and
/penize printed different numbers for the same MP (**Hladík 6881: 23 790 791 881,98
vs 23 570 594 009,66 Kč**; Babiš 6150: 16 511 233,47 vs 16 436 383,47). It now
calls **`getMoneyMpDetail()`**, the loader `/penize/[pspId]` itself uses (indexed,
`KG_READ_CAP`, `reachableMoney()` already applied), and
`features/profile/profileMoney.ts` is a PURE projection of its `MoneyMpDetail` —
zero CZK arithmetic anywhere in `features/profile`. The headline figure is minted
with the SAME `mpBucketClaim()` the case-file tile uses, so a ref copied off the
spis re-derives at /overeni (verified live: `smlouvy-firem-poslance` for 6881
answers `ok`, 23 570 594 009,66, `pending`, `kg-pass:10`); every tie row carries
its `receiptRef` → `/zdroj/<ref>` and a `/penize/firma/<ičo>` link built through
`canonicalIco`. Steward money is READ (it is the same slice) but never attributed:
the row keeps its no-CZK rule and points at the two files that do publish it.
Measured cost of the shared read: **556–896 ms cold for MPs carrying ties**
(against 0–296 ms for the old attributable-only read, because the shared slice
also reads steward companies); it is called ONLY when the MP has `linked_to`
edges, so **144 of 207 MPs pay nothing**. A null against a non-empty resolvable
tie set renders „peněžní vrstvu se nepodařilo přečíst", never „žádné vazby" — an
outage must not become a claim about a person.
**Rebellions carry their instances since 2026-08-04.** The section printed one
aggregate rate per club — the only number on the spis a reader could not open.
It now lists the MP's OWN roll calls against the club line (date, how they
voted, where the club stood, the bill), each linking `/hlasovani#h-<votePspId>`
when the vote is inside that page's ledger window and `hlasy.sqw` on psp.cz
always. **No second rebellion rule exists**: `features/profile/
getRebellionRecord.ts` calls the SAME `deriveVoteRecord()` /hlasovani uses and
changes exactly one option it already exposes — `chronicleCap` — because the
chamber-wide chronicle is capped at 24 newest rows and indexing THAT would
answer „no rebellions" for nearly everyone. Uncapped it is **1 301 instances
across 188 of 207 MPs** (median 4, max 89 — Vladimír Pikora 7034);
`rebellionRecord.ts` is the pure index + row cap (12, disclosed) and
`rebellionRecord.test.ts` runs the real derivation over a synthetic term to pin
all of it, including that the DEFAULT cap truncates a rebel's record.
**Cost is why it streams.** Measured on the live store: `listVoteBallots`
406 000 rows = **15 758 / 15 987 / 15 984 ms** (events 251 ms, registry 779 ms,
derivation 459–555 ms). `react.cache()` is per-request, so the per-MP index is
memoized ACROSS requests on `MONEY_MEMO_TTL_MS` (imported, never re-declared),
and the section renders inside a `<Suspense>` boundary fed by a server slot
(`RebellionSlot.tsx`) so the first request after expiry ships the rest of the
spis immediately. Neither an empty index nor a failure is memoized; a null
renders „hlasovací záznam není dostupný", never an empty list, and an MP who
never broke the line gets a stated empty record.
**One ledger pass for both surfaces (2026-08-11).** `getRebellionRecord` was a
stale second copy of the read path round 7 unified into `features/votetrack/
ledgerRead.ts`: hand-rolled reads with ad-hoc limits (100 000 / 1 000 000), a
private copy of the readiness floors, and `EventIn` rows WITHOUT `published`
tallies — so the round-7 chamber-reconciliation was structurally dead on the
spis (compared 0 on this path) while running on /hlasovani. It now rides
`readLedger()`/`toEventIn` (reconciliation live here too, chronicle
byte-identical — pinned both ways), and **the derivation itself is shared**:
`getFullVoteRecord()` (features/votetrack/getVoteRecord.ts) memoizes the
record with the chronicle UNCAPPED, /hlasovani slices its 24-row window off
it, and the spis indexes the same object — one ~16 s read + one derivation
per TTL window ACROSS both surfaces. That the cap is a pure prefix cut is
proven, not assumed: `chronicleCap.test.ts` pins prefix identity, that every
other `VoteRecordData` field ignores the cap, and that the pinned field list
is the WHOLE type — a new field cannot join it without someone ruling on the
cut. (The „getKompas holds a third ledger pass" flag is RESOLVED — round 9's
kompas-rides-the-record deleted its private memo; today it rides
`getFullVoteRecord()` + the scoped `readBallotsForVotes`.)
**Five honesty seams closed (2026-08-11).** The header's absentee qualifier
asserted the MP's ties „všechny čekají na lidskou kontrolu" — a LITERAL one
/penize/kontrola decision falsifies; it now renders the phase derived by the
SAME `reviewSummary()` /penize and /dashboard read (plus its own sentence for
„money layer unreadable" — unread is not unreviewed), and the messages-test
regex that let it slip (it REQUIRED a digit) now matches the claim's SHAPE.
The ally list's `.slice(0, 8)` — the last silent cap on the page — discloses
itself with `coVotersTotal`; `listMandates` reads at `KG_READ_CAP`;
prior-term membership reads run in parallel; `periodNote` takes its term
number from `termNumberOf()` with `periodNoteUnknown` for an unparseable
code (a test forbids a term digit in either catalog); `effort_public_role`
renders ONCE (the dossier keeps it under its labelled heading; the badge
dropped the prop).
**The amendment can be read (2026-08-11).** Every `proposes_amendment` edge
carries `props.sd_cislos` — the psp.cz sněmovní dokument numbers, i.e. the
TEXT each MP actually filed (pass 35; live-probed 172/172) — and the spis
read only `weight`. `snemovniDokumentLink()` in `lib/kg/sourceLinks.ts`
builds the address (`sd.sqw?o=10&cd=<n>`, tier `detail`, verified by
fetching 2026-08-10; the term number is ONE constant shared with the bill
link, deliberately NOT a `sourceLinksFor` branch because the number lives on
an EDGE, not a node). The dossier's amendment rows render the per-document
links; a record with no number renders its count and says so (never a
guessed URL), and a list ≠ stored-weight mismatch is DISCLOSED with the
weight authoritative — never repaired.
**The absence rate has its rows (2026-08-12).** The dossier printed one
scalar `absence_rate` whose own citation named „omluvené dny / jednací dny"
— two figures shown nowhere — while 6 425 dated, TIMED excuse filings (the
corpus's top-scored slice) sat unrendered. `features/profile/
absenceRecord.ts` (pure + tested) projects filings → days: several windows
on one day are NEVER merged into a whole day (celodenní is only what the
source flags), a future-dated filing is a REAL record (filed ahead —
rendered, tagged, counted, never corrected), an unreadable date drops and
is counted; cap 12 days, disclosed. The read rides the never-used
`absence_mandate_idx`: `listAbsences` gained `mandatePspIds` (an EMPTY
array matches NOTHING — the BallotListOptions precedent; measured 14–20 ms
per mandate vs 410–483 ms per term; the lister also gained the
`warnIfTruncated` it alone lacked). Three states, the RebellionInstances
trio: unreadable ≠ zero filings ≠ rows. Three honest limits in the copy,
test-pinned: psp.cz publishes NO reason (omluvy.unl has exactly id_organ,
id_poslanec, den, od, do); this is NOT the ballot-level „omluven" (a
different fact from a different dataset); and the rate above is a STORED
pass value, not a live sum — verified through the shipped path that
`round3(min(1, totalDays/63))` reproduces the stored rate for 207/207 MPs
(one clamps at 100 %: an excuse may be filed for a day with no roll call,
so the two day-sets don't nest — the copy says so).
**Silence tells the truth (2026-08-12).** Three round-13 honesty fixes:
`generateMetadata` distinguishes outage from non-MP the same way the body
does (outage → its own unavailable copy + `robots:{index:false}`, never
„spis nenalezen" — a crawler must not store a claim a broken database
invented); the empty rebellions state names the `MIN_ELIGIBLE_VOTES = 50`
floor (imported, interpolated) and admits the aggregate wasn't measured —
empty means BELOW THE FLOOR, never „never deviated", because the edge
writer emits `0/N` rows for above-floor conformists; and the term literals
(„10. období"/PSP10 in tenure + omluvy citations) fell to `{term}` params
while the guard regex that was supposed to catch them — structurally dead,
JS `\b` after „í" never matches — was fixed and FALSIFIED in both catalogs.
**The spis links the fabric it belongs to (2026-08-04).** It sat at the centre of
the graph and pointed almost nowhere: no `/denik?entita=poslanec:<pspId>` (the
dated stream about the same entity, keyed by `mpEntityKey` — imported, never
rebuilt), no way back to `/zebricek` although navModel's own note says „index
spisů JE žebříček", no `/metodika` from the score-legibility panel (the one
surface that most needs the formula), no human address for the minted score claim
(now `/overeni?ref=<ref>`, minted ONCE and shared by the machine attributes and
the link), and the region rendered as dead text while `/kraj/<slug>` exists
(`krajSlug` owns that address). `DossierSection` and `CareerSpineSection` also
carried no `id`; they now anchor `#dosier` / `#kariera`. Both stay OUT of
`PAGE_SECTIONS` on purpose — the dossier is conditional and the career spine sits
in the header, and the rail must not offer an anchor that sometimes leads nowhere.
`features/profile/messages.test.ts` now pins the catalog (cs/en key parity, ICU +
`t.rich` tag parity, no empty value, an empty AND an unavailable sentence for both
new states, and the Czech language gate over prose — ICU markup and citation keys
excluded, because `one/few/other` and `lib/analysis/contribution.ts` are English
by construction).
**The record speaks across terms (2026-08-04).** `effort_psp9_trend_note` — the
ONLY cross-term prose the graph holds, and the reason
`CROSS_TERM_PROSE_FIELDS` exists in `lib/analysis/committee-claims.ts` — rendered
NOWHERE. It now renders in `TenureTrendGate`, verbatim, dated from
`effort_provenance.computedAt` and behind the SAME `publicCopyOrNull` guard every
other `effort_*` prose field on this page passes. It renders in BOTH branches: beside
`TrendPanel` where the comparison shows, and inside the suppression notice where it
does not — suppressed RATES are a reason not to print numbers, never a reason to lose
the comparison entirely. Measured on the live graph: **13 of 207** nodes carry it,
**6 pass** the guard (the other 7 quote raw prop identifiers or a sample-scoped
superlative and are withheld whole), and **all 13 sit at `effort_tenure_days` = 293**
— so on today's data the note only ever materialises in the panel branch; the
suppressed branch is proven by construction, not by a row. Verified live through the
loader: 6165 Vondráček (recorded 2026-07-24) and 6459 Janda (2026-07-26) render it,
346 Bendl is correctly withheld.
**Interpellations stay ONE figure, and the page says why.** The ingest distinguishes
written (`tisky.zip` `id_druh = 6`, attributed via `tisky.id_osoba`) from oral
(`interp.zip` `poradi.id_poslanec`) — `lib/ingest/sources/psp-activity.ts` computes
both — but `kg-contribution-ingest.ts:195` writes `writtenInterpellations +
oralInterpellations` into one `interpellations` prop. Verified on the live store:
**207/207 person nodes carry the sum and no split prop of any kind exists**. Splitting
it is an INGEST change, not a render change, so the dossier discloses the composition
as unavailable rather than implying a breakdown it cannot show. Pinned by
`features/profile/messages.test.ts`.
**The spis ships what renders (2026-08-04).** `ProfilePage` was `"use client"` in
FULL, so the ENTIRE `ProfileData` — every contract line, bill title, career segment
— serialized into the RSC flight for a page that is ~95 % static. It and every
section (`DossierSection`, `MoneySection`, `CareerSpineSection`,
`ScoreLegibilityPanel`, `TenureNote`, `LowScoreReasonBadge`, `TenureTrendGate`,
`RebellionInstances`) are now SERVER components; measured, exactly ONE of them
needed a client at all. The client islands are `MotionIslands` (the two
framer-motion pieces), `AnimatedScore`, `FollowButton`, `ExpandableText` and
`RebellionInstancesPending`. Translations and formatters come from
`features/profile/serverIntl.ts` — `getTranslations()` plus `formattersFor()`,
literally what `useFormat` memoizes, so a number cannot render differently on the
two sides. **Measured props across the boundary (live store):** Hladík 6881
23 474 → 3 512 B raw, 6 836 → 2 087 B gzipped (−85 % / −70 %); Babiš 6150 25 796 →
3 997 B raw, 7 137 → 2 206 B gzipped; Nacher 6487 −80 %; Vondráček 6165 −81 %.
Two rules fall out of this and must not be broken quietly: **(1) never pass a
FUNCTION to a client component** — `AnimatedScore` gained `formatKind="dec"`
because `format={f.dec}` does not serialize; **(2) never read a VALUE out of a
`"use client"` module from a server component** — `COMPONENT_FILL` moved to
`features/civicscore/componentFill.ts` (re-exported from `LeaderboardTable`, all
four call sites updated) for exactly that reason. The `<Suspense>` fallback is its
own CLIENT file: an `async` fallback would suspend the boundary it exists to open.
**The chamber pass is memoized across requests.** `buildLeaderboard()` is
`react.cache()`d — per REQUEST — while a static build of /poslanec is 207 pages
that each await it, and /zebricek, /kraj, /dashboard, /schranka and /overeni pay
it again per request. It now also carries a cross-request memo on
`MONEY_MEMO_TTL_MS` (imported from `features/dashboard/freshness.ts`, never
re-declared). Failure-honest by construction: a `null` is never memoized, and
neither is an EMPTY chamber. Measured on the live store: cold chamber pass
**585 ms**, memo hit **0 ms**; 207 sequential `getProfileData()` calls → **1**
read pass (`leaderboardReadPasses()`). **Honest limit:** in a tsx harness
`react.cache()` has no request scope and behaves process-wide, so the harness
cannot reproduce a real build's per-page cache scope — the 207× figure for the
un-memoized case follows from react.cache's contract plus the measured per-pass
cost, it was not observed in a build.
**Four a11y/correctness seams closed in the same pass.** `AnimatedScore` ignored
`useReducedMotion` while the rest of the page gated on it — running digits are
exactly the motion WCAG 2.3.3 is about; it now renders the target value directly
(no `setState` in an effect) and the machine-readable claim is unchanged, because
it always carried the target. The header's `{first}<br/>{lastName}` gave a screen
reader two separate texts (and an empty second line for a single-token name); the
`<h1>` now has ONE accessible name and the typesetting is `aria-hidden`
decoration. `ExpandableText` truncated in the DOM, so **find-in-page missed cited
prose** and printing cut it in half — on a surface whose whole point is that a
claim stands beside its evidence; truncation is now visual only (`line-clamp`),
the text is always complete in the DOM, and the toggle carries `aria-controls`.
`ScoreLegibilityPanel`'s 46rem table scrolled silently and could not be reached by
keyboard; the scroll container is now a labelled, focusable region and says so on
small screens. Also: the unicode-escaped Czech comment block in `ProfilePage` is
normalized, and the stale `03/04/05` section comments — which contradicted the
derived numbering right above them — are gone.
**Section numbers are derived from what renders** — the dossier is omitted for
an MP carrying none, so nothing may hard-code an index. `getProfileData` is
`react.cache()`-wrapped and reads per-MP edges through the INDEXED
`store.kgNeighbours()`; it must never scan a whole `kg_edge` relation (see
`lib/db/kgOrder.ts` for why the result is re-sorted). The route carries an
explicit `revalidate` because the page asserts a committee-seat as-of date.
**The registry is read PER PERSON since 2026-08-13.** `membership_person_idx`
and `mandate_person_idx` have been in the DDL since the first migration with
no lister able to use them, so the most-linked page in the product — and 207
prerendered pages — read every PSP10 membership row (chamber + every child
organ) and the whole ~2 157-row mandate table across all terms, then filtered
each to ONE person in JS, plus one more whole-term membership read per prior
term served. `PersonListOptions.personPspIds` is the additive predicate; an
EMPTY array matches NOTHING (the `BallotListOptions`/`AbsenceListOptions`
rule — an empty filter must never become a whole-relation read), the omitted
option leaves every existing caller byte-identical (pinned by test, as is the
predicate returning exactly what the JS filter did), and `warnIfTruncated`
NAMES the new filter (`persons=N`) because a capped read tells a different
story with a person predicate than without one. Same pass: the money slice's
`readCompanySupplies` loop ran SERIALLY (an MP with 14 tied companies paid 14
round trips in series) with no memo although two reads above it have one — now
parallel, insertion order preserved, each company on the IMPORTED
`MONEY_MEMO_TTL_MS`, with neither an empty read nor a failure memoized and
eviction compared by cell IDENTITY.
**The spis stopped printing two measurements as one (2026-08-13).** „Rebelie
proti klubu" set the stored `rebels_against` SNAPSHOT beside the LIVE
`deriveVoteRecord` chronicle as if the second were a breakdown of the first.
They diverge structurally in four ways — vintage (new roll calls grow the list
and never touch the rate until the next pass); floor (`MIN_ELIGIBLE_VOTES ≥ 50`
on the aggregate, none on the chronicle, so a below-floor MP got „not measured"
ABOVE a named list of rebellions); a different club-line denominator; and
keying (the aggregate is per PERSON, so a club-switcher's whole record folds
under his first club while the rows beneath carry per-ballot clubs) — and its
only citation named no pass, no date and no dataset, thirty lines under the
page's own correct idiom. `features/profile/rebellionProvenance.ts` is the pure
four-state aggregate over the edges' own `{pass, ref, computedAt}`, and the
reason it exists is a bug the first inline version shipped: on disagreeing rows
it printed „the edge names neither a pass nor a computation day" ABOUT ROWS
THAT CARRY ONE. **„Nothing is here" and „we did not agree" are two findings and
need two sentences** (the `indexPassMixed` discipline); the day is compared at
DAY granularity and a junk date is never repaired.
**The career spine stopped hard-coding a term.** `careerSpine.ts` carried
`"PSP9"` in the DERIVATION — round 13 drove term digits out of both catalogs and
this one survived in code, so when PSP11 opens all 207 spisy would print
„období zatím mimo záznam" about a fully-ingested PSP10 with the test pinning
the silence. Coverage now reads the term code from the data. Also: `current` (a
fact about the CHAMBER) is split from `serving` (a fact about the PERSON), so a
relinquished mandate no longer renders as active; `stintCount` counts DISTINCT
windows, not registry rows (the corpus carries duplicates, and two identical
rows are not a departure and a return); and the years column is the pure
`careerYears()` — **both bounds always from ONE window**, where
`mandateFrom ?? chamberFrom` – `mandateTo ?? chamberTo` used to mix a
replacement's own start with the chamber's end, and an end suppressed as
unreadable silently borrowed the very date that had just been refused. The
unrendered `firstRecordFrom` is deleted: it had exactly that defect.
