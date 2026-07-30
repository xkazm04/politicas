# Moonshots — Landing & Navigation

> Group: Landing & Navigation · Contexts: 2 · Proposals: 4

## App Shell & Navigation

### M1. Občanská schránka — the shell becomes a personal civic inbox (Follow anything, see what changed)
- **Tier**: 1
- **Category**: civic-network-effects
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Every entity the app renders — an MP, a bill, a company, a town, a whole module — becomes followable from the chrome itself. The sidebar grows a "Sledované" tray that shows provenance-stamped deltas since the reader's last visit: "Poslanec X: 2 nové rebelie · 1 vazba ověřena · tisk 141 postoupil do 3. čtení." The shell stops being a table of contents and becomes the reason journalists and watchdog NGOs open the site every morning. Follows are local-first (localStorage), with optional e-mail digests later; every delta line is a dated, sourced fact — never a push-notification accusation.
- **Why it's a moonshot**: It converts a read-once reference site into a habit product; falsifiable claim: weekly returning-visitor rate goes from near-zero (typical for transparency sites) to >30% among journalists who follow ≥3 entities, because the product now answers "what changed" instead of "what is".
- **Grounded in**: `features/shell/navModel.ts` (declarative registry — the natural place for a followable-entity taxonomy), `features/shell/Sidebar.tsx` + `sidebarParts.tsx` (the per-module metric slot already renders live-ish figures per row), `lib/db/pglite/repositories/provenance.ts` + `review.ts` (every sensitive fact is already provenance-stamped and dated — change detection is a query, not new infrastructure), `features/dashboard/datedFacts.ts` (the dated-fact ledger shape IS the delta feed shape).
- **Path to implementation**:
  1. Add a `followable` descriptor to `NavEntry`/entity pages and a localStorage-backed `useFollows()` hook; render a static "Sledované" tray in `Sidebar.tsx`/`MobileNav.tsx` listing followed entities as links.
  2. Add a `lastSeenAt` stamp per follow; write a deterministic delta query over `kg_edge`/provenance rows (created/verified after `lastSeenAt`) reusing the `datedFacts.ts` derivation.
  3. Render deltas as `SourceNote`-cited fact rows in the tray, with counts badged on the module rows.
  4. Add follow buttons to `/poslanec/[id]`, bill dossiers, and money case files.
  5. Later: optional account + e-mail digest (server cron over the same delta query).
- **Dependencies / risks**:
  - Requires the real-graph wiring phase (UI still on `lib/civic` mock) so deltas are true facts, not sample churn.
  - Delta copy must pass the same human-gate discipline as surfaces — a "new tie" line may only appear once verified.
- **What changes if we ship it**: politicas stops competing with static watchdog PDFs and starts competing with the reader's morning news habit.

### M2. Celografová omnisearch — ⌘K over the entire republic
- **Tier**: 2
- **Category**: foundational-primitive
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: A global command palette in the shell (⌘K / a search affordance in the sidebar BrandBlock and MobileNav bar) that searches the whole knowledge graph — 7 045 people, 196+ companies, 2 287 contracts, 141 bills, towns — plus routes and page sections, and deep-links every hit to its canonical surface with its provenance link. Today navigation reaches exactly 6 module roots + 4 subpages; the graph underneath holds hundreds of thousands of addressable facts with no direct door.
- **Why it's a moonshot**: It multiplies the addressable surface of the product by ~4 orders of magnitude (10 nav targets → every named entity in the graph); falsifiable: median clicks from "I heard a name on the radio" to that entity's sourced record drops from "impossible without knowing the site map" to 2.
- **Grounded in**: `features/graph/components/NodeSearch.tsx` + `features/graph/graphLoader.ts` (node search over the kg already exists, scoped to /graf — this generalizes it), `features/shell/navModel.ts` (`PAGE_SECTIONS` gives section-anchor results for free), `lib/kg/sourceLinks.ts` (per-node registry/provenance deep-links), `lib/db/pglite/repositories/kg.ts` (name-indexed node reads).
- **Path to implementation**:
  1. Extract the /graf node-search matching into a shared `lib/kg/search.ts` and expose a server action returning typed hits (person/company/contract/bill/town/route/section).
  2. Build a `CommandPalette` client component in `features/shell/` (Konstrukt-styled: mono index numbers, kind glyphs from `lib/kg/glyph.ts`), mounted in `AppShell` with a ⌘K listener.
  3. Route hits: MPs → `/poslanec/[id]`, bills → `/zakony/[cislo]`, companies/contracts → `/penize` trails or registry `sourceLinks`, sections → in-page anchors.
  4. Add the trigger affordances to `Sidebar` and `MobileNav`; respect the existing a11y lint rules (focus trap, keydown).
  5. Later: recent-searches memory and "open in graph" secondary action per hit.
- **Dependencies / risks**:
  - Needs a fast name index in PGlite (trigram or lowercase index) so keystroke search stays local-instant.
  - Entities without a canonical surface yet (some companies) need an honest fallback target (graph inspector), not a dead end.
