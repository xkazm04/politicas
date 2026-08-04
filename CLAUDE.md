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
- `/` — landing (features/landing)
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
- `/rozpocty` — **BudgetMirror** (features/budget): town vs peer-group mirror —
  metric duos against the computed peer median, debt-per-capita trend lines
  (town vs median), sortable peer table. Stewardship feeds only executive
  roles — stated explicitly on the page.
- `/zakony` — **LawWatch** (features/lawwatch): **wired 2026-07-24 to the real
  graph** (`getLawData.ts`) — **141 bills → 101 laws via 150 `amends` edges**,
  grouped by most-amended statute, with sponsors (→ `/poslanec/<pspId>`),
  Case-① conflict flags, and one gated forensic posudek (tisk 58, rendered as
  derived/`pending_review`). The mock's **paragraph diffs (before/after) and the
  bill-stage pipeline stepper were dropped** — the graph carries no such data
  (the `č. N/RRRR Sb.` title citation is the only structured bill→law link
  psp.cz publishes); fabricating them would violate the brand rule. Mock kept as
  fallback.
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
each one; what is still sample data there is the state graph and the traffic
feed (both labelled), plus `/rozpocty` and landing. Next: port those, or
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

CI: `.github/workflows/ci.yml` (typecheck → lint → test → build). NOTE: it
activates once politicas becomes its own repo — inside the kiro monorepo,
GitHub only reads workflows from the repo root; `npm run check` is the local
equivalent. Same for `lefthook.yml` (pre-commit staged lint, pre-push
typecheck+test) — install lefthook only after the repo split.

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

This project is organized into **24 contexts** across **8 groups**. The full machine-readable map lives in `context-map.json` at the project root — read it at task start to scope your edits to the relevant context's files.

Taxonomy: each context has a `category` (ui · api · lib · data · test · config); each group has a `domain` (feature · infrastructure · shared · integration · data).

### Groups

- **Landing & Navigation** _(domain: feature · 2 contexts)_
- **MP Profiles & Rankings** _(domain: feature · 3 contexts)_
- **Voting & Legislation** _(domain: feature · 2 contexts)_
- **Financial Transparency** _(domain: feature · 3 contexts)_
- **Data Ingestion** _(domain: integration · 3 contexts)_
- **Data Layer** _(domain: data · 5 contexts)_
- **Shared UI Primitives** _(domain: shared · 2 contexts)_
- **Infrastructure & Observability** _(domain: infrastructure · 4 contexts)_

> Auto-generated by Personas on each context scan. Edits between the markers are overwritten on the next scan; edit `context-map.json` or rescan instead.
<!-- personas:context-map:end -->
