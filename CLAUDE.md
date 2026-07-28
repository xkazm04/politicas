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
- `/poslanec/[id]` — **Spis** (features/profile): the Person profile —
  politicas.md §3's "real product". Wired to the real graph (no mock path):
  poster header + contribution score/rank, the six weighted components, the
  work-profile dossier (effort-loop enrichment + sponsored/rapporteur bills),
  co-voting allies, club rebellions, committee seats, prev/next file nav.
  Under the component tiles sits the **score-legibility panel** — per component
  the MP's value in that component's own unit, the scorer's cap, the chamber
  median and the rank the real ranked chamber gives at that cap (pure logic +
  tests in `lib/analysis/score-legibility.ts`; all of it labelled *derived*, and
  a missing input says so rather than rendering a zero).
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
