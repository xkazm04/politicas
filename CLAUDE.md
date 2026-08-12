@AGENTS.md

# Politicas

Public-accountability platform for Czech politics: five interconnected modules
(CivicScore, VoteTrack, FollowTheMoney, BudgetMirror, LawWatch) over one shared
entity graph (person ↔ party ↔ company ↔ contract ↔ vote ↔ budget ↔ law),
positioned as an empirical, methodology-transparent source for the next
elections. **All content is Czech-first** (Czech data and market; `lang="cs"`,
decimal commas via `lib/format.ts`).

**Design & architecture source of truth:** `C:\Users\kazda\kiro\opendata\docs\politicas.md`
(plus `politicas-data-augmentation.md`). Module interaction models come from
the prototypes in `C:\Users\kazda\kiro\opendata\src\cases\`.

## Status — executing the design doc (2026-07-22)

**Konstrukt won** (Sutnar functionalist poster) — canonical reference:
**[docs/DESIGN.md](docs/DESIGN.md)** (read before any UI work). Runner-up
**Rentgen** is a living reference at `features/labs/rentgen/` (`/rentgen`,
noindex). Future surface exploration uses the `prototype` skill.

Route map (politicas.md roadmap execution, sample data):
- `/` — landing (features/landing). Konstrukt. **REAL since `0e8410c`** — the
  hero ranking, hemicycle and specimen ride `getLeaderboardListData()` (the
  same loader as /zebricek, trimmed to what the page draws); `null` renders an
  honest degraded state, never the mock. A 2026-07-29 `/impeccable` experiment
  built four alternative landing worlds behind a switcher (bolder · distill ·
  a ledger/registry world · typeset) and **all four were rejected and
  deleted** — do not rebuild them; the comparison and the reasoning are in
  `docs/design/impeccable-pass-02.md`. What survived is the accessibility
  work, which is merged and staying: `SourceNote` sets a citation by measured
  LENGTH rather than role, the `steel-aa` / `signal-deep` tokens pass WCAG AA
  where `steel` / `signal` sat at ~4,1:1, and the landing is contrast-clean
  (135 → 27 detector findings, 0 contrast failures).
  **The façade cites measured sources (2026-08-12).** The „Surový materiál"
  section rendered seven SAMPLE cadences from `lib/civic/data.ts` („denně",
  „téměř real-time"…) under „ověřené veřejné zdroje" with zero SourceNote — on
  the page whose brand is that every number cites its source. It now reads
  `getAtlasReport()` through the pure projection `features/landing/
  sourceStates.ts` (nothing recomputed: coverage IS the atlas dimension score;
  unrated is `null` + a word, never 0; order is the atlas's own), cites
  /atlas, degrades independently of the leaderboard layer, and the mock
  `SOURCES` + `content.sources.*` catalog block are deleted. Three falsifiable
  literals fell in the same pass (`meta.rootDescription`'s „index efektivity
  … každého politika" → contribution index over 207 MPs of PSP10;
  `landing.methodBody`'s „citace u každého pilíře" + „verzované váhy";
  ReferendumTeaser's hand-typed weights prose — now derived from
  `PUBLISHED_WEIGHTS`, with „207" guarded on data presence). The flagship
  score claim reached the two highest-traffic surfaces: LiveSpecimen and the
  /zebricek Souboj mint the composite through the ONE `scoreClaim.ts` stamp,
  withheld under a reader's custom lens WITH the withholding stated
  (`krajLensNoClaim` reused, not forked). `features/landing/messages.test.ts`
  pins all of it. **And the façade works for every reader (2026-08-12):**
  `.k-range:focus-visible` draws the app's cobalt ring (the sliders were
  keyboard-invisible, WCAG 2.4.7 — the fix also repairs /zebricek's
  WeightPanel), and HeroStory / Hemicycle / SystemModules gate on
  `useReducedMotion` like every sibling surface; `motion.test.ts` pins both
  by source-grep (no jsdom here), each guard verified by falsification.
- `/dashboard` — **Velín** (features/dashboard): rebuilt 2026-07-26 as an
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
  still reads it). The loader header now names `attendanceAvgPct` as its ONE
  derivation, and the store-down header note no longer asserts the term.
- `/poslanec/[id]` — **Spis** (features/profile): the Person profile —
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
  proven, not assumed: `chronicleCap.test.ts` pins prefix identity, that the
  other six `VoteRecordData` fields ignore the cap, and that those seven fields
  are the WHOLE type — a new field cannot join it without someone ruling on the
  cut. (`getKompas.ts` still holds its own ledger read per window — a third
  pass, flagged for a future votetrack round.)
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
- `/hlasovani` — **VoteTrack** (features/votetrack): fusion of all three
  prototype variants — Deník (chronological ledger as master), Sál (sticky
  chamber detail: hemicycle + party breakdown it drives), Linie (club
  discipline board, line matrix, rebellion chronicle). Feeds pillars
  Aktivita/Docházka/Nezávislost; pure vote logic in `lib/civic/votes.ts`.
  **The record has a warm path (2026-08-10).** `ledgerRead.ts` is the ONE
  row→input projection both loaders share; the 406 k-ballot derivation carries a
  cross-request memo on `MONEY_MEMO_TTL_MS` (imported, never re-declared) and the
  page streams shells while the first cold read runs.
  **The chamber checks itself (2026-08-10).** `record/reconcile.ts` (pure,
  fixture-tested) compares OUR recount per roll call against the Chamber's own
  published tallies (`vote_event.yes/no/abstain/notVoting`, read nowhere before):
  pro↔yes, proti↔no, merged K↔abstain+notVoting; `away` is deliberately
  uncompared (the source publishes no column). A discrepancy is a FINDING —
  counted, worst example named with its psp.cz address, never repaired (the
  impossible-dates precedent); missing columns are uncompared, never guessed
  zeros. /kompas reads `vote_tag.confidence` it used to drop: `MIN_TAG_CONFIDENCE
  = 0.7` in `kompas/select.ts`, printed as a LIVE value in the published rule;
  equal-to-floor passes, a missing confidence is kept (a missing value is not a
  low value) and both counts are disclosed.
  **Anchors land (2026-08-10).** `sortValidNewestFirst()` is exported from
  `record/derive.ts` so the kompas measures `inLedger` against the SAME ledger
  window /hlasovani draws — a question outside it says so and links psp.cz
  instead of a silently dead `#h-` anchor (the rebellionRecord `appHref`
  pattern). Ledger rows carry the shared `CopyLinkButton` (row demoted from
  button to wrapper — no nested buttons); navModel lists the five REAL sections
  incl. `#seismograf`; theme rows format via `useFormat`, link their psp.cz
  record and disclose the 80-row cap; the kompas ShareButton guards
  `navigator.clipboard` so the failure copy is reachable.
  `features/votetrack/messages.test.ts` pins the namespace (cs/en parity, ICU +
  t.rich tag parity, Czech gate).
  **The kompas rides the record (2026-08-11).** `getKompas`'s private memo cell
  (its own clock beside `getVoteRecord`'s — the exact two-vintages hazard
  `ledgerMemo.ts` names) is DELETED. `VoteRecordData.voteIndex` is the record's
  own per-VALID-vote index (chamber tally · club lines · the event fields the
  kompas renders · `inLedger`) — zero extra derivation passes, chronicle-cap
  independent by an explicit `chronicleCap.test.ts` ruling, and the ONE field
  `toWireRecord()` strips before /hlasovani's client (746,7 kB that page draws
  nothing of). `selectQuestions` takes the index, so the kompas knows its ~20
  roll calls without reading a ballot; the named votes come through the new
  scoped `listVoteBallots({voteIds})` (`vote_ballot_vote_idx`, unused since the
  first DDL: bitmap index scan, 4 000 rows / 29 ms vs 406 000 / ~7,5 s — the
  small-LIMIT planner hazard does not apply when the predicate itself is
  indexed). Measured: cold 14 283 → 922 ms; after a warm /hlasovani 19 294 →
  6 ms. Selection equivalence proven over all 2 014 live roll calls (0 tally,
  0 club-line mismatches), pinned by `kompasIndex.test.ts`. Tags are read FIRST
  (found live: `vote_tag` = 0 rows — the silver layer is empty, so /kompas paid
  ~15 s per request to answer „unavailable"; populating tags is an un-owned
  batch job, flagged). All four selection floors now count their casualties
  („no ballots held" ≠ „few voted"), and an empty selection renders its own
  sentence instead of the outage state.
  **A never-computed layer is not an outage (2026-08-12).** `vote_tag` = 0
  rows means OUR derived theme layer was never computed, and both surfaces
  used to file that under outage. `features/votetrack/silverLayer.ts` is the
  typed third state (`null` = outage · `{state:"never-computed"}` ·
  `{state:"ready",data}`), and the middle state may only arise AFTER a
  successful `getStore()` — `readVoteTags()` returns `[]` without a store,
  which is exactly how an outage could masquerade as an uncomputed layer.
  /kompas renders `KompasNeverComputed` (what the layer is, that it is NOT an
  outage, no promised date, no pipeline jargon); /hlasovani's `#temata` rail
  anchor finally lands on a sentence instead of a silent spacer, and the
  kompas CTA switches copy AND tone over an empty layer instead of inviting
  „spočítejte si shodu" into it; `app/kompas/loading.tsx` stops promising a
  seconds-long read unconditionally. The `loaders.test.ts` pin that asserted
  silent hiding as the contract was moved deliberately, stated in the commit.
