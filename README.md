# Politicas

Public-accountability platform for **Czech politics** — voting records, MP
scoring, laws, and municipal budgets over one shared entity graph
(person ↔ party ↔ company ↔ contract ↔ vote ↔ budget ↔ law). Five
interconnected modules — **CivicScore** (MP scoring), **VoteTrack** (roll-call
voting records), **FollowTheMoney** (money ties), **BudgetMirror** (town
budgets), **LawWatch** (law changes) — positioned as an empirical,
methodology-transparent source for the next elections. Bilingual **CS + EN**
(next-intl; Czech-first formatting via `lib/format.ts`), and the brand rule is an
**evidence-cited data doctrine**: every rendered number carries its source, and
ties render as dated, sourced facts — never accusations.

## The accountability engine — a golden trio on one knowledge graph

Behind the module surfaces, a real knowledge graph (`kg_node` / `kg_edge` over
embedded Postgres) holds live Czech open data — 7,045 people, 207 current MPs,
406k ballots — and **three deterministic, human-gated accountability cases** that
cross-reference on the same graph. **COUNTS come from deterministic scorers, never
an LLM; every sensitive fact is written `pending_review` and provenance-stamped; a
fabricated legal citation is gated out.** A lead, never a published verdict.

- **① FollowTheMoney** (`lib/analysis/money-feed.ts`, `scripts/data-analysis/kg-money-ingest.ts`)
  — MP → company → public-contract trails from **Hlídač státu + ARES + Registr
  smluv**, joined on IČO with a strict resolver (drops rather than guesses) and a
  human gate on every link. Chamber sweep: 73 MPs · 196 companies · 2,287 contracts
  · ~19.76B CZK, all `pending_review`.
- **② Effort** (`lib/analysis/contribution.ts`, `lib/ingest/sources/psp-activity.ts`)
  — a transparent 6-dimension contribution index (committee · voting · attendance ·
  bills · interpellations · speeches, from the psp.cz `tisky`/`interp`/`steno`
  dumps) and the **absentee-manager crossover** with ①: real money ties + low
  legislative effort.
- **③ Law-change forensics** (`lib/ingest/sources/psp-legislation.ts`,
  `lib/analysis/law-verdict.ts`, `scripts/data-analysis/{kg-legislation-ingest,esbirka-laws,kg-forensics}.ts`)
  — bill/law graph (`sponsors`/`amends` edges) + a forensics pass that contrasts a
  bill's stated reasoning (důvodová zpráva) against researched effects. An
  anti-fabrication gate checks every cited statute against the **e-Sbírka
  24,774-law registry**; findings land `pending_review`.

### Built through DataHub Lite — measured, not overclaimed

The analysis loop reads its context either locally or through a **DataHub Lite**
catalog, behind one `ContextProvider` toggle (`lib/analysis/context-provider.ts`).
An A/B over 8 real slices found the two arms **byte-identical (8/8, 0 diff)** — and
this was **confirmed over real HTTP** against a live read-only DataHub-OpenAPI
catalog (`scripts/data-analysis/lite-serve.ts`). So the metalayer is
*content-transparent*: its value is **delivery/portability** (a queryable, portable
catalog the orchestrator need not hand-carry), not analysis uplift. Full method +
result: **[`docs/data-analysis/ab-datahub-lite.md`](docs/data-analysis/ab-datahub-lite.md)**.

```bash
# populate the graph (needs a free Hlídač token; ARES + e-Sbírka are open):
HLIDAC_API_TOKEN=… npx tsx scripts/data-analysis/kg-money-ingest.ts   --chamber=PSP10 --commit
                    npx tsx scripts/data-analysis/kg-contribution-ingest.ts --commit
                    npx tsx scripts/data-analysis/kg-legislation-ingest.ts  --commit
                    npx tsx scripts/data-analysis/esbirka-laws.ts --enrich-graph --commit
                    npx tsx scripts/data-analysis/ab-datahub.ts    # the DataHub-Lite A/B
```

## Routes (`app/`)

| Route | Module | What it shows |
|---|---|---|
| `/` | Landing | Konstrukt poster: hemicycle, live re-weightable score, standings |
| `/dashboard` | Velín | Chamber aggregates, leaderboard → profiles, graph-event feed, module tiles |
| `/zebricek` | CivicScore | Full 200-MP leaderboard + histogram, party filter, Souboj head-to-head |
| `/poslanec/[id]` | Spis | The MP profile ("the real product"): pillars, votes with rebel markers, sourced money ties |
| `/hlasovani` | VoteTrack | Roll-call ledger + chamber hemicycle detail + club discipline board |
| `/penize` | FollowTheMoney | Entity-trail graph, kniha vazeb (verified/pending), IČO-join methodology |
| `/rozpocty` | BudgetMirror | Town vs peer-median metrics, debt trends, sortable peer table |
| `/zakony` | LawWatch | Paragraph diffs linked to the roll-call that voted them; bill pipeline |
| `/rentgen` | archived | Living reference for the runner-up art direction (noindex) |

## Architecture

- **`app/`** — thin routes; a `page.tsx` only mounts a feature and sets metadata.
- **`features/`** — one module per surface (`landing`, `dashboard`, `civicscore`, `profile`, `votetrack`, `money`, `budget`, `lawwatch`), each an orchestrator + `components/`.
- **`features/shared/components/`** — domain-agnostic primitive catalog; lint-enforced boundary — no imports from `features/*` or `lib/civic`.
- **`lib/civic/`** — deterministic, test-pinned **sample-data layer** the UI renders today (clearly labeled as mock in the UI).
- **`lib/ingest/` + `lib/analysis/` + `scripts/data-analysis/`** — the real pipeline above: source adapters, pure deterministic scorers + gates (fixture-tested), and the ingest/forensics scripts that write the graph.
- **`lib/db/`** — the embedded-Postgres store + repositories (`kg_node`/`kg_edge`, votes, provenance). See **[`docs/db-architecture-guide.md`](docs/db-architecture-guide.md)** for the measured which-engine-for-which-workload guide.
- **Design system** — tokens in `app/globals.css`, the "Konstrukt" visual language in **[`docs/DESIGN.md`](docs/DESIGN.md)**; custom ESLint rules enforce token, a11y, and reduced-motion discipline.

## Commands

```bash
npm run dev          # dev server (Next.js App Router)
npm run check        # THE gate: typecheck + lint + test — run before calling work done
npm run build        # production build
```

## Status

- **Accountability engine: BUILT + on `master`.** The real civic graph and all three
  cases (money · effort · law) are ingested, human-gated, provenance-stamped, and
  fixture-tested; the DataHub-Lite loop is measured content-transparent and
  transport-confirmed.
- **UI: still on the `lib/civic/` sample layer** — the five surfaces render a
  deterministic, clearly-labeled mock. **Wiring each module surface to the real
  graph is the next phase**, taken up per-case (money, effort, law, …) alongside
  UI/data development in parallel sessions.
- Conventions: **[`CLAUDE.md`](CLAUDE.md)**. Ingestion + case detail: **[`docs/data-analysis/`](docs/data-analysis/)**.
