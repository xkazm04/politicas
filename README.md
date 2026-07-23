# Politicas

Public-accountability platform for **Czech politics** — voting records, MP
scoring, laws, and municipal budgets over one shared entity graph
(person ↔ party ↔ company ↔ contract ↔ vote ↔ budget ↔ law). Five
interconnected modules — **CivicScore** (MP scoring), **VoteTrack** (roll-call
voting records), **FollowTheMoney** (money ties), **BudgetMirror** (town
budgets), **LawWatch** (law changes) — positioned as an empirical,
methodology-transparent source for the next elections. The UI is **Czech-first**
(`lang="cs"`, decimal commas via `lib/format.ts`), and the brand rule is an
**evidence-cited data doctrine**: every rendered number carries its source, and
ties render as dated, sourced facts — never accusations.

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
- **`features/shared/components/`** — domain-agnostic primitive catalog (`SourceNote`, `AnimatedScore`, `SectionRule`, `SectionHeading`, `RankDelta`); lint-enforced boundary — no imports from `features/*` or `lib/civic`.
- **`lib/civic/`** — deterministic, test-pinned **sample-data layer** (entities, votes, 200-MP leaderboard generator) that the whole UI is built against; `lib/format.ts` owns Czech number formatting.
- **Design system** — tokens originate only in `app/globals.css`, page grammar and the "Konstrukt" visual language live in **[`docs/DESIGN.md`](docs/DESIGN.md)**; four custom ESLint rules in `eslint-rules/` enforce token, a11y, and reduced-motion discipline.

## Commands

```bash
npm run dev          # dev server (Next.js App Router)
npm run check        # THE gate: typecheck + lint + test — run before calling work done
npm run typecheck    # tsc --noEmit
npm run lint         # eslint incl. 4 custom rules
npm run test         # vitest (lib/**/*.test.ts)
npm run build        # production build
```

## Status

All five modules have live, interconnected surfaces (Phases 1–3 complete). Data
is a **deterministic sample layer in `lib/civic/` — clearly labeled as a mock in
the UI — pending real ingestion** (psp.cz vote dumps, Hlídač, ARES, Registr
smluv). See **[`docs/ROADMAP.md`](docs/ROADMAP.md)** for the ingestion plan and
next priorities, and **[`CLAUDE.md`](CLAUDE.md)** for conventions.
