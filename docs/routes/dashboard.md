# /dashboard — Velín

## Current contract

**Routes** — `/dashboard` (the velín: state-graph canvas + textual node list,
dated-fact feed, leaderboard ledger, four stat tiles, module rail) and
`/dashboard/exponat/[id]` (a citable exhibit of one graph slice or fact).

**Reads** — `features/dashboard/getDashboardData.ts` is `server-only` and
**re-derives nothing**: it calls the loaders that already own each figure
(`getLeaderboardData()` · `getMoneyData()` · `getLawData()`) and projects. The
recompute date is the chamber's own `ContributionProvenance.computedAt`, never a
literal and never the first node iterated. Contracts are read through the
indexed `kgNeighbours()` per drawn company, never a `supplies` scan.

**Owned rules — pure modules, each with a colocated test:**

| Concern | Owner |
| --- | --- |
| Which nodes the canvas draws | `stateSlice.ts` — seeds are the first N MPs by **ascending pspId**, a rule that makes no claim, and it is PRINTED under the picture |
| The traffic feed | `datedFacts.ts` — typed DATED FACTS only; the graph keeps no changelog, so no "what changed" is invented |
| Which nodes a fact lights / pins | `datedFacts.ts` (`refs` = the filter, `subjectRef` = the crosshair) · `feedRelevance.ts` (sample feed only) |
| Public addresses for a node | `entityLinks.ts` — **null** for party, law and vote (no stream is keyed by those), and sample ids refused by SHAPE |
| Keyboard traversal | `graphTraversal.ts` — the planar arrow rule, also imported by `/penize`'s money graph and `/hlasovani`'s seismograf; deliberately NOT by the 1-D review queue |
| Selection state | `useGraphSelection.ts` — selection is shared (URL `?uzel=`), hover is a local preview |
| Wire | `publicWire.ts` (`MONEY_WIRE` under `satisfies Record<keyof DashboardMoney, …>`) |
| Exhibit identity + resolution | `exhibit.ts` (`hashSlice`) · `getExhibitData.ts` (`locateDatedFact`) |
| Freshness bound | `freshness.ts` (`MONEY_MEMO_TTL_MS` — imported everywhere, never re-declared) |

**Standing rules.** No layer computes a number a module already publishes;
if the velín would have to derive it, the loader that owns it grows the field
instead. A layer that fails degrades on its own to a labelled ILLUSTRATIVE tile,
and `LiveDataNotice` **names** the dark layers — silent partial degradation
reads as an editorial choice. An impossible date is not a dated fact: excluded,
counted, disclosed, never corrected. Every tie renders its `pending_review`
state on the node itself. The exhibit's address is the CITED one — a stale
exhibit is a note, not a death, and it never rewrites its own address; changing
`hashSlice` invalidates every issued citation and is a deliberate act, not a
side effect.

**Freshness, honestly.** `revalidate = 86_400` is declared and kept in step by
`freshness.test.ts`, but `lib/i18n/request.ts` reads the locale cookie in
`getRequestConfig`, so **every route in the app is `ƒ (Dynamic)`** and
`revalidate` is a ceiling, not today's behaviour. What actually bounds staleness
is `MONEY_MEMO_TTL_MS`, and the page prints that bound.

## Dated record