- **What changes if we ship it**: every proper noun in Czech politics becomes a typed query away from its sourced record.

## Landing Page

### M1. Referendum o metodice — shareable, embeddable citizen-weighted index
- **Tier**: 1
- **Category**: platform-distribution
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: The hero's re-weightable score becomes a first-class civic artifact. A reader's weight-set encodes into the URL (`/?w=30-20-15-…`), renders an OG share card ("Můj index: Poslanec X = 74,2 — váhy: docházka 30 %"), and is embeddable as an iframe widget any newsroom or blog can drop in — the full leaderboard re-ranked under those weights, every figure still source-cited. Anonymous submitted weight-sets aggregate into a published "jak republika váží" median displayed beside the official weights in Methodology — the methodology page itself becomes a running referendum on what a good MP is.
- **Why it's a moonshot**: Every share and embed carries a live, provenance-cited instrument into other people's media — distribution stops depending on people visiting politicas; falsifiable: within one election cycle, embedded/linked custom-weight views outnumber direct landing views.
- **Grounded in**: `features/landing/LandingPage.tsx` (weights + selected-MP state and live recompute already exist), `features/landing/components/LiveSpecimen.tsx` (sliders, reset-to-published affordance, cobalt "custom" signalling), `lib/analysis/contribution.ts` (deterministic 6-dimension scorer to re-rank all 207 MPs under arbitrary weights), `features/landing/components/Methodology.tsx` (the published-weights grid the citizen median sits beside), `app/page.tsx` (searchParams entry point).
- **Path to implementation**:
  1. Serialize weights into the URL via `useSearchParams`/`history.replaceState` and hydrate initial state from it in `LandingPage.tsx` — shareable links work with zero backend.
  2. Add a "Sdílet mé váhy" action to `LiveSpecimen` (copy link + Web Share API).
  3. Generate dynamic OG images for weighted links (Next `ImageResponse`, Konstrukt poster style).
  4. Build `/widget` — a bare route rendering the weighted standings compactly for iframes, with a visible "zdroj: politicas" citation line.
  5. Store anonymous weight submissions (one PGlite table) and surface the median in `Methodology.tsx` as "váhy čtenářů (n=…)" vs published weights.
- **Dependencies / risks**:
  - Custom weights must stay visually distinct from the published index (the cobalt treatment already does this) so screenshots can't misrepresent the official score.
  - Weight-aggregate is self-selected, not representative — label it as such (evidence-first doctrine).
- **What changes if we ship it**: the methodology stops being a disclosure and becomes the product's viral loop.

### M2. Deník republiky — the landing as a daily deterministic edition
- **Tier**: 2
- **Category**: data-as-moat
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: The landing gains a dated masthead strip — "Vydání č. 214 · středa 30. 7. 2026" — composed each day, deterministically, from the real graph: yesterday's roll-calls with rebellion counts, ties newly human-verified, bills that moved a stage, the day's biggest attendance mover. Each item is a dated, source-cited fact row in Konstrukt form (index numbers, „obr." captions). The hemicycle and standings teaser start reflecting real chamber state instead of the `lib/civic` sample. A static marketing poster becomes a front page that is visibly different every day — and its archive becomes citable ("politicas, vydání 214").
- **Why it's a moonshot**: A landing that changes daily with sourced facts is a return trigger and a citation target no static transparency site has; falsifiable: the landing's repeat-visit share and external deep-links to dated editions become measurable where today they are structurally zero.
- **Grounded in**: `features/dashboard/datedFacts.ts` + `getDashboardData.ts` (the dated-fact derivation and loader reuse pattern already exist one route away), `features/landing/components/Hemicycle.tsx` + `Standings.tsx` (the surfaces to switch from `MPS` sample to loader-fed props), `lib/analysis/law-verdict.ts` / `money-feed.ts` (the case feeds that produce "what moved"), `features/shared/components/SourceNote.tsx` + `DataUnavailable.tsx` (citation + honest-outage primitives ready).
- **Path to implementation**:
  1. Make `app/page.tsx` a server component that calls a new `getLandingEdition.ts` reusing the dashboard loaders, passing real data (or null → current sample fallback, labeled per the DESIGN.md real-vs-illustrative rule) into `LandingPage`.
  2. Add the masthead `EditionStrip` component: date, edition number (days since first ingest), 3–5 fact rows from `datedFacts`-style derivation windowed to the last sitting day.
  3. Wire `Standings`/`Hemicycle` to accept loader data with the existing sample as explicit fallback.
  4. Cache the edition per-day (ISR revalidate) so the page stays static-fast.
  5. Later: `/vydani/[n]` archive routes making each edition permanently citable.
- **Dependencies / risks**:
  - Depends on ingestion cadence being reliable daily; a stale edition must say so (LiveDataNotice pattern), never silently reuse yesterday.
  - "Biggest mover" phrasing must come from the deterministic verdict-copy layer, not ad-hoc superlatives.
- **What changes if we ship it**: the front page becomes primary-source daily journalism generated from the graph — the moat competitors can't screenshot their way past.
