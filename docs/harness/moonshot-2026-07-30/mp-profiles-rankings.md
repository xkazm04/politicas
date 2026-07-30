# Moonshots — MP Profiles & Rankings

> Group: MP Profiles & Rankings · Contexts: 3 · Proposals: 6

## Velin Dashboard

### M1. Deník republiky — the daily provenance-stamped diff of the state
- **Tier**: 1
- **Category**: data-as-moat
- **Feasibility**: medium
- **Time-horizon**: months
- **What it is**: The dashboard's dated-fact ledger stops being a decoration of one 3-seed slice and becomes the product's front page: a chronological, subscribable public record of *everything that changed in the knowledge graph* — new contracts signed, registry roles entered/erased, committee assignments, bills published in the Sbírka — computed as a diff between ingest passes, each entry provenance-stamped and linked to its node. Readers, journalists and bots subscribe per-entity ("watch this MP / this company / this statute") via RSS/JSON feeds. No Czech outlet has a machine-readable daily ledger of parliament-adjacent state changes; this makes politicas the wire service of Czech accountability.
- **Why it's a moonshot**: It converts a batch-artifact graph into a temporal medium — falsifiable claim: within two election cycles, "podle deníku politicas" citations in Czech media exceed citations of the underlying primary registries, because the diff (what's *new*) is the journalistically valuable object the registries themselves never publish.
- **Grounded in**: `features/dashboard/datedFacts.ts` is already a pure, tested, deterministic dated-fact builder (contracts, committee routing, registry roles, impossible-date exclusion); `features/dashboard/getDashboardData.ts` already reads per-company facts via indexed `kgNeighbours` and stamps `builtOn`; every kg write is pass-numbered and provenance-stamped (`contribution_provenance`, edge `provenance.pass`), so pass-over-pass diffing needs no new source data; `lib/db/pglite/repositories/provenance.ts` exists.
- **Path to implementation**:
  1. Generalize `buildDatedFacts` to take arbitrary entity sets (it is already pure and slice-agnostic in shape — only its call site limits it to the slice's sources).
  2. Add a pass-snapshot table (node/edge count + content hashes per pass) to the PGlite DDL, written at the end of each ingest script.
  3. Build a `diffPasses(a, b)` reader that emits typed dated facts for added/changed edges (new `supplies`, `linked_to`, `amends`, membership rows).
  4. Mount `/denik` rendering the diff ledger with the existing `FactRow`/`FeedRow` components; keep the velín panel as its top-N excerpt.
  5. Emit `/denik/feed.json` + RSS from the same builder; add per-entity filter params (`?uzel=…`, reusing the `useGraphSelection` URL convention).
  6. Per-entity "sledovat" bookmarking (localStorage first, accounts later).
- **Dependencies / risks**:
  - Requires keeping at least one prior pass's snapshot around (storage + ingest-script discipline).
  - A diff can surface a pending_review fact prominently — the human-gate rule must be enforced in the diff reader, not assumed.
- **What changes if we ship it**: politicas stops being a place you visit and becomes a feed you follow — the recurring-traffic engine every other module plugs into.

### M2. Evidence cards — every graph slice as a signed, embeddable exhibit
- **Tier**: 2
- **Category**: platform-distribution
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: Any slice of the state graph — the velín's canvas plus its fact ledger — becomes an exportable, embeddable "exhibit": a permalinked page, an `<iframe>` widget and a server-rendered OG image, each carrying the selection rule, pass number, build date and pending/verified markings baked into the artifact. A journalist writing about MP X embeds the live exhibit instead of screenshotting it; the citation chain travels with the picture.
- **Why it's a moonshot**: Distribution today is 100 % on-site; embeds put the product inside every article that cites it — 10x reach without 10x content, and every embed is a backlink-shaped acquisition channel.
- **Grounded in**: `features/dashboard/stateSlice.ts` is a pure function from projections to a drawable graph (trivially parameterizable by seed set); `StateGraphCanvas.tsx` renders from that shape alone; selection already lives in the URL (`useGraphSelection`, `?uzel=…`); the rule struct (`StateSliceRule`) is designed to be printed and cannot diverge from the drawing; `builtOn`/pass provenance is already in `DashboardData`.
- **Path to implementation**:
  1. Parameterize `buildStateSlice` with an explicit seed list (`?semena=301,412`) while keeping the non-evaluative default; validate seeds against the dual-band population.
  2. Add `/dashboard/rez` (or `/exhibit/[params]`) as a chrome-less route mounting canvas + ledger + rule caption only.
  3. Server-render an OG/PNG variant (Next OG image route) from the same slice data, with the pending hatching and rule text in the image.
  4. Add an "Vložit / sdílet" affordance on the velín emitting the iframe snippet + permalink.
  5. Sign exhibits: embed pass number + content hash in the URL so a stale embed visibly says so.
- **Dependencies / risks**:
  - Arbitrary seed choice can turn the deliberately non-evaluative slice into an accusatory composition — the exhibit must print *who chose the seeds* (the "rule" line becomes "výběr čtenáře", not the mandate rule).
  - OG rendering of the canvas needs an SVG/Satori re-implementation of the glyph language.
- **What changes if we ship it**: the state graph becomes citable infrastructure other publishers build on, not just a page they link to.

## MP Profile Dossier

### M1. Spis API — the canonical machine-readable dossier of every Czech MP
- **Tier**: 1
- **Category**: foundational-primitive
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Every `/poslanec/<id>` page gains a twin: a versioned, structured JSON(-LD) dossier at `/api/spis/<id>` carrying everything `getProfileData` already computes — score with pass provenance, six components with published caps, committee seats with the current/past evaluation instant, money ties with tie-class and review state, per-bill engagement — each fact with its source URI. Plus a pass-over-pass changelog per MP ("co se ve spisu změnilo"). NGOs (Hlídač státu, Rekonstrukce státu), newsrooms and researchers consume it directly; politicas becomes the reference resolver for "who is this MP, empirically".
- **Why it's a moonshot**: The dossier loader is the single most information-dense artifact about a Czech MP that exists anywhere, and today it is only reachable as rendered HTML. Falsifiable claim: exposing it as a stable contract makes politicas the upstream data dependency of at least three external accountability tools within a year — the position psp.cz's raw dumps can never occupy because they carry no derived layer and no gates.
- **Grounded in**: `features/profile/getProfileData.ts` already assembles the complete typed `ProfileData` in one cached pass (indexed `kgNeighbours`, attribution rule enforced, public-copy guard applied, `seatsAsOf` instant, floors-not-totals on capped reads); `getAllProfilePspIds()` enumerates the population; every sensitive field already carries review state and pass — the hard provenance work is done.
- **Path to implementation**:
  1. Add `app/api/spis/[id]/route.ts` that calls `getProfileData(pspId)` and serializes it with an explicit `schemaVersion` — near-zero new logic on day one.
  2. Write the public contract doc (field semantics: what a null means vs a 0 — the loader's own doc comments are 80 % of it).
  3. Add per-MP pass changelog: persist a compact `ProfileData` hash per pass, expose `/api/spis/<id>/changes`.
  4. JSON-LD mapping (schema.org `Person` + custom `civic:` vocabulary) so search engines and wikidata bots ingest it.
  5. Rate-limit + ETag on the route; publish an OpenAPI spec.
  6. Recruit two design-partner NGOs and stabilize v1 against their usage.
- **Dependencies / risks**:
  - A public contract freezes internals — needs a versioning discipline before the first external consumer.
  - Serving pending_review money ties to machines amplifies the human-gate stakes: the API must carry the review state as prominently as the UI does, or accusations propagate stripped of their caveats.
- **What changes if we ship it**: the Spis stops being a page and becomes the national primitive other civic software is built from.

### M2. Kariérní spis — the MP file across parliamentary terms
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: The Spis today is honestly single-term ("jedno období" instead of a fabricated trend). Ingest PSP7–PSP10 activity and memberships and the file becomes a career: score trajectory per term computed by the same deterministic index, committee-seat history as a timeline, money-tie validity windows (`roleValidFrom/To` already exist) laid against mandate periods — "he entered the registry three months after joining the budget committee" becomes a visible, dated, sourced juxtaposition, still stated as fact, never as verdict.
- **Why it's a moonshot**: Accountability without memory is theater — a career file 3–5x's the product's core question from "how is this MP doing" to "what has this MP become", which is the question voters actually ask at election time.
- **Grounded in**: `lib/analysis/contribution-trend.ts` + the PSP9 trend already prove the cross-term mechanic works for one prior term; `TenureTrendGate.tsx`/`TenureNote.tsx` already render tenure honestly; `lib/ingest/sources/psp-activity.ts` parses the same dump format psp.cz publishes for earlier terms; membership rows carry `fromAt/toAt`; ties carry `role_valid_from/to`.
- **Path to implementation**:
  1. Run the existing psp-activity ingest against PSP8 (the dumps are the same shape) into term-scoped nodes/props.
  2. Extend `computeTrend` from a PSP9 pair to an N-term series; keep per-term caps published per term.
  3. Add a career timeline section to `ProfilePage` (terms × score, seats as horizontal spans) gated exactly like `TenureTrendGate` — absent history renders as absent.
  4. Overlay tie validity windows on the same time axis, with the existing pending/verified marking.
  5. Extend `seatsAsOf`-style honesty: each term's figures cite that term's pass.
- **Dependencies / risks**:
  - Older-term data quality is worse (the corpus already contains a year-2925 date); the plausible-date discipline must extend backward.
  - Cross-term person identity (psp person ids are stable, but club changes and name changes need care).
  - Index comparability across terms must be disclosed, not implied (different chamber sizes, different bill volumes).
- **What changes if we ship it**: the Spis becomes the place where a political career is legible end-to-end — the artifact people open in an election year.

## CivicScore Leaderboard

### M1. Otevřený index — the reader re-weights the republic
- **Tier**: 1
- **Category**: trust-layer
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: The six published weights (25/20/20/15/10/10) become sliders. A reader sets their own priorities — "attendance matters more to me than speeches" — and the entire 207-row leaderboard, histogram and Souboj re-rank live under *their* index, clearly labeled as their lens versus the published one. Weight vectors encode into the URL, so a ranking is shareable and every shared ranking carries its methodology in the link itself. NGOs and papers publish named preset lenses ("index Rekonstrukce státu"). The published index stays the authoritative default; the moonshot is that the *methodology itself* becomes the interactive object.
- **Why it's a moonshot**: Every MP-ranking ever published is attacked on its weights; making the weights the reader's own converts the product's biggest trust liability into its defining feature — falsifiable claim: shared custom-lens URLs become the leaderboard's dominant inbound traffic, because a ranking you co-authored is one you defend rather than dispute.
- **Grounded in**: `componentPoints()` in `features/civicscore/getLeaderboardData.ts` already re-derives all six component points from published per-MP rates and saturation caps — re-weighting is a dot product over data the client already holds; the landing's `LiveSpecimen` already teases a live re-weightable score, proving the interaction in miniature; `duel.ts` outcome logic is a pure function that re-runs under any weights; URL-state conventions exist (`useGraphSelection`).
- **Path to implementation**:
  1. Ship the raw six rates (already in `LeaderboardListEntry` components) plus caps to the client — they are, verify payload size.
  2. Pure `reweigh(entries, weights)` function with tests (rank, tie-count, histogram recompute), mirroring `duel.ts` discipline.
  3. Slider panel above the table; "oficiální index" reset; the on-page source note switches to "váš index — váhy W" whenever weights ≠ published.
  4. Encode weights in the URL (`?vahy=25-20-20-15-10-10`); Souboj and histogram read the same vector.
  5. Named preset lenses as a static registry; later, submitted lenses with attribution.
- **Dependencies / risks**:
  - The custom/official distinction must be typographically unmissable, or screenshots of hostile custom rankings get attributed to politicas — bake the weight vector into the rendered header.
  - Component points are display-rounded (±0,1 vs composite); the custom composite must sum the same re-derivation, not mix with the authoritative score.
- **What changes if we ship it**: the leaderboard stops asserting one truth and starts hosting a methodology conversation — the most defensible position an accountability ranking can hold.

### M2. Můj kraj — the constituency ballot card
- **Tier**: 2
- **Category**: interface-expansion
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: A constituency lens on the same data: pick your kraj and get *your* MPs as a ranked slate — scores, components, money-tie and rebellion flags, dossier links — plus a printable/shareable "volební karta" (one A5/OG-image card per kraj: who represents you, ranked, sourced, dated). Souboj gains a "všichni z kraje" mode. Positioned for election season: the answer to "koho mám vlastně v kraji a co dělali" in one screen.
- **Why it's a moonshot**: The leaderboard's frame (all 207) is a journalist's frame; the voter's frame is 10–26 people they can actually vote on. Serving that frame reaches an order of magnitude more people than the national table ever will, at election time specifically.
- **Grounded in**: `region` is already on every `LeaderboardEntry` (from the volební-kraj organ, `regionLabel()`); `LeaderboardTable.tsx` already filters by party — a region facet is the same mechanic; `HeadToHead.tsx` + `duel.ts` generalize to a slate; the Konstrukt poster language (enormous numerals, index numbers, source captions) is exactly a ballot-card aesthetic, and OG-image rendering is standard Next.
- **Path to implementation**:
  1. Add a kraj facet next to the party filter in `LeaderboardTable` (data already present; zero loader changes).
  2. Mount `/zebricek/kraj/[slug]` server-rendering the slate view from `getLeaderboardData()` filtered by region.
  3. Design the volební karta as a component in Konstrukt language; add an OG-image route per kraj.
  4. Cross-link: each Spis header links "ostatní z kraje"; the velín links the reader's kraj (geolocation-free — a picker, remembered locally).
  5. Print stylesheet for the card (A5, black on paper — Konstrukt is already print-native).
- **Dependencies / risks**:
  - A ranked slate next to an election is electioneering-adjacent — the card must carry the methodology citation and build date as prominently as the ranks (the existing SourceNote discipline, enforced on the image too).
  - `region` is null for a handful of MPs; the slate needs the honest "kraj neuveden" bucket.
- **What changes if we ship it**: politicas gets its first artifact designed to be handed to another person — the growth loop is the card, not the site.