`/dashboard` — **Velín** (features/dashboard): rebuilt 2026-07-26 as an
instrument panel. **PARTIALLY REAL** — `getDashboardData.ts` is a `server-only`
loader that re-uses the loaders which already own each figure rather than
re-deriving anything: `getLeaderboardData()` (contribution index → avg tile,
attendance tile, top-5 real pspIds, score histogram), `getMoneyData()` (money
tile = the /penize attribution rule: contracts of firms MPs own/run, steward
money shown separately, all ties `pending_review`), `getLawData()` (bill→law
`amends` edges + the known census undercount). The header's recompute date is
the graph's own `contribution_provenance.computedAt`, not a literal. The money
read is memoized for the process lifetime (~12 s cold over ~153 k contracts),
like `features/graph/graphLoader.ts`. **The state graph is REAL too since
2026-07-28** — `features/dashboard/stateSlice.ts` is a PURE builder over the
same two projections (so the velín re-derives nothing), and its **seed rule is
neutral by construction and printed under the picture**: seeds are the first
N MPs by **ascending pspId** (a registry number makes no claim; any ordering by
a metric — money, degree, contract recency — would turn the front page into a
ranking or an accusation-by-adjacency) drawn from the population that carries
BOTH a `linked_to` tie and a sponsored bill amending a law, plus the graph's
only 2 party-donating firms so the party kind is representable. Money in the
slice obeys /penize's attribution rule (owner/manager ties only — steward money
is the institution's, never the MP's), every tie renders `čeká na kontrolu` on
the node itself, and node ids are real (pspId / 8-digit IČO) so every link
resolves. `SLICE_SEEDS = 3` targets ~17 nodes, the current renderer's cost
envelope. `buildStateGraph()` stays as the labelled fallback; both builders are
held to the same invariants (`lib/civic/stateGraph.test.ts`,
`features/dashboard/stateSlice.test.ts` — `features/**/*.test.ts` joined the
vitest suite for it). Beside it the **graph-traffic feed is REAL too**:
`features/dashboard/datedFacts.ts` is a second pure builder that turns the
slice's own entities into a chronological ledger of DATED FACTS (contract
signatures with CZK, committee assignments, Sbírka publication, registry role
start/end). The graph stores no changelog, so no "what changed" is invented —
a row is a TYPED fact and i18n sets the sentence around it. Ordering is date
desc, ties broken by identifier asc, stated in the panel. A fact whose entities
the canvas does not draw is dropped (no dead crosshairs), a fact resting on a
`pending_review` tie says so on its own row, and **a fact with an impossible
date is not a dated fact** — the corpus holds signatures in the years 0002,
2027, 2029 and 3062; they are excluded, counted, and the count is disclosed,
never corrected. Contracts are read through the indexed `kgNeighbours()` per
drawn company, never a `supplies` scan. The mock `EVENTS` feed survives only as
the labelled fallback. Below them the leaderboard ledger. A layer that fails
degrades on its own to an ILLUSTRATIVE `StatTile` (ochre edge, steel numeral —
distinguishable at a glance); a total store failure additionally renders
`LiveDataNotice` saying the live data is unavailable. The five module tiles
live in the layout rail.
**The panel is OPERABLE since 2026-07-28** — one stated selection semantics
(`features/dashboard/useGraphSelection.ts`): the **selection** is the shared
state (URL `?uzel=<node id>`, read by both canvas and feed), while **hover is
a preview local to `StateGraphCanvas`** that lights a trail and moves nothing
else. The URL is written with `history.replaceState` (selecting a node is not
navigation) and read only in a mount effect — the first render is `null` on
both sides, because `useSearchParams` would either force the page dynamic or
risk the hydration break this repo has already paid for; a `?uzel=` value the
slice does not draw is ignored AND scrubbed from the address. Clearing has
three routes: the `zrušit výběr` button, `Escape`, and a click on empty
canvas. The crosshair pins by an explicit **relevance rule**, never array
position: for real facts the sentence's SUBJECT (`DatedFact.subjectRef` —
contract→company, registry role→MP, committee/Sbírka step→bill), for the
sample feed the subject implied by the event kind
(`features/dashboard/feedRelevance.ts`); a subject the slice does not draw
yields no crosshair and the row says so, rather than pinning something the row
is not about. A11y: the `<svg>` is `role="group"` (not the leaf role `img`,
which hid its 18 node buttons from assistive tech), DOM focus draws its own
dashed cobalt ring distinct from the selection ring, and both the canvas
status bar and the feed's filter banner are `aria-live` regions; dimmed rows
carry an `sr-only` sentence naming the filter they fall outside of.
**Hover is also free now** — measured with render counters over a CDP mouse
sweep across all 18 nodes (36 hover transitions): `DashboardPage` 36 → **0**,
`GraphFeedPanel` 36 → **0**, `FactRow` 432 → **0**, node-label computations
684 → **0**; only `StateGraphCanvas` still re-renders (36), which is the trail
it draws. Labels are cached per node in a `WeakMap` that lives in its own
`useMemo` keyed **only on locale** — inside the big memo it saved nothing,
because `useTranslations` returns a fresh function every render. recharts
moved into the memoized `components/ChamberChart.tsx` (0 renders across 6
selections), and the 38 static grid lines are a module constant.
**Freshness** (`features/dashboard/freshness.ts`): `revalidate = 86_400` on
the route, kept in step with the loader by `freshness.test.ts`. But note what
the build actually says — `lib/i18n/request.ts` reads the locale cookie in
`getRequestConfig`, so **every route in the app is `ƒ (Dynamic)`** and
`revalidate` is a declared ceiling, not today's behaviour. What really bounds
staleness is the money-layer memo, which was process-lifetime and now **expires
after the same window**; the page prints its build date and that bound.
**The front door caught up with the truth (2026-08-04).** The velín is the only
surface that had NO messages test, and four falsifiable sentences outlived their
correction elsewhere. It printed **„9. období"** in four keys over loaders that
read `PSP10` — the tenth — after /zebricek (b9731c5) and /penize (dd71582) had
both fixed AND pinned exactly that; `realStats.attendanceSub` additionally
hardcoded „207 poslanců" instead of counting. The money tile asserted **„všech
{pending} z {total} vazeb čeká na lidskou kontrolu"** as a literal, which the
review console can falsify with one click — it now renders the SAME four-phase
derivation /penize publishes (`features/money/reviewSummary.ts`, over
`verifiedTies`/`pendingTies`/`rejectedTies`, all three already computed and read
by nobody here), and it renders **„nejméně"** plus the cap explainer when
`contractCoverage.isFloor` — it used to print /penize's arithmetic bare, i.e.
with more confidence than the module it takes the number from (live: `isFloor`
is false). The lead promised „pohyby v žebříčku a nové hrany v grafu" — deltas
nothing renders, because the graph keeps no changelog; that is the whole reason
the feed is DATED FACTS, and the copy now says so.
**Provenance is the chamber's, not the first node's.** The loader ran its OWN
`listKgNodes({kind:"person", limit:1000})` and returned the first `computedAt` it
iterated — the exact mistake `features/civicscore/provenance.ts` exists to remove,
on a read whose small limit also forces PGlite past `kg_node_kind_idx` into a
~154 k-row scan. That read is DELETED. The date now comes from
`getRecomputeFact()` (features/schranka — one indexed `KG_READ_CAP` read,
`react.cache()`d, and it answers only when the whole chamber agrees on one
`{pass, ref, computedAt}`), and the header renders the aggregate the leaderboard
payload ALREADY carried: four states with four sentences (`uniform` with a date ·
uniform without an agreed day · `mixed`, naming the variant count · `absent`),
plus the formula-mismatch line that made the 2026-07-29 → 08-04 divergence
invisible. Live: uniform, pass 42, `contribution-committee-dedupe`, 207/207,
`formulaMatch: true`, `computedAt: 2026-08-04`.
**Partial degradation is no longer silent.** `LiveDataNotice` rendered only when
the WHOLE loader returned null; money-null, law-null or slice-null left just a
tile tag, which reads as an editorial choice rather than an outage. A second
notice now NAMES the layers that are dark, assembled from what is actually null.
`features/dashboard/messages.test.ts` pins all of it (cs/en key parity, ICU
parity, no empty value, no „9. období", no bare `207`, a sentence per review phase
and per provenance state, floor language present).
**The velín joined the fabric (2026-08-04).** It summarizes four modules and led
into almost none of them by ENTITY: zero `/denik` links (the deník is the same
dated-fact stream, keyed by the same public keys), zero `/metodika` links under
the index it makes the page's largest numeral, no follow affordance on the node
a reader just selected, and the **company node linked `/penize/<pspId>`** — the
first MP tied to it — although the firm has had its own case file since 6bc8780
and **14 firms are tied to more than one MP**, so that link was misleading by
construction. `features/dashboard/entityLinks.ts` is the ONE rule (pure +
`entityLinks.test.ts`): a slice node id (`p:<pspId>` · `c:/m:<ičo>` · `b:<č>`) →
the public entity key, built with `deriveDenik`'s own `mpEntityKey` /
`companyEntityKey` / `billEntityKey` and `dayAnchor` — never a second copy — and
**null for party, law and vote**, because no stream is keyed by those and offering
the affordance would promise a delivery nobody can make (the `obec:` precedent).
It also refuses SAMPLE ids by SHAPE (`c:3` is not an IČO, `p:mp-novak` is not a
mandate number), and the canvas offers deník + follow only while `rule !== null`,
so `buildStateGraph()`'s invented entities can never mint a real address. Fact
rows carry a deník link to their subject's day anchor, the feed header links the
whole deník, the canvas status bar carries the deník link plus the shared
`FollowButton` (imported, `iconOnly`), and the avg-index tile + ranking footnote
link `/metodika`. The exhibit dropped its private `CopyExhibitLink` for the shared
`CopyLinkButton` (extracted 2026-08-04 to prevent exactly this second copy) and
gained **„ověřit tuto citaci" → `/overeni?ref=…`** — the gate already knows the
`family: exponat` shape, and a page built to be cited had no path to the verifier.
**The tiles carry round 4 (2026-08-04).** Three finished products were invisible on
the front door while sitting in the payloads the loader already awaited — so this
is **zero new store reads** (the loader's read set is unchanged; grep it). The law
tile printed bills/laws/amends — the graph's PLUMBING — while `LawData` carried
`flaggedCount`, `forensicCount`, `summaryCount`, `paragraphDiffCount` and
`forensicWithheldCount`; all five now render, and a WITHHELD verdict string is
disclosed as withheld rather than described as absent. The top-5 ledger printed
rank/name/club/score beside a **competition rank 55 of 207 MPs share** — „1." in
the red top-3 colour over a tie invents a winner — so a shared rank now says so
(never reorders), and the row carries the three effort verdicts through the
EXISTING components (`LowScoreReasonChip`, `WorkhorseBadge`, `RapporteurBadge`,
compact densities, imported not forked): each dated from `effort_provenance
.computedAt`, each printing the figure it rests on, each rendering nothing when
the node carries no value. `DashboardTopEntry` grew six fields plus
`duelFacts.speechTurns`; the six component points, seven raw counters and the PSP9
trend deliberately stay out. The money tile's gate sentence is Direction 1's
`reviewSummary()`.
**The velín ships what renders (2026-08-05).** `features/dashboard/publicWire.ts`
is the projection, applied in `app/dashboard/page.tsx` BETWEEN the loader and the
client (the /penize `TIE_WIRE` pattern). Two things crossed the network for
nobody: `StateSlice.sources` — the working set `sliceContracts()` reads contracts
with and `buildDatedFacts()` turns into `feed`, consumed ENTIRELY on the server —
and `DashboardMoney`'s `mpsWithTies` / `companiesLinked` / `totalTies`, /penize's
own aggregates that this page renders nowhere. `MONEY_WIRE` classifies every
`DashboardMoney` field under `satisfies Record<keyof DashboardMoney, …>`, so a new
field fails to compile until someone classifies it. The slice narrows to
**`Pick<StateSlice, "graph" | "rule">` — literally the type `hashSlice()` accepts**,
so the exhibit address computed from the wire IS the one computed from the full
slice (verified live: `rez.03b874d8` from both). `getExhibitData()` keeps the FULL
shape: it re-derives on the server and must not see less than the page.
The four mock renderers are **code-split** via `next/dynamic` (no `ssr:false` —
the fallback still server-renders): `MockStatTile` · `MockStatTiles` ·
`MockRankingLedger` · `MockGraphFeedPanel`. The mock feed's `event.id → uzly` maps
and its relevance rule (`feedRelevance.ts`) used to be computed on EVERY render of
the happy path, where they draw nothing; they now live inside the mock panel. The
real and sample feeds share ONE chrome (`components/FeedPanelShell.tsx`) rather
than two copies of the window. Measured on the live store: **props 12 271 →
10 605 B raw (−13,6 %), 3 222 → 2 903 B gzipped**; the /dashboard page chunk
**34 359 → 32 866 B** with 8 460 B of mock renderers moved to four lazy chunks;
the rendered markup of the real path is **byte-identical** (83 327 B normalized,
diffed against the pre-change tree on the same store). Honest limit: the shared
`lib/civic/data` chunk stays eager anyway — `features/shell/sidebarParts.tsx`
imports `MODULES` on every route.
**The canvas reads for keyboards and screen readers (2026-08-05).** It drew ~17
`<g role="button" tabIndex={0}>` nodes, so the picture was **seventeen tab stops**
a reader had to walk through to reach the traffic feed — in the order the array
happens to be built — and there was **no textual alternative to the graph at all**.
It now has ONE tab stop (roving tabindex) and is traversed with the **arrow keys
along its own edges**: `features/dashboard/graphTraversal.ts` is the pure rule
(`neighbourStep` picks the NEIGHBOUR whose direction is closest to the arrow's,
ties broken by id asc; a direction with no neighbour is a **no-op — wrapping would
teleport the reader to a node the arrow does not point at**), Home/End jump to the
first/last node in the canvas's own drawing order, Enter/Space select, and
**Escape now clears from PANEL level** — it used to hang off the `<svg>`, so it did
nothing while focus sat on the status bar's own „zrušit výběr" button. The pattern
is PRINTED on the surface (`graph.keyboardHint`), because one tab stop plus
edge-walking arrows is not guessable. Announcement is deliberately native: the
arrow moves REAL DOM focus, so the screen reader reads the new node itself; a second
`aria-live` would read everything twice. Each node's `aria-label` gained its
position („uzel 4 z 16") and its degree, so a step is orientable without the picture.
Beside it, `components/GraphNodeList.tsx` is the graph AS TEXT (collapsible) — the
SAME `graph` / `rule` / `selected` props and the SAME `onSelect`, never a second
derivation: nodes in drawing order, each with its ties (rel + the other node,
`pending_review` stated), its case-file `href` and — only over a REAL slice — its
deník address through the shared `entityLinks.ts`.
Verified live in headless Chrome over the live store (CDP key events, not a
simulation): **16 canvas nodes / 1 tab stop**; ArrowRight→ArrowRight→ArrowLeft→
ArrowDown→ArrowUp→End→Home walked Benda → tisk 72 → z. 90/1995 → tisk 72 → tisk 72 →
Benda → z. 491/2001 → Benda; ArrowLeft with no neighbour was a no-op; Enter wrote
`?uzel=b%3A72` with **1** canvas node `aria-pressed` and **1** list row
`aria-current` (one selection, two surfaces); Escape pressed with focus on the
status-bar button cleared the URL; and ONE Tab from the canvas node landed on the
textual list. Honest gap: this repo has no jsdom/testing-library, so the DOM wiring
is covered by that live pass plus `graphTraversal.test.ts` over the pure rule — not
by a component test.
**The feed lights the whole node (2026-08-11).** `refs` — the feed's FILTER —
used to name only the nodes a fact literally mentions, so NO row ever carried
a law (`l:`) or party (`y:`) id and no contract/bill row a person (`p:`):
~10 of 16 nodes selected to a deterministic „0 z 12" of rows dimmed with no
sentence. The broadening is TYPED, printed on the surface (`feed.filterRule`)
and read ONLY off edges the slice drew (zero new store reads): company+money
are one entity, a contract fact carries the tied MPs, a role fact carries the
firm and the party it donated to, a bill fact carries its sponsors and the
amended statute. **Refused: a contract fact never carries the party** —
lighting a contract under a selected party is accusation-by-adjacency, the
same thing the seed rule refuses; two-hop adjacency is computed nowhere.
`subjectRef` (the crosshair) is untouched — refs broaden the filter, never
the subject. A matched-nothing selection renders ONE honest sentence naming
the entity + its deník link (only while `entityLinks` gives it a key) instead
of twelve dimmed rows; an entirely empty ledger keeps its own truer sentence.
Also: a tie fact's id was keyed on `refs` — widening the filter would have
silently moved every registry-role exhibit; identity is now the subject +
company, pinned by test.
**The velín reads what it already has (2026-08-11).** Two reads deleted: the
party map now rides the memoized chamber pass (`LeaderboardData.
partyNodeIdByLabel`, additive) instead of a `limit:50` read measured at
498–723 ms for 8 rows; `computedAt` joined the chamber provenance aggregate
(`ContributionProvenance.computedAt`, uniform-only at DAY granularity, the
/schranka bar) so the dashboard dropped its per-request `getRecomputeFact()`
person scan (/schranka keeps its own — its badge must not build a chamber).
The left rail STOPPED INVENTING NUMBERS: `content.modules.*` metricValue
(„2,1 mld Kč", „312"…) rendered in cobalt on every route while the
„ilustrativní ukázka" qualifier was dead code with no renderer — deleted from
the content model and both catalogs, pinned by `features/shell/
sidebarParts.test.ts` (the one surviving pair, follow-the-money's, has a live
labelled consumer in `MockStatTiles.tsx` and the test verifies that consumer
still reads it). The loader header now names `attendance` as its ONE
derivation, and the store-down header note no longer asserts the term.
**The exhibit outlives the window (2026-08-12).** The velín's feed window
(FEED_ROWS = 12) was acting as a derivability boundary: `getExhibitData`
resolved a cited fact against the WINDOWED book, so every fact citation died
the moment twelve newer facts existed — the page answered „gone" and /overeni
„zaznam-nenalezen" about a row the same pass still derives. The cut is now
the CALLER's decision (`DatedFactOptions.limit`, default FEED_ROWS;
`getDashboardData({factLedger:"full"})` turns it off for the exhibit path
only — the wire still carries exactly FEED_ROWS, pinned), and
`locateDatedFact()` is the ONE rule: null = today's pass no longer derives
the fact (genuinely gone), `beyondWindow` = derived, just older than the
front page shows (a note, not a death). A stale exhibit also stopped
REWRITING ITS ADDRESS: `citedId` carries the URL segment verbatim, and
copy / „ověřit tuto citaci" / report all ride the CITED address
(`exhibitAddresses()`, pure) — asking the gate about today's canonical
address returned „sedí" about an address nobody ever cited; today's address
renders as its own labelled link only when it differs. Fingerprints are
deliberately unchanged (x/y + partyCode stay in `hashSlice`): evicting
layout from the hash is a one-time invalidation of every issued address and
is recorded as a follow-up IN the hash's doc comment, not smuggled into a
pass whose whole point is that citations survive.
**The velín admits an outage and cites the omluvy register (2026-08-12).**
A sliceContracts failure used to `catch → []` — a partial store failure
rendered as a healthy contract-free ledger, with `darkLayers` (only
{money, laws, slice}) unable to name it. `ContractLayerRead`
(`ok | truncated | failed`, in `datedFacts.ts`) now travels to the READER:
`failed` is a fourth darkLayers channel, and both `failed` and `truncated`
render their own sentence in the feed footer — „no contracts" and „the
contract layer could not be read" are two different claims (the truncated
sentence deliberately does NOT claim the dropped rows are „the cheapest":
kgNeighbours orders weight desc nulls last, which is not a total order).
The attendance tile stopped citing „reálná jmenovitá hlasování" over a
number derived from the OMLUVY register — it now cites psp.cz — omluvy
(pinned against the imported `COMPONENT_DEFS`), says what it measures, and
a missing `absence_rate` is EXCLUDED from the mean (`LeaderboardEntry.
absenceRate` is `number | null`; it used to enter as 100 % attendance),
with the counted population printed whenever it is smaller than the
chamber (`DashboardData.attendance = {avgPct, counted, total}`). The
provenance sentence, formula-mismatch warning and freshness bound left
their `hidden sm:block` wrapper — no information on the velín is
desktop-only. `graph.realRule` narrowed to the population the seed scan
actually reads (donor firms among MP-tied companies, not „v grafu
jediné") and is pinned; the money and law tiles finally carry doors to
/penize and /zakony (the avg-tile /metodika pattern).
