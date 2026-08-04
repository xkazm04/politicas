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
  read and summed; a `steward` seat's institutional contracts are never fetched,
  never summed and the row says why. A contract whose `signedOn` could not have
  happened (the corpus holds 0002 / 1970 / 2027 / 3062 — `lib/analysis/
  plausible-date.ts`) keeps its row and its amount, loses its date, and the
  count of such rows is disclosed; the date is never repaired. The
  absentee-manager lead in the header now carries the `pending_review`
  provenance of its money input instead of standing as a bare accusation.
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