- `/penize` — **FollowTheMoney** (features/money): the Rentgen money-graph's
  production home, translated to Konstrukt — entity-trail graph (hover lights
  edges), kniha vazeb grouped by MP with verified/pending-review states, and
  the trail methodology (IČO join + human gate). Feeds pillar Integrita.
  **Tie class has ONE resolver since 2026-07-29** — `resolveTieClass()` in
  `features/money/reviewTypes.ts`. A class stored on the edge
  (`kg_edge.props.tie_class`, 211/211 on the live graph) is what a reviewer or
  an analysis batch recorded and it WINS; `classifyTie`'s substring guess is
  only the fallback for an edge carrying none, and every surface says which of
  the two it is rendering (`tieClassOriginInfo`). Five ties disagree and the
  stored value is the investigated one — IČO 24227901 is the MP's own SVJ, and
  the product used to caption it "vlastní nebo řídí soukromou firmu, která
  dodává státu". Never call `classifyTie` to decide what renders.
  `review_tier`/`review_rank` are a different thing — a pass-24 CACHE of a pure
  function, stale on 153/208 ranks after the batch-012 contract re-ingest — so
  `resolveReviewOrder()` keeps a stored key only while it still matches the tie
  and recomputes otherwise, reporting the count on the console rather than
  mixing two vintages of one sort key in one queue.
  **The console sees what the public sees, since 2026-08-04** — `ReviewTie` is now
  `MoneyTie` plus the console's own fields (id/src/dst/pspId/mpName/club/period/links),
  and `getVerificationData.ts` fills it through the SAME `mapLinkedToTie()` the ledger
  and the case file use. It used to lift a narrower projection off the identical edge,
  so the person DECIDING a tie saw strictly less evidence than a member of the public
  reading `/penize/[pspId]`: no flags, no analyst note, no owner stake, no prior-term
  note, no earlier decision. Measured on the live graph: **211/211 pending ties carry
  `reviewer_note`**, 82 carry `flags`, 10 an `owner_stake_pct`, 1 a `prior_term`.
  The console's staleness prompt keyed off `periodTo === null && !corroboration`, which
  matches **0 of 211** ties (all 211 carry a corroboration verdict); it now fires on the
  `stale-ongoing-in-graph` flag, which **42** ties carry. Machine tokens are never shown
  raw to a reader on either surface: `features/money/tieFlags.ts` is the ONE dictionary
  (22 tokens, Czech + English, pinned to the language gate by `tieFlags.test.ts`), and an
  unmapped token renders VERBATIM and labelled as untranslated rather than hidden.
  Analyst prose renders through `components/AnalystNote.tsx` on both surfaces — dated and
  attributed from `corroboration_provenance`, linked to `corroboration_source`, and
  stating that a pass wrote it and the tie still awaits the human gate. Reviewer prose is
  NOT withheld by `lib/analysis/language-gate.ts`: measured, that stopword classifier
  calls **14 of 211** genuinely Czech notes English (registry Czech is full of homographs
  — "OR", "evidence", "ARES VR"), so the gate binds the copy WE write, not the evidence
  we show. `/dukazy` still publishes no reviewer notes (`deriveFeed.ts`).
  **A review decision is reversible, since 2026-08-04** — a gate a human cannot
  correct is a one-way write. `getVerificationQueue()` now returns `decided` beside
  `ties`: verified/rejected ties used to vanish from the product entirely (the queue
  filters to `pending_review`). Each carries its DECISION HISTORY assembled by
  `gateFromEdge()` — the provenance capsule's own assembler, reused, not forked — from
  ONE grouped `listReviewAudit` read per page (0 rows on the live store today).
  Reversal is `needs-more` on a decided tie: the tie returns to the queue and the
  reversal APPENDS an audit row, so nothing is rewritten and `verifyAuditChain` still
  passes across it (pinned in `review.test.ts`). It REQUIRES a reason —
  `setTieReviewState` returns `"reversal requires a note"` and writes nothing at all
  (no audit row, no edge update), because the chain is the only place the reason
  survives (`props.review_note` is overwritten by the next decision). Re-affirming the
  same state is not a reversal and is unaffected. **`REVIEWER_NAME` is now required
  with `REVIEWER_TOKEN`**: the action used to stamp the literal string `"reviewer"`
  when it was unset, so every operator entered the hash chain under one
  indistinguishable identity; it now fails closed with a distinct `misconfigured`
  result before any write, and the console renders a blocking banner instead of
  silently omitting a sentence. `submitReviewDecision` also revalidates `/penize`,
  `/penize/<pspId>` and `/penize/<pspId>/paket` — `packet.ts` compiles only
  `reviewState === "verified"` ties, so a confirmation or reversal that stopped at
  `/penize/kontrola` left the evidence packet asserting a stale set.
  **Reads are indexed since 2026-07-29.** `loadMoneyLayer()` (ledger + console,
  now the console's ONLY read — it no longer repeats the five scans) is
  `react.cache()`-wrapped, uses `KG_READ_CAP` everywhere and no longer reads
  `contract` NODES at all: of the 153 731 `supplies` edges the 33 628 without a
  weight all point at a node with no `amount`, so the 152 788-row scan bought
  nothing. `/penize/[pspId]` goes through `loadMpMoneySlice()` — `kgNeighbours`
  for the MP's own `linked_to` edges, then per tied company for its `supplies`
  with contract nodes attached — and must never scan a whole relation. Both
  paths derive a contract's amount from `supplies.weight` ONLY, so the two
  surfaces cannot report different money. Every `kgNeighbours` result is
  re-sorted with `byListOrder` before it is read (`memory/kgneighbours-weight-
  order-is-not-total.md`): the ordering is not total, and the CZK sum's
  floating-point result depends on it.
  **"Dosažitelné veřejné peníze" has ONE definition since 2026-07-29** —
  `reachableMoney()` in `features/money/reachableMoney.ts`, used by the ledger,
  the console and the case file alike. A COMPANY counts once (14 are tied to
  more than one MP); the steward/attributable split is not a per-surface option
  (steward money is ~91 % of the raw total and is the institution's, never the
  MP's); a company whose ties disagree about the class counts as attributable if
  any tie is owner-operator/manager (order-independent, unlike the rule it
  replaced); a capped corpus yields a FLOOR rendered "nejméně". `MoneyStats`'s
  `contractCzk*` / `contractCoverage` fields are named VIEWS onto it kept for
  /dashboard — never recompute either anywhere.
  **The ledger obeys that doctrine since 2026-08-04.** `reachableMoney.ts` now also
  exports the two things every surface was re-deriving: `isAttributable(tieClass)`
  (the class predicate, previously written out three times — here,
  `features/dashboard/stateSlice.ts`, `features/denik/getDenikData.ts`) and
  `tieReach(tie)` / `bucketReachCzk(bucket)` (ONE reach arithmetic: contracts +
  subsidies, per company de-duplicated). Four surfaces had grown their own sum —
  the ledger's „dosah" cell AND its sort comparator, `MoneyGraph`'s money node,
  the case file's per-tie panel. **The featured „nejsilnější spis" is now selected
  by ATTRIBUTABLE reach only** (`MoneyMp.attributableReachCzk`, ties broken by
  pspId asc), and the caption prints the rule and the value it ranked on
  (`money.real.graphSelection`). Measured on the live store: the lead is Petr
  Hladík (6881) at **23,65 mld. Kč attributable** — but the picture beside his name
  drew Dopravní podnik města Brna (90,0 mld.), SAKO Brno (25,9 mld.) and ARENA BRNO
  (20,1 mld.) in the SIGNAL colour; his steward total is **139,1 mld. Kč**, ~5,9× his
  attributable one. Steward money now renders in steel with `peníze instituce` on
  the ledger row, the money node and the case file alike, and an MP whose whole file
  is steward seats is never featured at all. `MoneyMp.totalContractCzk` /
  `totalSubsidiesCzk` — the class-MIXING pair that used to BE the ranking key —
  are deleted from the type. The owner-operator tile no longer cites bare ARES for
  a partly-guessed count: it prints `ownerOperatorMpsStoredClass` beside it
  (live: **18 of 18** rest on a recorded `tie_class`, 0 on `classifyTie`'s guess).
  **Review truth propagates (2026-08-04).** Two sentences on /penize were LITERALS
  asserting that every tie was still pending — the lede banner and the graph
  footer badge. They were true only while the console could not write; since it
  can (e8bf6c8), the first confirmation makes both false, on the page whose whole
  promise is that a claim never outruns its data. `features/money/reviewSummary.ts`
  is a pure four-state derivation (`all-pending` · `mixed` · `all-decided` ·
  `empty`) over `verifiedTies` / `pendingTies` / **`rejectedTies`** (new — a
  rejection is DECIDED, not pending) — counts that were already computed and
  rendered nowhere. Both surfaces read the same object, and the banner cites it.
  Its population is deliberately NOT `totalTies` (every edge read, including ones
  dropped for an unresolved endpoint). One test per state. Also: a review decision
  now revalidates **`/dukazy`**, the public bulletin of gate decisions, which reads
  the very `review_audit` table the action appends to; the „nejméně" floor prefix
  finally renders the explainer that says WHY (`reachableSubCapped`, dead in both
  catalogs until now — live `isFloor` is currently **false**, the corpus is not
  capped); the mock graph footer no longer certifies its own invented edges
  („● všechny hrany datované + doložené", in the CONFIRMED colour); and the copy
  says **10. období**, the term `moneyLoader`'s `TERM = "PSP10"` actually reads.
  `features/money/messages.test.ts` pins all of it (cs/en key parity, ICU parity,
  no `9. období`, a sentence per phase). **`app/robots.ts` now exists** — the repo
  had none, so `/penize/kontrola` (the internal review queue, PUBLICLY LINKED from
  the /penize header, showing analyst prose about named people) was crawlable; it,
  `/rentgen` and `/admin` are disallowed, everything else allowed. The console page
  also declares `robots: { index: false }`. Neither is access control — that is
  still `REVIEWER_TOKEN`.
  **Every tie is citable (2026-08-04).** `features/money/**` contained ZERO
  claim-ref calls, so /penize published 211 money claims about named people and
  not one had a permanent address — /overeni, the citation verifier, had nothing
  on this surface to verify. `MoneyTie.receiptRef` is now minted ONCE in
  `mapLinkedToTie()` with the shared `edgeClaimRef()` from the edge's OWN
  endpoints (never a reconstructed `psp:person:<pspId>` string, which would look
  right and resolve to `gone`), and both the ledger row and the case-file tie
  section link `/zdroj/<ref>` through `claimRefPath()`. There is exactly ONE ref
  builder in the repo and no surface forks it. A receipt cites a CLAIM, not a
  verdict, so the link states the gate state beside it. Verified against the live
  store: 5/5 sampled refs resolve `ok` with `gate=pending_review`, e.g.
  `psp:person:6881 --linked_to--> company:ico:46347534`; the fixture suite now
  pins decode + resolution + gate agreement for every tie. One-hop links added:
  /penize → `/penize/strety` + `/dukazy`, the case file → `/dukazy` (its `/paket`
  link was already there).
  **The NUMBER is citable too (2026-08-04).** A tie had a permanent address since
  the receipt work; the amount beside it had none — so a journalist could cite „the
  tie exists" and not „firma X dostala 23,7 mld. Kč", which is what actually gets
  quoted. The ledger's „dosah" cell, the case file's two split tiles and the company
  file's headline now render through `CitableNumber` with a `data-claim-*` payload
  minted in ONE place, `features/money/moneyClaims.ts` (pure — the surface that
  ISSUES a figure and the gate that RE-DERIVES it must compose the identical ref).
  The ref grammar is not new: `claim:<dataset>:<metric>:<subject>` where the subject
  is the entity's own address — a tie's `receiptRef` (`h.<src>.<rel>.<dst>`, decoded
  by `decodeClaimRef`) or a node id (`psp:person:6881` / `company:ico:46347534`,
  decoded by `pspIdFromEntityId` / `icoFromEntityId`, which moved into
  `caseFileLink.ts` so ONE module owns what our ids look like). Four metrics:
  `dosah-vazby` · `smlouvy-firem-poslance` · `smlouvy-instituci-poslance` ·
  `dosah-firmy` — the two sides of the attribution split are DIFFERENT metrics
  because they are different statements. Values come from `tieReach` /
  `bucketReachCzk` and nowhere else; the claim's gate state is the tie's own
  (`rejected` joined `ClaimReviewStatus` — a rejected tie stays in the graph and a
  figure resting on one may not read as merely unchecked), and an AGGREGATE is
  `verified` only when every tie under it is. `compactCzk` moved to `lib/format.ts`
  as the `czkCompact` citable kind (re-exported under its old name). **`TIE_WIRE` is
  unchanged and that is the finding**: every input the claim needs was already
  `public`, so /penize ships **zero new wire bytes** — measured 107 724 B raw /
  17 312 B gzipped, byte-identical to before. The cost is HTML: **+11 914 B raw /
  +941 B gzipped** for the 25 rows one ledger page draws.
  **The company is addressable (2026-08-04) — `/penize/firma/[ico]`.** A company
  is the graph's JUNCTION node (contract ⋈ subsidy ⋈ donation ⋈ MPs) with a stable
  id, and **14 of them are tied to more than one MP** — a fact the ledger's
  one-row-per-TIE shape and /penize/[pspId]'s one-MP shape could both compute and
  neither could publish. `getCompanyDetail.ts` + `loadCompanyMoneySlice()` read it
  through TWO indexed `kgNeighbours` calls (`kg_edge_dst_idx` for the inbound
  `linked_to`, then the company's `supplies`), never a relation scan; the per-company
  supplies read is now ONE function (`readCompanySupplies`) shared with
  `loadMpMoneySlice`, so the two case files cannot report different money for the
  same firm. The `[ico]` segment is normalized to the canonical 8-digit form BEFORE
  lookup (`features/money/companyId.ts`, pure + tested) — `/penize/firma/2867681`
  resolves `company:ico:02867681`, the exact node that unpadded ids once duplicated
  (memory/ico-node-id-canonical-form.md). Ties are `MoneyTie` + who the MP is
  (`CompanyTie`), filled by the SAME `mapLinkedToTie`, ordered by `reviewRank` —
  **never by money: this page is not a ranking and no index page sits above it.**
  The steward/attributable verdict comes from `reachableMoney`/`isAttributable`, an
  impossible `signedOn` loses its date and is disclosed (rows kept, never repaired),
  and every undecided tie says `čeká na kontrolu`. Live renders: Plzeňské městské
  dopravní podniky (3 MPs, steward, 13,41 mld. Kč, 1 296 contracts), AGROFERT
  (2 MPs — Babiš `manager`, Faltýnek `steward` — attributable 8,71 mil. Kč).
  Ledger company cells and case-file tie headings link into it.
  **The public wire carries what renders (2026-08-04).** `getMoneyData()` handed the
  ledger 211 ties × **38 fields**; `TiesLedger` renders **15**. The other 23 crossed
  the network every request — analyst prose (`reviewerNote`, 211/211), the
  corroboration capsule + its source URL, the review trail, the signal/tier internals.
  `features/money/publicWire.ts` is the projection, applied in `app/penize/page.tsx`
  BETWEEN the loader and the client: `TIE_WIRE` classifies every `MoneyTie` field
  `public`/`internal` under `satisfies Record<keyof MoneyTie, …>`, so a field added to
  `MoneyTie` **fails to compile until someone classifies it**, and `PublicMoneyTie` is
  `Pick`ed from that table (a missing `public` field is a type error; the colocated
  test holds `toPublicTie` to `PUBLIC_TIE_KEYS`). There is **no second mapper** — the
  case file and the console keep the FULL `MoneyTie`, because the person deciding a
  tie must never see less than the public does. `mpsWithoutTies` ships the 36 chips
  that render plus the TRUE count (144), not 144 stubs. Measured on the live store:
  **/penize props 337 330 → 107 724 B raw (−68 %), 40 815 → 17 312 B gzipped (−58 %)**,
  with `stats` and `graph` byte-identical.
  **The supplies fold is memoized across requests.** `listKgEdges({rel:"supplies"})`
  is ~153 731 rows folded into a ~196-entry per-company aggregate that changes only on
  `da:kg-compute`, and `react.cache()` is scoped to ONE request — so every /penize and
  /penize/kontrola request re-read the whole relation. It now expires on the SAME bound
  /dashboard declares (`MONEY_MEMO_TTL_MS`, imported, never re-declared: two memos over
  one graph layer on two clocks is how two surfaces print two vintages of one number),
  and neither an empty read nor a failure is memoized. Measured: **`getMoneyData()`
  cold 5 965 ms → warm 206 / 240 ms** (it was 5 572 ms warm before). The page PRINTS
  the bound (`money.real.freshness`), because memoization — not `revalidate` — is what
  actually bounds staleness here.
  **The mock is code-split.** `lib/civic/data.ts` was imported at module scope by
  `FollowTheMoneyPage`, `TiesLedger` and `MoneyGraph` for the fallback alone.
  `MockLedger` / `MockMoneyGraph` / `MockStatTiles` are now their own modules loaded via
  `next/dynamic` (no `ssr:false` — the fallback still server-renders), and the real and
  sample tiles share ONE `components/StatTiles.tsx` rather than two copies of the grid.
  The /penize page chunk drops **40 336 → 38 367 B** and the three mock chunks
  (1 224 + 3 794 + 3 415 B) leave the parse path. **Honest limit: the shared
  `lib/civic/data` chunk (15 269 B) stays eager anyway** — `features/shell/
  sidebarParts.tsx` imports `MODULES` on every route, so no /penize change can evict
  it. Fallback verified against the production build with `PGLITE_PATH` pointed at a
  nonexistent dir: /penize renders the labelled mock, `/penize/firma/<ico>` renders its
  honest empty state at HTTP 200, `/penize/firma/abc` 404s.
  **Střety stop reading 410 000 rows to print zeros (2026-08-11).** The join
  gate (`tieEntersJoin`, imported — never a second copy) is computed BEFORE the
  ledger read: with all 211 ties `pending_review` it is empty by construction,
  so the vote+legislative layers are not read at all and their coverage is
  `null`, never 0 — „nečteno" is a different claim than a zero, and the page has
  three sentences for three zeros (gate shut · schuze.zip missing · a real
  empty result). The non-empty path rides votetrack's `readLedger()` (floors
  included); the whole derivation memoizes on `MONEY_MEMO_TTL_MS` (null never
  memoized; an EMPTY candidates result IS — it derives from real reads, stated
  in the module header as a deliberate difference from ledgerMemo/chamberMemo).
  Measured: cold 15 800 → 3 761 ms, repeat 10 409 → 0 ms. Candidate rows carry
  `/zdroj/<ref>` (tieRef grew `rel` so `edgeClaimRef` composes the ONE grammar)
  + `/penize/firma/<ičo>`; route declares `revalidate = 86_400`.
  **The kauza can be read and cited (2026-08-11).** /penize/kauzy renders its
  hardest evidence for the first time: `registryFindings` as the labelled
  key/value pairs its own doc comment always promised, `proposedAnnotation` as
  labelled fields (never `JSON.stringify` at a reader, depth-capped and
  disclosed past the cap). Machine enums go through
  `features/money/dossierVocabulary.ts` (the tieFlags contract: closed cs/en
  vocabulary, unmapped renders VERBATIM + labelled); the English analyst prose
  is DATA — disclosed as verbatim working material, never rewritten — and the
  dossier's gate state renders through the shared `gateVocabulary`
  (`LEAD_DOSSIER_GATE_TOKEN` is the one place „a hand lead never auto-verifies"
  is a token). Each kauza anchors `#kauza-<leadId>` + `CopyLinkButton`, the
  company links its case file via `canonicalIco` (also fixed in
  `getLeadPacketTargets` — a 7-digit dossier IČO was a SILENT false negative),
  and the /penize teaser derives its dossier count from the discovered list
  (was a bilingual „Dva ručně dořešené spisy" literal). Payload read memoized
  on `MONEY_MEMO_TTL_MS` (18 files / 490 471 B parsed per request before);
  `isDossier` tightened 5 → 13 checks and finally tested. Found in the corpus:
  `mediaContext` has TWO live shapes (objects and bare strings) — the bare-
  string kauza rendered four empty rows with hrefless anchors; both branches
  render now.
  **Console + case-file honesty set (2026-08-11).** The review console — the
  most leveraged user in the product, 211 pending decisions gating strety,
  packets and /dukazy — finally links the fabric it decides on: each card
  carries `/penize/<pspId>`, `/penize/firma/<ičo>` and `/zdroj/<receiptRef>`,
  the header links /penize + /dukazy. The dead staleness prompt (0/211 by its
  own comment) is deleted; the note field states BOTH real rules (needs-more
  without a note no-ops; reversal requires one); `nearThreshold` renders (94 of
  211 — a pattern, the copy says, not a finding). And `contractCoverage`'s cap
  heuristic is CORPUS-ONLY now: a per-MP slice passes `readScope` derived from
  its own read (`readCompanySupplies` reports truncation by the
  `warnIfTruncated` shape), so a complete slice makes NO floor claim and a
  truncated one is a floor with `perCompanyCap: null` and its own sentence —
  three small firms `[3,3,3]` used to fabricate „nejméně" plus a cap that does
  not exist (Decroix sits at `[3,3,0]` today). Corpus path byte-identical,
  verified to the cent on Hladík and Babiš.
  **The company file shows its corporate surroundings (2026-08-12).** The
  graph has carried a dated ownership layer since pass 28 — 33 `owns_stake`
  edges + 19 parent nodes (Město Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo
  financí, the AGROFERT ancestors), every stake a dated sole-shareholder
  registration from dataor.justice.cz — and NO surface rendered it.
  `features/money/ownership.ts` (pure + tested) holds six rules: ONE hop,
  both directions (chain-walking is exposure inference and is computed
  nowhere — the `genuinelyNew: 0` doctrine); a CLOSED period reads as
  history, never current ownership; counterparts link only through
  `canonicalIco` (a non-canonical id gets no link); the two NENALEZENO
  AGROFERT ancestors render their STORED annotations verbatim + dated
  (extinct by merger into the named successor, incl. the name-collision
  warning — never presented as registry-verified subjects, and the Czech
  analyst prose deliberately does NOT pass the language gate: it is graph
  DATA); a company with no `owns_stake` edge gets NO block (absent ≠ empty —
  166 of 195 tied companies); a row whose counterpart the graph did not
  return drops and is COUNTED. One indexed `kgNeighbours` per company
  (4–34 ms, `KG_READ_CAP` + `byListOrder` — every owns_stake weight is
  null), the payload rides `CompanyCaseFileData` so `TIE_WIRE` and /penize's
  public wire stay byte-identical, and the block's pass renders only when
  ALL rows agree on one. `graph-schema.md` finally gained the `owns_stake`
  row per its own sync rule. Related fix: the /admin T4 tripwire now reads
  `share` — the prop the writer actually emits — so „drží 100 %" renders
  instead of the eternal degraded fallback.
- `/zebricek` — **CivicScore** (features/civicscore): leaderboard — score
  histogram + chamber summary, party filter + name search, mini
  weighted-breakdown bars per row, and Souboj (pick two via "vs" → mirrored
  comparison). **Wired 2026-07-24 to the real graph** (`getLeaderboardData.ts`):
  all **207 real MPs** ranked by `contribution_score`, broken down into the
  index's **6 exposed components** (participation/committee/legislative/speech/
  attendance/leadership) — not the 4 mock pillars. No fabricated quarterly
  delta/trend (single term). Fallback when the store is unavailable:
  `lib/civic/leaderboard.ts`, a deterministic test-pinned mock generator (still
  feeds `/dashboard` chamber aggregates).
  **Ranking correction 2026-07-29 (graph pass 42)** — the index's committee term
  counted psp.cz membership ROWS, and psp.cz files a body an MP LEADS as two
  rows, so chairing one committee could outrank sitting on two. It now counts
  DISTINCT BODIES (role weighting untouched — `leadership` still pays its full
  10 points). 33 MPs lost points (220,1 index points; saturated set 158 → 131)
  and 184/207 printed ranks moved. Stored rates were republished at 3 decimals
  in the same pass, so the six displayed parts now sit within 0,1 of the
  composite instead of 1,6. Recompute path:
  `scripts/data-analysis/kg-contribution-recompute.ts` — merge-preserving, and
  it refuses to write unless replaying the OLD formula reproduces every stored
  value first. Details in `docs/data-analysis/graph-log.md` (pass 42).
  **The formula changed 2026-07-29; the STORE was only corrected 2026-08-04.**
  The recompute was written, audited (`docs/data-analysis/contribution-pass42-audit.json`,
  207 rows) and never run with `--commit` — so for six days the code counted
  distinct bodies while every person node still carried pass-11 scores written by
  `kg-contribution-ingest.ts`, and `/zebricek` served the PRE-correction ranking
  under a comment claiming otherwise. Caught by rendering `provenancePass` on the
  page, which printed 11. On 2026-08-04 the recompute ran: its replay gate
  reproduced the old formula for 207/207 MPs (proving nothing had touched the
  scores in between), and the re-generated audit is byte-identical to July's on
  all 207 rows — only `computedAt` moved. Every node now carries
  `contribution_provenance = {pass: 42, ref: "contribution-committee-dedupe"}`.
  **The lesson is the check, not the fix: a formula correction is not applied
  until the DATA carries its provenance ref, and nothing in the suite could see
  the difference.**
  **The formula has a name (2026-08-04).** `CONTRIBUTION_FORMULA_REF` in
  `lib/analysis/contribution.ts` is the ONE declaration of the formula's identity,
  and its contract is: a formula-changing edit must change the ref, and the ref is
  not applied until a recompute has re-stamped every person node. Both writers now
  IMPORT it — `kg-contribution-ingest.ts` used to stamp the literal `"contribution"`
  (a ref frozen at pass 11), so a re-run would have downgraded the declared lineage
  below the formula that scored the nodes; zero ref literals remain in `scripts/`.
  The loader aggregates `{pass, ref}` over ALL 207 person nodes
  (`features/civicscore/provenance.ts`, pure + tested) rather than reading the first
  node it iterates: a half-recomputed store is reported as `mixed` with no single
  pass number instead of one confident figure, and the store's ref is compared to the
  code's (`formulaMatch`). `/zebricek`, `/poslanec`, `/kraj` and the poster citation
  each render the mismatch as an honest sentence — „žebříček spočítala starší verze
  metodiky" plus both refs — not an error page. Measured on the live store today:
  uniform, pass 42, `contribution-committee-dedupe`, 207/207, `formulaMatch: true`.
  **The sentinel can see the divergence now (2026-08-04).** `lib/testing/sentinel/`
  read only `contribution_score` and asserted it was finite, while `checkDeterminism`
  compared the store to ITSELF — a stale store is perfectly self-consistent, which is
  why six days of a wrong ranking looked healthy. `facts.ts` now also collects each
  person's `{pass, ref}` and the stored inputs the formula consumes, and four
  invariants judge them: **formula-ref** (every ref === `CONTRIBUTION_FORMULA_REF`),
  **provenance-uniformity** (the chamber agrees on one `{pass, ref}` — a half-applied
  recompute publishes one ranking from two formulas), **components-sum** (the six
  components reconcile with the composite) and **recompute-sample** (the REAL
  `computeContribution` re-run over 40 MPs' stored inputs, deterministic stride over
  id asc — no clock, no RNG). Tolerance is ±0,1 and it is not slack: the composite was
  scored from RAW ratios while the store publishes them at 3 decimals, measured at
  exactly 0,1 on 13/207 today and 0 above; a pass-11-era store (rates at 1 decimal)
  blows straight through it. `sentinel.test.ts` reconstructs that pass-11 store and
  proves formula-ref AND recompute-sample fire on it. Live run 2026-08-04: **all 11
  invariants PASS**. The sentinel stays strictly read-only (SELECT only, over a copy).
  **`npm run sentinel` is the only path on which these actually execute** —
  `.github/workflows/sentinel.yml` has no `./.pglite` on a hosted runner and its guard
  makes the nightly a deliberate no-op; a green nightly is not coverage.
  **A writer cannot regress a correction (2026-08-04).** `kg-contribution-ingest.ts`
  re-derives scores from live psp.cz dumps; run over a store the recompute has
  corrected it would have replaced that correction with fresh numbers under a commit
  whose stated subject is an ingest. `--commit` now REFUSES over any node whose stored
  `contribution_provenance.ref` differs from the ref it stamps
  (`guardContributionWrite`, pure + tested); the refusal names both refs and points at
  the recompute, `--supersede` is the explicit human override, dry-run is never blocked
  and always prints the verdict. The rule is **equality, not lineage ordering** — both
  writers stamp `CONTRIBUTION_FORMULA_REF`, so a differing ref means a formula this
  build does not implement, in either direction; `pass` cannot rank them (any unrelated
  enrichment advances it). The recompute needs no such guard — its replay gate is
  strictly stronger. The ingest also states on every commit that it does NOT touch
  `contribution_psp9`; the recompute owns that baseline. The recompute's `legacyScore`
  moved to `lib/analysis/contribution-legacy.ts`, labelled FROZEN with its own tests:
  its `/4` and `/40` are deliberately literals, never the live saturation constants,
  because a proof gate that follows the formula it is proving proves nothing.
  Found while verifying the guard: `kg-contribution-ingest.ts` could not run at all on
  the live graph — `Math.max(0, ...nodes.map(…))` spread ~153 700 arguments and threw
  `Maximum call stack size exceeded` before reading a score. Now a `reduce`.
  **The score is citable (2026-08-04).** `features/civicscore/**` held ZERO claim
  refs — the platform's flagship number was the one number nobody could cite, while
  being the best-provenanced thing in the store (207/207 nodes carry
  `contribution_provenance`, the code declares `CONTRIBUTION_FORMULA_REF`, /metodika
  prints the formula). `scoreClaim.ts` (pure) mints ONE claim on the COMPOSITE —
  `claim:psp.cz — příspěvkový index:prispevkovy-index:psp:person:<pspId>` — rendered
  on every /zebricek row and on the /poslanec header, and re-derived at /overeni
  through `getLeaderboardData()`, the loader that owns it. Four decisions worth
  keeping: (1) the six components are NOT minted — six more addresses would dilute
  the one people actually quote; (2) the pass and formula ref ride INSIDE the claim
  as `derivation` (`contribution-committee-dedupe@42`) taken from the CHAMBER-WIDE
  aggregate, so a `mixed` or `absent` store mints NO basis rather than picking one —
  and a pasted claim whose basis differs from today's answers **`moved`, naming both
  passes**, even when the number is identical (this is the pass-42 case at the
  citation layer); (3) the index is `ungated`, a new `ClaimReviewStatus` — it is a
  deterministic recomputation and „čeká na kontrolu" would promise a review nobody
  is preparing; (4) the LENS score is deliberately not minted: under a reader's own
  weights the number stands nowhere in the graph. `AnimatedScore` grew an optional
  `claim` (attributes carry the TARGET value, never an animation frame).
  Verified on the live store: Karel Haas (6751) verifies at **96,8** from a bare ref
  and a pasted element; −0,7 answers `moved/value`; the same 96,8 stamped
  `contribution@11` answers `moved/basis`; an MP outside the chamber answers
  `zaznam-nenalezen`. Measured cost: **zero new wire fields** (the claim is built
  client-side from `pspId` + `score` + the provenance aggregate, all already on the
  wire); the HTML attributes over all 207 rows are **81 710 B raw / 2 534 B
  gzipped**, and warm `buildLeaderboard()` is unchanged (194 ms).
  **Ties are ties (2026-07-29)** — ranks are now COMPETITION ranks (1, 2, 2, 4):
  a rank is one more than the number of MPs who score higher, so it is shared on
  an identical score and the red top-3 can no longer be won by Czech name
  collation (Vesecká and Malá, both 95,4, printed ranks 2 and 3). 55 of 207 MPs
  share a rank across 25 groups; the display order inside a tie is still the
  name collation and the page states that it means nothing. `LeaderboardEntry`
  carries `tiedCount` so a surface can SAY a rank is shared without reordering
  anything. The duel no longer crowns a winner on a zero difference or colours
  one where both sides print the same number (`features/civicscore/duel.ts`,
  pure + tested); histogram bands are labelled with the bound they actually run
  to (`65–70`, half-open) and the band CONTAINING the median is coloured
  separately from the bands below it; `σ` is named a standard deviation.
  **The read path is capped and indexed (2026-08-04).** `buildLeaderboard()` no
  longer carries ad-hoc numeric limits — every read uses `KG_READ_CAP`, like
  /penize and /poslanec. This is not tidiness: a SMALL limit makes PGlite walk
  the `kg_node` primary key and filter by kind instead of using
  `kg_node_kind_idx`, so it scans the whole ~154 k-row table until it has
  collected N matches. Measured on the live store (3 rounds):
  `listKgNodes({kind:"party", limit:30})` cost **498/632/723 ms** for 8 rows and
  **2,4/2,9/41,7 ms** at the cap. `storeReady()` had the same shape — it probed
  `listKgNodes({kind, limit: floor})`, which cost 419–692 ms for `person` and
  tripped the truncation guard on every healthy call (a probe that reads exactly
  its own limit is precisely what that guard cannot tell from a truncated read);
  it now asks `kgKindCounts()` (one indexed group-by, 237–380 ms, answering every
  kind at once) and keeps the old probe only as a fallback for hand-built test
  stores. Net: **warm `buildLeaderboard()` 1 113–1 312 ms → 444–522 ms**, with the
  list payload byte-identical (81 179 B for all 207 MPs).
  `listOrgans`/`listPersons`/`listMandates`/`listMemberships` in
  `lib/db/pglite/repositories/graph.ts` now carry the same `warnIfTruncated`
  guard the kg listers do (it moved to `lib/db/pglite/internals.ts` so both
  sides share ONE definition) — the organ read was sitting 210 rows from a
  silent cliff at 1 790/2 000.
  `trend` and `effortPublicRole` left `LeaderboardEntry` for `ProfileOnlyFields`
  / `toProfileEntry()`: the chamber pass computed them 207× per request (29 ms
  measured) for the one profile page that reads them, and the full payload
  dropped 296 473 → 121 144 B.
  Name search folds diacritics through `asciiFold()` — the SAME function that
  fills `person.name_norm` at ingest — so „zacek" finds *Žáček*
  (`features/civicscore/search.ts`, pure + tested).
  **Three false claims retired (2026-08-04).** The page said *"Všech 207 poslanců
  9. období"* while the loader reads `termCode: "PSP10"` — the TENTH term; it now
  says so, consistently with `/kraj` and `TrendPanel`. It cited *"metodika v1.4"*,
  which is the source string of the **deleted** mock 4-pillar dataset
  (`lib/civic/data.ts`) — the real six-component index carries no version number
  at all, so the claim is gone and what the data DOES carry is rendered instead:
  `provenancePass` (`contribution_provenance.pass`, **11** on the live graph), the
  computation that authored the scores. And the dossier note said *"dosud
  probíhá"* regardless of count while coverage closed at **207/207** (batches
  006/007) — it now states completion, and the dossier FILTER + per-row icon
  render only while coverage is PARTIAL (a filter that selects every row and an
  icon on every row distinguish nothing; both stay live if the chamber grows).
  `features/civicscore/messages.test.ts` pins all of it: cs/en key parity, ICU
  placeholder parity, no `9. období`, no `v1.\d`. The five dead `civicscore.*`
  keys with zero call sites (`distributionSource`, `allSource`, `mockNote`,
  `componentLegendNote`, `legendWidthNote`) are deleted from both catalogs.
  **The low-score correction reaches the ranking.** `effort_low_score_reason`
  (closed vocabulary, `lib/analysis/low-score-reason.ts`) exists on **34 of 207**
  person nodes and used to render only on `/poslanec` — so `/zebricek` printed the
  chamber's lowest number beside an MP who relinquished the mandate before the
  oath, with nothing next to it. `LowScoreReasonChip` puts it on the row in BOTH
  densities, verbatim from the vocabulary (the app never rewrites it into an
  excuse — `genuine_absentee`'s own copy says it is NOT a correction) and DATED
  with `effort_provenance.computedAt`. The copy is pinned to the Czech language
  gate by `lib/analysis/low-score-reason.test.ts`. Measured payload cost of the
  two new list fields over 207 rows: 81 179 → 95 653 B raw, 7 450 → 7 909 B
  gzipped.
  **The Souboj compares facts, not only points (2026-08-04).** It used to compare
  the composite plus the six weighted component point-values — the most abstract
  numbers the app owns — because nothing else ever entered the /zebricek payload.
  It now also compares, per fighter: **tenure class** (`effort_tenure_class`,
  193 full_term / 7 replacement / 4 never_seated / 3 departed — printed ABOVE the
  numbers because it is their precondition; a `never_seated` MP has an empty
  record, not a low score), **floor speeches**, **written amendments**,
  **interpellations** and **rapporteur load**, plus the workhorse / rapporteur /
  low-score verdict copy reused VERBATIM from `lib/analysis/*` (no second copy
  engine). Every fact reports in its OWN unit against the REAL chamber median —
  `score-legibility.ts`'s convention, and literally its `median()` — computed
  over the MPs that have a value, with that count printed. A fact missing for one
  fighter renders `údaj chybí` and NOTHING is won against it (`factWinner`);
  `num()`'s zero never stands in for an un-ingested prop. **Money is deliberately
  not compared and the duel says so**: all 211 ties are `pending_review`, and
  setting them against each other would turn an unconfirmed trail into a finding.
  Rules are pure + tested (`features/civicscore/duelFacts.ts` + `.test.ts`);
  `tenureClassLabel()` joined `lib/analysis/tenure-copy.ts` (all four classes,
  language-gate pinned). Measured: list payload 95 653 → 120 264 B raw,
  7 909 → 9 137 B gzipped; warm `buildLeaderboard()` unchanged at 424–519 ms; no
  new store reads.
  **Every verdict carries its date and its number (2026-08-04).** `WorkhorseBadge`
  and `RapporteurBadge` asserted „tichý tvůrce zákonů" / „zpravodajský tahoun" with
  no vintage and (on /zebricek) no count, while `LowScoreReasonChip` beside them held
  the standard. Both are now DATED from `effort_provenance.computedAt` — the same
  prop, written by the same pass, on the same node — and both carry the figure the
  verdict rests on: the workhorse badge prints `speech_turns` (the low floor
  visibility that is half its claim; ABSENT renders nothing, never a fabricated 0),
  the rapporteur badge prints its distinct-bill count in BOTH densities, so a
  zpravodaj of 3 and of 13 no longer look identical. Both surfaces (/zebricek row,
  /kraj row, Souboj, /poslanec dossier). `LeaderboardEntry.effortLowScoreRecordedAt`
  was renamed **`effortRecordedAt`** — it was always the whole effort-provenance date,
  and the low-score-specific name is exactly why the two badges went undated for
  months. MEASURED cost: **zero new payload fields** (the badges read
  `duelFacts.speechTurns` and `effortRapporteurLoad`, already on the wire); the rename
  alone shrank the list payload 118 748 → **117 092 B** raw, 9 624 → **9 590 B**
  gzipped.
  **The six components are ONE definition** — `features/civicscore/componentDefs.ts`.
  Reader-facing Czech labels plus a per-row psp.cz citation cannot live behind
  `server-only`: they were retyped as literals in FOUR test fixtures (kraj, lens,
  referendum embed, referendum ogPayload) and their ORDER a fifth time in `lens.ts`
  (`LENS_COMPONENT_ORDER`, with a comment saying the real list could not be imported).
  Now every one imports it, and `componentDefs.test.ts` pins the weights to
  `CONTRIBUTION_WEIGHTS` (never mirrored), the sum to 100, one distinct citation per
  component, and every label + source to the Czech language gate.
  **Two more reader-facing copy sets joined the gate**: `mandateNoteCopy` (all three
  branches — only `tenureClassLabel` had been pinned) and the whole TrendPanel, whose
  four Czech sentences were inline JSX literals owned by no engine. They moved to
  `features/civicscore/trendCopy.ts` (pure + `trendCopy.test.ts`), and the „chybějící
  složky" note now NAMES what `trend.pendingComponents` actually carries instead of
  asserting „účast a docházka" regardless, and cites the `hl-2021ps.zip` dump only for
  the term it belongs to.
  **The printed sheet carries the same truth (2026-08-11).** `/kraj/[kraj]` —
  the PRINTABLE slate — had dropped the honesty apparatus /zebricek carries;
  the data was already on every entry. Now: `LowScoreReasonChip` on slate rows
  (34/207 carry a reason; a relinquished mandate no longer prints a bare bottom
  score on paper), `mixed`/`absent` provenance sentences on the page (same
  keys, same aggregate — no second copy), and the citation footer suppresses
  the pass number STRUCTURALLY for a non-uniform chamber
  (`posterProvenanceNote()` in `features/shared/poster/citation.ts`, pure +
  pinned incl. omitted-state byte-identity) — it used to print nothing, which
  is indistinguishable from „carries no pass". The kraj score renders through
  `CitableNumber` with the SAME `contributionScoreClaim` (imported, withheld
  under a custom lens with the reason in the footnote); `RapporteurBadge`
  joins compact + dated.
  **The lens survives the drag and reaches the preview (2026-08-11).**
  /zebricek's `generateMetadata` decodes `?vahy=` (referendum's own codec,
  imported) and points OG at the EXISTING `/referendum/og` — an invalid vector
  passes through raw so the generator emits its own „Neplatné váhy" card,
  never a silently repaired one. The URL write moved from per-slider-step
  (35–100 `replaceState`/drag; WebKit hard-fails >100/30 s and the reader
  would share a lens-less link with no signal) to commit time:
  `lensAddress()` is the ONE pure address composer (`useLensWeights.test.ts`),
  `commit()` fires on pointerup/keyup/blur, presets stay one-click-one-write,
  and `shareHref()` composes AND writes so the copied link and the address bar
  cannot disagree mid-drag. /referendum finally links /metodika.
  **The board stops asserting what the data don't carry (2026-08-12).**
  `factsNoMoney` states the RULE (money is out of the duel by design; an
  unconfirmed trail is not a finding) instead of „všech 211 vazeb čeká" — a
  literal the first console decision falsifies; zero literal MP counts remain
  in rendered civicscore copy (ICU params fed from `summary.count` /
  `entries.length`; `allTitle` deliberately param-free — the nav rail feeds it
  with no ICU params); club names stop truncating („TOP 09" no longer renders
  „TOP") and the real path stops reading mock PARTIES: **`CLUB_DISPLAY`** in
  `lib/civic/data.ts` (under the „KONEC UKÁZKOVÉHO KATALOGU" line) is the
  declared NON-mock table of real registry clubs — display forms kept
  deliberately (editorial typography over the registry abbrev, a Director
  ruling recorded in 83cb8a9), colours live in that file because the lint rule
  sanctions it as the home for data-driven colours. `messages.test.ts` bans
  literal 207/211 and the absolute-gate-claim shape with NO allowlist;
  `clubDisplay.test.ts` pins colour identity with the old table. votetrack's
  `clubStyle.ts` reads the same table (the hemicycle wedges and discipline
  board carried the identical truncation).
  **The ranking reads as a table (2026-08-12).** role table/row/columnheader/
  cell + a real header row over the 207 rows; the filter/search count and the
  empty state announce (`role="status"`); compact mode keeps club/region
  findable in the DOM (`sr-only`, never removal — pinned against regression);
  every „vs" button names its MP; the Souboj is a labelled region with ONE
  `DuelStatus` live region sitting OUTSIDE the AnimatePresence remount, and
  both mirrored value grids carry sr-only subjects. No jsdom exists here, so
  `a11y.test.ts` pins the wiring by source-grep — an honest gap, stated.
  **The Souboj has an address (2026-08-12).** `?souboj=<a>-<b>` —
  `duelParam.ts` holds the lens codec's exact contract (order-normalized so
  A-vs-B ≡ B-vs-A, default pair → null so the clean address IS canonical,
  malformed → null never repaired, `?vahy=`/foreign params/hash preserved by
  the ONE `duelAddress` composer); `useDuelSelection` reads on mount +
  popstate (never useSearchParams), writes `replaceState`, and scrubs a pspId
  today's chamber doesn't carry — but ONLY when the chamber is known: an
  unreachable store is not evidence an MP doesn't exist. The address is
  COMPUTED at render (a stored one would desync whenever the lens writes
  `?vahy=`); the copy affordance is the shared `CopyLinkButton`; selection
  feedback is the DuelStatus line + a `#souboj` anchor link — never a forced
  scroll (test bans `scrollIntoView`).
- `/metodika` — **Metodika** (features/civicscore/MetodikaPage.tsx, thin route
  `app/metodika/page.tsx`). Added 2026-08-04. The platform positions itself as
  methodology-transparent, `/zebricek` cites „průchod grafu č. 42" and
  `/referendum` invites citizens to RE-WEIGH the index — yet no surface showed
  what the formula IS. This one does, and **every figure on it comes from an
  import, never a literal**: the six weights and their per-component psp.cz
  citations from `componentDefs.ts` (i.e. from `CONTRIBUTION_WEIGHTS`), the
  100-point total as a computed sum, the three saturation caps
  (`COMMITTEE_SATURATION` 3 / `LEGISLATIVE_SATURATION` 4 / `SPEECH_SATURATION`
  40), the counted organ types and leadership functions from
  `COMMITTEE_ORGAN_TYPES` / `LEADERSHIP_FUNCTIONS`, and
  `CONTRIBUTION_FORMULA_REF` itself. Changing a weight reflows the page. The
  committee-dedupe rule is described beside the `seatKey()` behaviour it
  documents, including why a row with no organ id is merged with nothing.
  Section 04 prints what the DATA claims about itself — the wave-1 provenance
  aggregate off the same `react.cache()`-wrapped read `/zebricek` performs
  (uniform pass/ref + coverage, `mixed`, `absent`, and the formula-match vs
  mismatch sentence); no store degrades to a labelled note while the formula
  still renders, because the formula is code, not data. **No invented history**:
  the graph carries only the current `{pass, ref}`, so only that is printed.
  Linked from `/zebricek` (under the provenance notes), `/poslanec` (under the
  score pass) and `/kraj`; listed in `navModel` under the leaderboard.
  **The published weight vector has ONE source now** — `PUBLISHED_WEIGHTS_LABEL`
  in `lens.ts`, derived from `CONTRIBUTION_WEIGHTS` in `LENS_COMPONENT_ORDER`.
  „25-20-20-15-10-10" was a LITERAL on four rendered surfaces (`/referendum`'s
  weights citation, `/zebricek`'s source note and lens aside, `WeightPanel`, the
  referendum OG image) **and in both message catalogs** — on the very page that
  invites a reader to change those weights. `messages.test.ts` now fails if
  either catalog hardcodes it again, and `lens.test.ts` pins the label to the
  formula.
- `/rozpocty` — **BudgetMirror** (features/budget): **REAL since the
  2026-07-30 MONITOR moonshot** — 132 towns with wired budget series (FIN
  2-12 M consolidated figures) + the live supplier trail over the money
  graph, town vs computed peer-group mirror, debt-per-capita trends,
  permanent town addresses at `/rozpocty/<ico>`. Stewardship feeds only
  executive roles — stated explicitly on the page.
  **The honest sheet (2026-08-12).** The most-seen number (38,78 mld Kč,
  Praha default) read as payments while being Σ contract VALUE 1995–2026 —
  the card now carries the /penize qualifier („částka = hodnota smlouvy")
  and the year span `supplierTrail` always computed and nobody drew (a row
  with no signing date neither extends nor zeroes the span); „doložené
  platby" columns renamed to what they are (documented DIRECTION, not
  payment). §03 peer table gained its SourceNote; the rail contract was
  repaired three ways (missing `#penize` anchor, §01 label drift, no
  `sectionsFor` case for town pages) with a parity test in the /hlasovani
  pattern; nine mock-era keys asserting „smyšlená čísla, MONITOR nenapojen"
  are deleted from both catalogs and `budget.sourceLine` interpolates the
  generated retrieved-date constants instead of a hand-typed literal
  (`features/budget/messages.test.ts` forbids the tokens). ~360 prerendered
  town pages joined the sitemap through `features/budget/municipalRoutes.ts`
  — ONE list for `generateStaticParams` AND `app/sitemap.ts` (a municipality
  is a public register, not a person, and the register is a static module:
  both sitemap-exclusion reasons lapse — the exception is argued in place).
- `/zakony` — **LawWatch** (features/lawwatch): **wired 2026-07-24 to the real
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
- `/denik` — **Deník republiky** (features/denik): the chronological daily
  record of the state — signed contracts of firms MPs own/run, committee
  assignments, Sbírka publication, registry role starts/ends, human-gate
  decisions and the `change_event` „zaznamenáno" stream. Copy is deliberately
  hardcoded Czech (the /dukazy precedent). `getDenikData.ts` re-uses
  `getMoneyData` / `getLawData` / `listReviewAudit` (batch layers memoized on
  `MONEY_MEMO_TTL_MS`); every layer degrades independently and `coverage` says
  which groups the page can carry. `?entita=<klíč>` is the subscription — the
  same public keys /schranka follows — and `/denik/feed.{xml,json}` serialize
  the same filter.
  **The day is a PRAGUE day since 2026-08-04** (`features/denik/pragueDay.ts`).
  `builtOn` was `new Date().toISOString().slice(0,10)` — UTC — on a ledger whose
  whole subject is Czech days. Between local midnight and 01:00/02:00 the Prague
  day runs one day AHEAD of UTC, so a contract signed „today" in Prague fell past
  `deriveDenik`'s `date <= today` bound and was counted into **`droppedImplausible`
  — the counter with which the page discloses CORRUPT DATES IN THE CORPUS**. A
  server timezone was inflating an honesty counter. Intl is allowed there and
  nowhere near render: the value is computed server-side and crosses to the client
  as data, while `czechWeekday` stays pure arithmetic (ICU version skew would trip
  hydration). DST is read from the zone per instant, never a constant, and the
  day's midnight is resolved two-pass so the spring-forward day gets the offset in
  force AT midnight (`+01:00`), not after it.
  **`date_published` is RFC 3339 since 2026-08-04.** The JSON feed emitted a bare
  `YYYY-MM-DD`, which JSON Feed 1.1 does not permit; the shared
  `parseEvidenceFeedJson` never caught it because it only checks `typeof string`
  (/dukazy passes a full ISO instant). A deník row carries a DAY, not an instant,
  so the stamp is that day's **Prague midnight with its own offset**
  (`2026-08-04T00:00:00+02:00`), and RSS `pubDate` is derived from the same instant
  so the two formats cannot date one row differently. An undatable day emits no
  stamp rather than a guess. Feed order (date descending) is now pinned by test at
  the codec boundary — `DenikTeaser` reads „the latest day" as `items[0]` and
  nothing across the format boundary held that.
  **Every silent loss is now counted and disclosed (2026-08-04).** Four leaks,
  all of them the same failure — a limit that drops a row without a sentence,
  on a page whose `droppedImplausible` counter exists precisely to say the
  opposite. (1) The per-company `kgNeighbours` edge cap was **500 and silent**:
  measured on the live graph, **5 of 35 companies returned exactly 500** and
  **4 872 contracts** — more than the whole ledger carried — never reached the
  page. The cap is now `MAX_CONTRACT_EDGES = 5 000` (live max 2 387; reading all
  57 attributable companies costs **1 468 ms vs 1 009 ms**, once per memo
  window), truncation is detected by the `warnIfTruncated` shape (length ===
  limit) and rendered as a counted note. Live: contract rows **4 380 → 9 252**,
  companies truncated **0**. (2) A contract node reached through two supplier
  companies emitted TWO rows with the same `contract:<id>` — a duplicate React
  key and a duplicate feed guid (**5 such nodes live**). Rows are merged one per
  node: suppliers all named (IČO asc), MP and company entities UNIONed, `pending`
  disjoined, and the **amount kept only when every input agrees** — otherwise no
  amount and a counted conflict, because picking one would be inventing money.
  (3) IČO is validated at the loader with `canonicalIco` (imported, not forked):
  the entity key used to be built from the RAW string while the href used the
  canonical one, and an empty IČO collapsed every IČO-less company into one
  `firma:` key that `/schranka`'s `isEntityKey` then silently refuses. A
  non-canonical IČO now yields NO company entity — the row still renders and the
  count is disclosed (live: **0**). Role ids fall back to the company NAME so two
  IČO-less companies of one MP cannot merge. (4) `change_event` declares 10 types
  and the deník rendered 3, so an emitted `mandate-removed` had no surface at
  all. `DENIK_CHANGE_TYPES` is now the closed union of **9** (all but
  `review-decision`, which the deník reads from `review_audit` itself and counts
  separately), with two new `DenikKind`s — `mandate` and `organRole` — placed in
  `/schranka`'s `KIND_ORDER` and `KIND_NOUNS` in the same order the deník uses.
  The sentences say **„v evidenci"**: a snapshot diff knows the row left the psp.cz
  dump, not why or when. `pending` is a fact about a TIE, so mandate/organ rows
  assert nothing about review. A type this build cannot speak is counted and
  disclosed, never dropped. Change rows also cite the event's own verbatim
  `source` (`kg_edge_history` / `diff snímků ingestů — psp.cz`) instead of the
  table they landed in.
  **Rows cite like /dukazy, and read like a ledger (2026-08-04).** A row named a
  registry in brackets and linked nothing — a citation the reader could not
  follow, next to /dukazy rows that carry real links off the identical IČO.
  Company-keyed rows (contract, registry role, gate decision) now link the SAME
  trio through the SAME `buildRegistryLinks` /dukazy uses, so two ledgers of one
  platform cannot send a reader to two different registries; bill rows link
  psp.cz through `sourceLinksFor` (`lib/kg/sourceLinks.ts`), which is the builder
  that knows what a tisk is — both imported, neither forked, and a company with
  no canonical IČO gets no link rather than an address into nothing. Change rows
  finally carry `change_event.evidence` (the designed evidence pointer, which the
  loader had never mapped) as deterministically sorted key/value pairs. Live:
  **136 of 136 rendered rows carry a link**, none without.
  Reading layer: a day is an `<article>` and its entries a real `<ul>`/`<li>`
  (they were bare `<div>`s, so a screen reader could not tell it was a list or
  how long); `<time dateTime>` on the day masthead and, `sr-only`, on every row;
  the `účinné` / `zaznamenáno` badges carry their explanation AT the badge
  (`title` + `aria-label`, dotted underline as the visible affordance) instead of
  200 px away; and the kind is rendered as a WORD (`features/denik/kindLabels.ts`,
  pure + language-gate pinned) with the tone dot demoted to decoration — it was
  `aria-hidden`, so the deník's own taxonomy did not exist for assistive tech,
  print, or anyone who cannot separate four hues. An unknown kind prints its token
  VERBATIM and labelled untranslated (the `tieFlags.ts` precedent). The vocabulary
  is deliberately NOT /schranka's `KIND_NOUNS`: that one inflects for a COUNT
  („3 smlouvy"), this one names ONE row.
  **The ledger is one hop from its subjects (2026-08-04).** The deník is keyed by
  `poslanec:` / `firma:` / `tisk:`, and the three pages that ARE those entities led
  into it from one: `/poslanec` (wave 1). `/zakony/<číslo>` now links its tisk's
  deník (only when `bill.cislo` exists — a tisk with no number has no key, and the
  filter would select nothing), and both money case files link theirs:
  `/penize/<pspId>` beside the packet/gate links, `/penize/firma/<ičo>` beside the
  follow button that already used the same key. **No fourth copy of the address**:
  the key comes from `deriveDenik`'s own `mpEntityKey`/`companyEntityKey`/
  `billEntityKey` and the address from `followCodec.entityDenikHref` — both
  imported. `ProfilePage`'s inline `/denik?entita=${encodeURIComponent(…)}` literal
  and `CompanyCaseFilePage`'s inline `firma:${ico}` key were the two forks and are
  gone. (`features/dashboard/entityLinks.ts` keeps its own `denikEntityHref` on
  purpose — importing `followCodec` there is not worth the reshuffle, and both are
  pinned by tests.)
- `/data` — **Datové verze** (features/data-releases): the release train of the
  data layer (version, cut date, cardinality gates, integrity, snapshot,
  changelog). **It is also the app's feed address book since 2026-08-04** — four
  feed families (`/denik`, `/dukazy`, `/zakony/kolize`, `/schranka`) share ONE wire
  (RSS 2.0 + JSON Feed 1.1, one validator `parseEvidenceFeedJson`) and no page
  named any of them; the addresses lived in route-handler headers.
  `features/data-releases/feedIndex.ts` is the pure list (what each carries, what
  limits it, `FEED_ENTRIES` imported rather than retyped), plus the three machine
  endpoints that are NOT feeds (`/schranka/novinky.json`, `/data/manifest.json`,
  `/data/snapshot.json`) kept in a separate list so the page cannot claim a format
  that does not hold. The schránka's row states its parameterized nature in full:
  `?e=<klíč>` repeated + `?od=RRRR-MM-DD`, nothing stored server-side, keys scrubbed
  from telemetry — and that the server still sees the IP. Counts are computed from
  the list (`FEED_ADDRESSES`), never written as digits, and the section's index is
  derived from what renders (5 with the store, 1 without — the addresses hold even
  when the graph does not, because a feed then answers 503, not emptiness).
  `feedIndex.test.ts` checks every address against the real `app/` tree and puts the
  prose through the Czech language gate.
  **`app/sitemap.ts` exists (2026-08-04).** `robots.ts` said what NOT to crawl and
  nothing said what to crawl, so the whole evidence half of the platform waited to
  be found by accident. The route list is DERIVED from `navModel`'s own two
  declarations (`NAV` + `UNLISTED_ROUTES`) via `features/shell/publicRoutes.ts` —
  the same decision that puts a page in the rail puts it in the sitemap — minus the
  paths `robots.ts` disallows (`DISALLOWED_PATHS`, now exported and imported, never
  retyped: a sitemap advertising a Disallow-ed path is two files contradicting each
  other) and minus dynamic segments. **23 routes live**, `/penize/kontrola`,
  `/rentgen` and `/admin` excluded. `/poslanec/<id>`, `/zakony/<číslo>`,
  `/penize/firma/<ičo>` and `/zdroj/<ref>` are deliberately absent — enumerating
  them means reading the graph per request — and /data says so out loud. Base URL
  comes from request headers (the four feeds' precedent: honest localhost in dev,
  never an invented domain), hence `force-dynamic`; `lastModified` is omitted
  because no route records one and the build clock is not a content date.
  `publicRoutes.test.ts` scans `app/` and fails on any static public page missing
  from the sitemap.
- `/schranka` — **Občanská schránka** (features/schranka): a follow list with no
  account — the whole state is one localStorage record (`politicas:schranka:v1`,
  `followCodec.ts`) keyed by the SAME public entity keys `/denik` addresses with
  `?entita=` (`poslanec:<pspId>` · `tisk:<č>` · `firma:<ičo>` · `obec:<ičo>`).
  Deltas derive server-side at `/schranka/novinky.json` (`force-dynamic`) over
  the memoized deník + dukazy loaders; nothing is stored server-side and no
  identity is sent — only the key list and a day threshold.
  **Two visit rules, deliberately different (2026-08-04).** The PAGE is lenient:
  entries are dated by DAY, so the threshold is the day of the last visit and
  that day counts whole (rather show a row twice than withhold it). The BADGE
  cannot be — under that rule it would never go dark until midnight — so it
  subtracts a **seen watermark**: on each visit the page records how many
  entries of that day it actually showed (`SchrankaState.seen`), and the badge
  deducts it while the day matches (`visitWindow.ts`, pure + tested; the page
  states both rules). The visit is stamped through a one-shot guard BEFORE
  `setState` — stamping inside the updater collapsed the window under
  StrictMode's double invoke — and the day enters every derivation through
  `useToday()` (a subscription, not a render-time `new Date()`, which the effect
  deps never saw across midnight). `parseNovinkyResponse` validates entries
  field by field; a malformed row is dropped, COUNTED and disclosed.
  **Follow lives where the entities live.** `FollowButton` (one component,
  reused — compact and icon-only densities) is inline on `/poslanec`, every
  `/zebricek` row, `/penize/firma/[ico]` and the `/denik` entity view, beside a
  backlink to /schranka; its accessible label NAMES the entity, and the nav
  badge is a permanent `aria-live="polite"` region. Copy is hardcoded Czech
  (the /denik precedent); only strings on catalog-driven surfaces go through
  `messages/{cs,en}.json` (`common.follow*`).
  **`firma:` links to `/penize/firma/<ičo>`** since that page exists (6bc8780) —
  in the codec AND in `deriveDenik`'s company entity, both normalizing through
  `canonicalIco()`, so a contract row in the deník now links to the company
  whose contract it is instead of the first MP. **`obec:` is no longer offered**:
  `deriveDenik` emits only `poslanec:`/`firma:`/`tisk:` keys (no stream is keyed
  by a municipality; budget mirrors are an annual batch, not a dated stream), so
  the affordance was withdrawn rather than left promising a delivery nobody
  could make. Stored obec follows keep parsing and say exactly why nothing
  arrives.
  **The digest names its kinds, and a recompute is a delta (2026-08-04).** Every
  delta row has carried a `kind` since wave 1 and the page rendered an
  undifferentiated list; `EntityDelta.kinds` now counts them **before the
  `DELTA_ENTRIES_CAP` slice** (so the header summary — „3 smlouvy · 1 rozhodnutí
  brány" — describes the whole delta, not what fitted), and
  `features/schranka/kindVocabulary.ts` is the ONE Czech vocabulary (three forms
  per kind for 1 · 2–4 · 5+, pinned to the language gate; an unmapped kind renders
  VERBATIM and labelled, never hidden — the `tieFlags.ts` precedent). The wire
  validates the summary rather than re-deriving it from the capped rows.
  The new kind is **`recompute`**: person nodes carry
  `contribution_provenance {pass, ref, computedAt}`, so „your MP's index was
  recomputed" is a real dated fact the deník cannot see (it is keyed by contracts,
  roles, bill steps and the gate). It is ONE row per followed `poslanec:`, dated
  `computedAt`, citing pass + ref and linking `/metodika` — and it states in its own
  sentence that **the size of the move is unknown**: `computedAt` is one shared
  instant per pass and the graph keeps NO prior-value snapshots, so a per-MP
  „skóre se pohnulo o X" would be a fabricated number. It is emitted only when the
  chamber is UNIFORM on `{pass, ref, computedAt}` (`recomputeFactFromProps`, which
  reuses `summarizeContributionProvenance` rather than growing a second aggregator
  of one fact); a half-recomputed store reports `coverage.recompute: false` and the
  page says so. The row counts into `total`, so the nav badge sees it and the seen
  watermark clears it like any other entry.
  Reads: `getRecomputeFact.ts` is a `react.cache()`-wrapped **single indexed
  `listKgNodes({kind:"person"})` at `KG_READ_CAP`** — a strict subset of what
  `getLeaderboardData()` already reads, chosen over it because building the
  leaderboard costs 424–522 ms warm for three fields the badge asks for on every
  page. All subscription addresses now build through ONE server module
  (`getSchrankaDeltas.ts`), so a feed can never report different news than the page.
  **The follow list stays out of telemetry, and becomes a feed (2026-08-04).** The
  page and `followCodec`'s header both claimed the list reached the server „pouze
  jako parametry dotazu … žádná identita" — true about cookies, false about
  consequences: `sentry.server.config.ts` samples traces at **1,0**, so with a DSN
  configured every request URL would enter Sentry, and a 20-MP follow list plus an
  IP is a fingerprint however public each key is. **Measured** against a real SDK
  event (`telemetryScrub.test.ts` runs `Sentry.startSpan` through
  `beforeSendTransaction` with a stub transport): set only `url.full` and
  `@sentry/node` 10.67 copies the query into `http.query` as well — a field nobody
  set. `features/schranka/telemetryScrub.ts` therefore scrubs **by PARAMETER, not by
  path** (the address appears as an absolute URL, a relative path and a bare query
  string; a path rule would silently miss one): every `e=` whose value is a valid
  entity key is dropped and replaced by `e_count=<n>`, across `contexts.trace.data`,
  `request.url`/`query_string`, `spans[].data` and `breadcrumbs[].data`. A foreign
  `e=` is left alone. Both `beforeSend` and `beforeSendTransaction` run it.
  **Honest limit: no DSN exists in this repo, so verification is at the event level
  — the event the SDK builds — not at a request observed in Sentry.**
  The GET URL is deliberately KEPT (the reader owning a shareable, bookmarkable
  address IS the subscription), and the copy now states exactly that, including the
  one thing scrubbing does not change: the server still sees the request IP.
  **`/schranka/feed.xml` + `/schranka/feed.json`** are that subscription — the same
  `?e=…&od=…` address, the same key guard (`parseFollowKeys`), the same deltas
  (`getSchrankaDeltas`), and **the same serializer**: `features/denik/feedCodecs`
  grew an optional `channel` (title/description/home/feed URL, guid prefix, entry
  URL) plus a `DenikFeedItem` type of what it actually reads, so the schránka is a
  second channel rather than a second RSS/JSON codec, and the deník's own output is
  byte-identical (its tests pin it). The schránka's guid prefix is
  `politicas:schranka` because a recompute row is not in the deník, and an item's
  permanent address is its own page (`/metodika`, the file, the tisk) rather than a
  deník day anchor that would not contain it. A row followed through two entities is
  emitted ONCE. The channel description states what the URL encodes, that nothing is
  stored server-side, and that the keys are scrubbed from telemetry; both routes
  503 on an unreadable store (the `/denik/feed.*` precedent) and the JSON side is
  validated by the SAME `parseEvidenceFeedJson` both deníky use.
- `/graf` — **Graph playground** (features/graph): the full knowledge graph on
  a full-viewport `<canvas>`; the page opts out of the app shell
  (`isBareRoute`) to own the whole window width — chrome floats over the
  stage, breadcrumb links back. **Round 4 in progress — two variants:**
  A · Mapa × Trasy (the whole-graph landscape with trails as LENSES: pick a
  computed trail and the map dims to context, lights the trail's nodes/edges,
  flies to its extent and shows amounts — `StageLens` + `fitBounds` in
  GraphStage) vs C · Trasy (the same four computed answers as standalone
  ledger-column typesetting). Ohnisko rejected in round 3. All text goes
  through GraphStage's single label engine. Node click opens provenance and
  registry deep-links from stable ids (`lib/kg/sourceLinks.ts`). Sizing
  ground truth: `docs/data-analysis/graph-explorer-scale.md`.
- `/overeni` — **Ověření citace / Civic Claim Gate** (features/overeni): paste a
  politicas address (receipt `/zdroj/…`, graph citation `/graf/p/…`, velín
  exhibit, claim-ref or a copied `data-claim-*` element) and the gate re-derives
  it against today's record. The vocabulary is THREE verdicts and no fourth —
  `verified` · `moved` · `unknown` (`verdict.ts`); the gate itself derives
  nothing, it forwards each family to the loader that owns it.
  **The verdict states the human gate separately, since 2026-08-04.** For a
  receipt, `verified` means the RECORD EXISTS — and `review_state` is terminal
  per edge, so a rejected `linked_to` tie stays in the graph. The page used to
  print a 3xl „Ověřeno" over exactly that, with the gate state demoted to a small
  row 60 px below; since every money tie on /penize now ships a `/zdroj` receipt
  link, that is the address a reader is most likely to paste. `verdictGate()` /
  `verdictTone()` are pure and tested: existence and endorsement are two
  sentences at headline weight („Záznam v grafu je — lidská kontrola ho
  zamítla."), a non-confirmed gate loses the confirming cobalt (ochre for
  pending, `signal-deep` for rejected), and a gate-verified edge keeps its
  unqualified „Ověřeno". Measured on the live store: **211/211 `linked_to` edges
  are `pending_review`, 0 rejected** — the rejected path is proven by test, not
  by data.
  **One claim-status vocabulary** — `features/overeni/gateVocabulary.ts`. The
  page's table was keyed on the RECEIPT tokens (`verified|pending_review|
  rejected`) while a registry figure carries `ClaimReviewStatus`
  (`verified|pending`), so 2 of 3 issued figures rendered the raw English token
  and an omitted status rendered EMPTY. `pending` and `pending_review` are one
  state with one sentence; an unmapped token renders VERBATIM and labelled as
  untranslated (the `tieFlags.ts` precedent), never hidden and never guessed.
  **Our own page is not „not a politicas link"** — `refDetect` knew three path
  patterns and called everything else `nepodporovany`, which is false for
  `/penize/firma/<ico>`, `/poslanec/<id>`, `/zebricek`… The new
  `politicas-neni-citace` reason says it is our page but not a citable address
  and where that page issues one. The known-segment set is derived from
  `features/shell/navModel.ts` (NAV + children + `UNLISTED_ROUTES`), never
  retyped, and a foreign origin on the same path is still `nepodporovany`.
  **The two halves of the product point at each other, since 2026-08-04.**
  `/zdroj` never linked `/overeni` and `/overeni` named the receipt's endpoints
  as plain text, though `subject.id` / `object.id` are the exact ids
  `/poslanec/<pspId>` and `/penize/firma/<ico>` key on. The receipt footer now
  carries „ověřit tuto citaci" (`/overeni?ref=…`, still a GET, so the answer is
  a shareable address); `ReceiptBody` and the gate's own record row link both
  endpoints into our case files through ONE pure resolver
  (`features/shared/provenance/caseFileLink.ts`) that links only from the SHAPE
  of the stored id and never guesses.
  **The fact-check markup obeys the human gate (2026-08-12).** `/zdroj` emitted
  schema.org ClaimReview for EVERY receipt — including `pending_review` ties —
  with the gate state hidden inside `ratingValue` as a Czech sentence and a
  relative `url` schema consumers reject; a crawler that reads ratingValue as a
  number received our unreviewed trail as a reviewed claim, the exact thing
  `lib/claims/claim.ts` §3 forbids. `toClaimReviewJsonLd` now enforces the gate
  ITSELF (verified edges only; pending/rejected/ungated/node receipts emit
  NOTHING — no softer substitute schema), rating is numeric 5-of-5 only past
  the gate, `appearance` is the CreativeWork shape, and the absolute URL comes
  from request headers (the sitemap precedent) or the field is omitted. And the
  „gone" receipt stopped dead-ending on a base64 blob: the loader now returns
  the DECODED claim (subject — rel — object, endpoint nodes re-read so people
  and firms keep their names even when the edge is gone), rendered with
  case-file links via `caseFileLinkFor` only where today's graph still carries
  the node, the copy button, „ověřit tuto citaci" and `ReportClaimLink` in ONE
  shared citation footer; the unavailable state's backHref points home, not at
  the operators' velín. Both sides of the gate pinned by
  `features/shared/provenance/{receipt,messages}.test.ts`.
  **The guide's example is a real edge.** `guide.ts` built the `/zdroj` example
  from fabricated ids („osoba-priklad" / „firma-priklad"), so copy-pasting the
  one address the page invites you to copy returned „Neznámý odkaz." — in a
  `<pre>` that had no copy button while /zdroj shipped one. `getGuideExample.ts`
  reads ONE real `linked_to` edge at request time (deterministic, neutral by
  construction: first in graph order — src/rel/dst asc — with the rule printed
  under the example; ~806 ms cold, `react.cache`d per request). Derived, not
  pinned: an example hardcoded in source is a claim about the graph that
  nothing holds, and this repo has no live-store test suite to catch it going
  stale. Store unavailable → the illustrative shape, LABELLED illustrative.
  Only an example the gate verifies today carries `live: true` and gets the
  copy button + „ověřit tento příklad" — `CopyReceiptLink` moved out of
  `ReceiptPage` to `features/shared/components/CopyLinkButton.tsx` (@catalog)
  so there is one, not two.
  Also: the empty state renders an affordance instead of nothing, the verdict
  section is `id="verdikt"` + `tabIndex=-1` + `aria-live` and is focused after a
  GET submit (`VerdictFocus`), and the unknown headline moved off `steel-aa` to
  `ink` — it is the most common outcome, not a footnote.
  **The gate verifies live VALUES, not only the sample registry (2026-08-04).**
  `lib/claims/registry.ts` is a pure module over the sample layer — three figures,
  all issued by /svedectvi — so a money figure could never enter it (it would have to
  be frozen there, and start lying). `features/overeni/liveFigures.ts` is the second
  half: server-only, it decodes a claim's subject and hands the question to the
  loader that OWNS the number (`getMoneyMpDetail`, `getCompanyDetail`), which mints
  the claim with the SAME `features/money/moneyClaims.ts` the page used. The gate
  still derives nothing. Order is registry-then-live, so a store is only touched for
  a ref the finite registry does not know; a store that is down answers
  `unavailable`, never „the registry does not know this figure", and a live address
  today's graph no longer carries answers `zaznam-nenalezen`, not `mimo-rejstrik`.
  **The contribution score joined the SAME mechanism** (`features/civicscore/
  scoreClaim.ts`) — one value-claim family, not two: same ref grammar, same
  `figuraVerdict`, same derivation comparison. Its claim is `ungated` rather than
  `pending`, and the gate renders that with the receipt vocabulary's own
  „deterministické odvození — lidskou branou neprochází" instead of promising a
  human review of an arithmetic result.
  **The verdict now also compares the DERIVATION** (`data-claim-derivation`, new and
  optional on `Claim`): equal value + different basis is `moved`, not `verified` —
  a match between two different formulas is a coincidence, and this is exactly the
  2026-07-29→08-04 pass-42 case at the citation layer. A missing basis on either
  side is not compared: it claims nothing. Verified against the live store: the
  ledger's first row (Petr Hladík → Teplárny Brno, `kg-pass:10`) verifies at
  **23 653 407 340,55 Kč** from a bare ref AND from a pasted element; +1 000 000 on
  the pasted value answers `moved/value`; the same value stamped `kg-pass:11`
  answers `moved/basis`; the MP total (23 570 594 009,66) and the company reach
  verify the same way, and all of them carry `pending` because all 211 ties do.
  **The verifier speaks both languages, since 2026-08-04.** It had ZERO English
  — no `overeni` namespace at all, every sentence a Czech literal in
  `guide.ts` / `verdict.ts` / `OvereniPage.tsx` / the route metadata — while
  /penize, the surface that feeds it its traffic, is fully bilingual. All
  reader-facing copy now lives in `messages/{cs,en}.json` under `overeni.*`; the
  Czech moved VERBATIM. The pure modules stay pure and return **message keys**
  (`verdictHeadlineKey` / `verdictLeadKey`, `gateStatusInfo().labelKey`,
  `GuideStep.titleKey`, `GuideExample.labelKey`/`noteKey`) — that was the smaller
  honest design than threading a translator into logic, and it makes the mapping
  itself testable. Each module also exports the list of keys it CAN emit
  (`VERDICT_COPY_KEYS` / `GATE_COPY_KEYS` / `GUIDE_COPY_KEYS`), and
  `features/overeni/messages.test.ts` pins cs/en key parity, ICU placeholder AND
  `t.rich` tag parity, no empty value, every emitted key present in both
  catalogs, the Czech language gate over every sentence, and the acceptance bar
  of the gate-verdict work in BOTH languages (a rejected headline may not read as
  a confirmation; a gate-verified one keeps its unqualified „Ověřeno").
  Verified against the live store in a production build: the same real pending
  tie renders „Záznam v grafu je — lidskou kontrolou ještě neprošel." / „The
  record is in the graph — human review has not reached it yet."
- `/rentgen` — archived art direction.

All five politicas.md modules now have surfaces. **Update 2026-07-24 — four
surfaces are wired to the real knowledge graph** (`kg_node`/`kg_edge`, embedded
Postgres via `lib/db/`): `/penize` (money: 196 companies / 2 287 contracts / 260
human-gated ties), `/zebricek` + `/poslanec` (contribution index over 207 real
MPs), `/zakony` (141 bills → 101 laws via `amends`). Pattern: an `async` server
page awaits a server-only loader (`getStore()`) and passes typed props to the
`"use client"` feature — see `/hlasovani` + `features/votetrack/getVoteThemes.ts`
as the template, and the per-feature `get*Data.ts` loaders. The `lib/civic` mock
is **retained only as a graceful fallback** (loader returns `null` → mock). See
`docs/data-analysis/{graph-schema,coverage-ledger,graph-log}.md` for the graph
provenance. **`/dashboard`'s stat strip joined them 2026-07-28** — all four
headline numbers are now computed from the graph through the loader that owns
each one. **The state graph and the dated-fact feed are real since 2026-07-28,
`/rozpocty` is real since 2026-07-30 (MONITOR), and the landing is real since
`0e8410c`** (leaderboard layer) **+ 2026-08-12** (source-quality layer via the
atlas) — the `lib/civic` mock survives only as the labelled fallback. Next:
election-cycle hardening per §9 Phase 4.

## Code structure (patterns adopted from the personas repo)

```
app/                    thin routes only (page.tsx mounts a feature component)
features/landing/       the landing feature: LandingPage.tsx (orchestrator:
                        state + layout) + components/ + palette.ts (chart hex
                        mirror of tokens)
features/labs/          archived art directions — fixed hexes allowed
features/shell/         app chrome mounted in app/layout.tsx: left nav rail +
                        mobile nav. navModel.ts declares the modules and each
                        page's section anchors; isBareRoute() opts out landing,
                        /admin and /rentgen. Pages must NOT draw their own logo.
features/shared/components/  domain-agnostic primitive catalog (@catalog tags);
                        lint-enforced boundary: NO imports from features/* or
                        lib/civic — pass data via props
lib/civic/              domain data + colocated vitest tests
lib/format.ts           Czech number formatting (the only .toFixed for display)
eslint-rules/           custom lint rules (see below)
docs/DESIGN.md          design-system source of truth
```

Conventions:
- **Routes stay thin** — a page.tsx only mounts a feature and sets metadata.
- **Check the shared catalog before building a widget**; new reusable
  primitives go into `features/shared/components/` with a `@catalog` JSDoc
  one-liner, not into a feature folder.
- **Colors originate in `app/globals.css` tokens only** — see docs/DESIGN.md §1
  for the three declared exceptions. Enforced by lint.
- **Every rendered number cites its source** (`SourceNote`) — the brand rule.
- Sample data lives in `lib/civic/data.ts`; extend it, don't inline mocks.
  `score` must equal `composite(pillars)` — the colocated test enforces it.

## Quality gates

```bash
npm run dev          # dev server (Turbopack)
npm run check        # THE gate: typecheck + lint + test — run before calling work done
npm run typecheck    # tsc --noEmit
npm run lint         # eslint incl. 4 custom rules
npm run test         # vitest (lib/**/*.test.ts)
npm run build        # production build
```

Custom ESLint rules (`eslint-rules/`, ported/adapted from personas, all at
error level — keep it that way while the codebase is young):
- `custom/no-hardcoded-colors` — token discipline (politicas-specific)
- `custom/no-silent-catch` — empty catch blocks swallow errors
- `custom/role-button-requires-keydown` — a11y for click-role elements
- `custom/enforce-reduced-motion-fallback` — WCAG 2.3.3 for looping motion
- `custom/no-server-import-in-client` — the server-only loader boundary
- `custom/no-silent-null-catch` — scoped to `features/**/get*.ts` +
  `features/**/*Loader.ts`: a `catch { return null }` must call
  `reportLoaderFailure()` so a degradation to fallback leaves a trace

CI: `.github/workflows/ci.yml` — live on `xkazm04/politicas` (the repo split
happened). Runs typecheck → lint → test → schema-snapshot drift → build, plus a
non-blocking `npm audit --audit-level=high`. `npm run check` is the local
equivalent. `lefthook.yml` is installed via the `prepare` script: pre-commit
lints staged files, pre-push runs typecheck + test.

**CI pins `node-version: 24` deliberately.** The lockfile is written by npm 11
(node 24); npm 10 (node 22) places optional peer deps differently, so a node-22
runner fails `npm ci` with a permanent phantom "lock file out of sync" for
`@emnapi/runtime` / `@swc/helpers`. Do not lower it.

## Definition of done

Work is done when every line below holds. No partial credit — "green except…"
is not green.

- [ ] `npm run check` passes (typecheck → lint → test). Run it, don't assume it.
- [ ] **Every rendered number cites its source** (`SourceNote`). Derived or
      ungated values are labelled as such (`pending_review`); nothing renders
      a figure the data doesn't actually carry. This is the brand rule — a
      violation is a failed task, not a nit.
- [ ] Fallbacks stay honest: a loader that returns `null` calls
      `reportLoaderFailure()` (`lib/db/loaderGuard.ts`), and the surface shows
      a labelled mock or an honest empty state (`DataUnavailable`) — never
      plausible fiction presented as real.
- [ ] The six custom ESLint rules pass **unsuppressed**. They are error-level
      by design — fix the code; do not disable a rule, add an
      `eslint-disable`, or widen an exemption zone in `eslint.config.mjs`.
- [ ] Colors come from `app/globals.css` tokens; Czech display numbers go
      through `lib/format.ts`; new reusable widgets went into
      `features/shared/components/` with a `@catalog` line.
- [ ] Docs coupled to the touched source are updated in the same change —
      `docs/feature-doc-map.json` maps source paths to the docs they own.
- [ ] Staged **per file** (`git add <path>`, never `-A` / `.` / `-u`);
      `git diff --cached --stat` reviewed against what you intended; message
      in Conventional Commits form.
- [ ] If the task earned a durable, non-obvious learning, it is written to
      `memory/<slug>.md` and indexed in `MEMORY.md` (bar below).

## Agent memory

Durable, cross-session knowledge lives in `MEMORY.md` (a one-line-per-entry
index) + `memory/*.md` (one hard-won fact per file). **Read `MEMORY.md` at
session start** — it's the fast path to decisions already taken and gotchas
already paid for, before you touch code. At session end, record any durable,
non-obvious learning as a new `memory/<slug>.md` entry (terse `name` +
`description` frontmatter, then the fact + why it matters) and add its index
line to `MEMORY.md`. Bar for an entry: worth recalling in three months **and**
not derivable in ten seconds from `docs/` — no filler, no restating the docs.

## Git discipline (ported from personas' parallel-safety primitives)

- Stage per-file (`git add <path>`) — never `git add -A`/`.`/`-u`; other
  sessions may have in-flight work in this tree.
- Never `git stash` work that isn't yours.
- Atomic commits per task; Conventional Commits format (`feat: …`, `fix: …`)
  — CI will enforce it after the repo split.
- Before commit: `git diff --cached --stat` and verify the staged count
  matches what you intended.

## Known gotchas

- recharts `ResponsiveContainer` inside a CSS grid track needs `min-w-0` on
  the track and a fixed-aspect `overflow-hidden` wrapper — otherwise the page
  livelocks in a resize loop (hit 2026-07-22; see docs/DESIGN.md §4).
- SVG coordinates from trig must be rounded (2 decimals) or SSR/CSR float
  drift trips React hydration (see `Hemicycle.tsx`).
- Stack: Next 16.2 (App Router), React 19.2, Tailwind v4, framer-motion,
  recharts 3, vitest, lucide-react. Fonts in `app/layout.tsx`: `font-sans`
  Archivo, `font-mono` IBM Plex Mono, `font-serif` Fraunces (reserved).

<!-- personas:context-map:start -->
## Project Context Map

This project is organized into **48 contexts** across **10 groups**. The full machine-readable map lives in `context-map.json` at the project root — read it at task start to scope your edits to the relevant context's files.

Taxonomy: each context has a `category` (ui · api · lib · data · test · config); each group has a `domain` (feature · infrastructure · shared · integration · data).

### Groups

- **Landing & Navigation** _(domain: feature · 5 contexts)_
- **MP Profiles & Rankings** _(domain: feature · 5 contexts)_
- **Voting & Legislation** _(domain: feature · 4 contexts)_
- **Financial Transparency** _(domain: feature · 5 contexts)_
- **Data Ingestion** _(domain: integration · 10 contexts)_
- **Data Layer** _(domain: data · 2 contexts)_
- **Shared UI Primitives** _(domain: shared · 3 contexts)_
- **Infrastructure & Observability** _(domain: infrastructure · 9 contexts)_
- **Knowledge Graph Explorer** _(domain: feature · 1 contexts)_
- **Civic Feed & Transparency** _(domain: feature · 4 contexts)_

> Auto-generated by Personas on each context scan. Edits between the markers are overwritten on the next scan; edit `context-map.json` or rescan instead.
<!-- personas:context-map:end -->
