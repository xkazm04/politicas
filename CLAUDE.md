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

## Status — executing the design doc

**Konstrukt won** (Sutnar functionalist poster) — canonical reference:
**[docs/DESIGN.md](docs/DESIGN.md)** (read before any UI work). Runner-up
**Rentgen** is a living reference at `features/labs/rentgen/` (`/rentgen`,
noindex). Future surface exploration uses the `prototype` skill.

All five politicas.md modules have surfaces, and every one of them is wired to
the real knowledge graph (`kg_node`/`kg_edge`, embedded Postgres via `lib/db/`);
the `lib/civic` mock survives **only as the labelled fallback** (loader returns
`null` → mock). Pattern: an `async` server page awaits a server-only loader
(`features/**/get*Data.ts` → `getStore()` + `storeReady()`) and passes typed
props into a `"use client"` feature — `/hlasovani` +
`features/votetrack/getVoteThemes.ts` is the template. Graph provenance lives in
`docs/data-analysis/{graph-schema,coverage-ledger,graph-log}.md`. Next:
election-cycle hardening per politicas.md §9 Phase 4.

### Route map

Each row links the route's **detail file** — the full, dated record of what that
surface derives, what it refuses to derive, and why. **Read the detail file for
the route you are about to touch**; do not work from this table alone.

| Route | Feature | What it is | Detail |
| --- | --- | --- | --- |
| `/` | `features/landing` | Konstrukt landing; hero ranking + hemicycle + specimen ride the real leaderboard loader, source panel rides `/atlas` | [landing.md](docs/routes/landing.md) |
| `/dashboard` | `features/dashboard` | Velín — instrument panel: state-graph slice, dated-fact feed, leaderboard ledger, module tiles | [dashboard.md](docs/routes/dashboard.md) |
| `/poslanec/[id]` | `features/profile` | Spis — the MP case file: score + six components, work dossier, money ties, rebellions, career spine | [poslanec.md](docs/routes/poslanec.md) |
| `/zebricek` | `features/civicscore` | CivicScore leaderboard: 207 MPs, competition ranks, reader lens, Souboj duel | [zebricek.md](docs/routes/zebricek.md) |
| `/metodika` | `features/civicscore` | The formula itself — every figure imported from `lib/analysis/contribution.ts`, never a literal | [metodika.md](docs/routes/metodika.md) |
| `/hlasovani` | `features/votetrack` | VoteTrack: ledger + chamber detail + discipline board + seismograf; chamber self-reconciliation | [hlasovani.md](docs/routes/hlasovani.md) |
| `/penize` | `features/money` | FollowTheMoney: tie ledger, money graph, review console, MP/company case files, kauzy, střety | [penize.md](docs/routes/penize.md) |
| `/rozpocty` | `features/budget` | BudgetMirror: 132 towns, MONITOR series, peer mirror, supplier trail | [rozpocty.md](docs/routes/rozpocty.md) |
| `/zakony` | `features/lawwatch` | LawWatch: 141 bills → 101 laws, forensic register, sector attribution, kolize | [zakony.md](docs/routes/zakony.md) |
| `/volby` | `features/volby` | Volby: zrcadlo - the flagship voter surface: "Kde volite?" lookup, ballot-keyed subjects (obec/kraj as zadavatel, elected party lists), a severity ledger of findings composed at read time, a dated-outcome timeline; no composite score | [volby.md](docs/routes/volby.md) |
| `/denik` | `features/denik` | Deník republiky — the chronological dated record + RSS/JSON feeds | [denik.md](docs/routes/denik.md) |
| `/schranka` | `features/schranka` | Follow list with no account: localStorage keys, server-derived deltas, feeds | [schranka.md](docs/routes/schranka.md) |
| `/overeni`, `/zdroj` | `features/overeni` | Civic Claim Gate — re-derives a pasted citation against today's record | [overeni.md](docs/routes/overeni.md) |
| `/data` | `features/data-releases` | Release train of the data layer + the app's feed address book | [data.md](docs/routes/data.md) |
| `/atlas` | `features/atlas` | Per-source data-quality scorecard; unrated is structurally never zero | [atlas.md](docs/routes/atlas.md) |
| `/graf` | `features/graph` | Whole-graph canvas playground (bare route, owns the viewport) | [graf.md](docs/routes/graf.md) |
| `/graf/p/[ref]` | `features/graph` | Citation permalink card + OG image; staleness posts above the content | [graf-permalink.md](docs/routes/graf-permalink.md) |
| App shell, 404, errors | `features/shell` | Nav rail, `not-found`, error boundaries, robots/sitemap, per-route payload | [app-shell.md](docs/routes/app-shell.md) |
| Graph writers | `scripts/data-analysis` | `kg-compute` / `kg-promote` reset + prop-merge safety rules | [graph-writers.md](docs/routes/graph-writers.md) |
| `/rentgen` | `features/labs/rentgen` | Archived art direction (noindex) | — |

**Keep this file small.** The route detail files are the append-only record; a
new finding goes in `docs/routes/<route>.md`, and this table only changes when a
route's one-line identity changes. CLAUDE.md is loaded into every session's
context — prose that belongs to one surface belongs in that surface's file.

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
npm run check        # THE gate: typecheck + lint + test + test:rules + census:test
                     #   + library:check — run before calling work done
npm run typecheck    # tsc --noEmit
npm run lint         # eslint incl. the 8 custom rules (see below)
npm run test         # vitest (lib/**, features/**, scripts/**, packages/*/src/**)
npm run build        # production build
npm run kpi:citations # METER, not a gate: citation coverage with a denominator
npm run kpi:verify    # METER: every check stage run independently + pass rate
```

The two `kpi:*` commands are meters, deliberately outside the gate — both gates
report failures only, so neither can produce a ratio (`docs/kpi-meters.md` has
the reasoning, the baselines and what they still cannot see).

Store housekeeping, none of it in the gate (they touch the data dir, not the
code): `npm run db:backup` (CHECKPOINT + copy, pruned to the last N),
`npm run db:accounting` (per-table rows/bytes/share + each table's declared
retention). PGlite is single-connection, so both refuse a store something else
is holding — point `PGLITE_PATH` at a copy instead. Checkpointing itself is no
longer manual: `lib/db/pglite/maintenance.ts` takes the pass when no operation
is in flight, because the alternative is not "no checkpoint" but the engine's
inline `max_wal_size` one, landing in the middle of somebody's write.

**Schema changes go through `npm run db:migrate`**, not through booting the app.
`open()` replays `CORE_DDL` at every boot, so a boot that would CHANGE the schema
is otherwise indistinguishable from the thousand that re-assert it — it now
compares the DDL's declarations against the catalog and says, loudly, that it is
applying schema work with no snapshot (and refuses outright if the DDL ever grows
a destructive statement). `db:migrate` does the same apply with the door held
open: detect → snapshot → verify by reopening the copy → apply → re-check.
`npm run db:restore -- --from=… --yes` is the way back, and it moves the damaged
store aside rather than deleting it.

`npm run check` and CI are NOT the same set, and neither is a superset: `check`
adds `census:test` + `library:check`; CI adds the schema-snapshot drift check and
`build`. `npm run census` (the golden-path ratchet) is in neither — its rule
registry is deliberately empty (`scripts/census/rules.json`: 0 adopted, 2
satisfied, 7 declined), and the ported runner treats an empty registry as a
structural failure, so the command cannot exit 0 today. `npm run library:check`
is the live half of that mechanism and IS gated.

Custom ESLint rules — **nine**, and their canonical source is the in-repo
package `packages/eslint-plugin-civic-transparency/` (`eslint-rules/*.cjs` are
one-line compat shims; `npm run test:rules` asserts the shims and the package
stay one implementation). `eslint.config.mjs` registers them under the
historical `custom` prefix rather than spreading the package's `recommended`
preset, so the repo's rule IDs, severities and path scopes stay exactly as
written there — the presets exist for external adopters. Six are error-level
everywhere; the three doctrine rules are scoped to reader-facing surfaces (see
the config):
- `custom/no-hardcoded-colors` — token discipline (politicas-specific)
- `custom/no-silent-catch` — empty catch blocks swallow errors
- `custom/role-button-requires-keydown` — a11y for click-role elements
- `custom/enforce-reduced-motion-fallback` — WCAG 2.3.3 for looping motion
- `custom/no-server-import-in-client` — the server-only loader boundary; since
  2026-09-01 with `typeImports: "forbid"`, so a `"use client"` file imports nothing
  from a `get*`/`*Loader` module, not even a type — prop types live in a sibling
  pure `*Types.ts` (`features/votetrack/themeTypes.ts` is the canonical shape)
- `custom/no-silent-null-catch` — scoped to `features/**/get*.ts` +
  `features/**/*Loader.ts`: a `catch { return null }` must call
  `reportLoaderFailure()` so a degradation to fallback leaves a trace
- `custom/no-raw-number-display` — reader-facing numbers go through
  `lib/format.ts`. `error` under `app/**` AND `features/**` since 2026-08-24
  (measured 0 violations repo-wide; the ratchet graduated)
- `custom/require-source-citation` — every rendered figure's file carries a
  provenance element. `error` under `app/**`, `features/**` AND `components/**`
  since the second ratchet closed 2026-08-24 (off under `features/labs/**`); the
  11-violation inventory it was warning against is gone, measured 0. It also
  takes `{ census: true }`, which reports every rendered figure cited or not —
  that is where `npm run kpi:citations` gets a denominator the gate cannot give
- `custom/no-source-note-size-override` — no font-size utility in a
  `<SourceNote>` className; the citation primitive sets its own size by
  measuring its children (`docs/DESIGN.md` §3). `error` under `app/**` AND
  `features/**` since 2026-08-24, at a measured 0 after 72 overrides across
  29 files were removed in 776f01a

CI: `.github/workflows/ci.yml` — live on `xkazm04/politicas` (the repo split
happened). Runs typecheck → lint → test → test:rules → schema-snapshot drift →
build, plus a non-blocking `npm audit --audit-level=high`. `lefthook.yml` is
installed via the `prepare` script: pre-commit lints staged files, pre-push runs
typecheck + test. The commit rung blocks on **errors only** — `npm run lint` sets
no `--max-warnings`, so a warn-level rule can never refuse a commit; it is there
to be *read*. (`--quiet` was removed from the hook on 2026-08-24: fault-injected
on a file with one `require-source-citation` warning, exit was 0 either way, so
the flag suppressed the display without adding any enforcement.)

**CI pins `node-version: 24` deliberately.** The lockfile is written by npm 11
(node 24); npm 10 (node 22) places optional peer deps differently, so a node-22
runner fails `npm ci` with a permanent phantom "lock file out of sync" for
`@emnapi/runtime` / `@swc/helpers`. Do not lower it.

## Definition of done

Work is done when every line below holds. No partial credit — "green except…"
is not green.

- [ ] `npm run check` passes (typecheck → lint → test → test:rules → census:test
      → library:check). Run it, don't assume it.
- [ ] **Every rendered number cites its source** (`SourceNote`). Derived or
      ungated values are labelled as such (`pending_review`); nothing renders
      a figure the data doesn't actually carry. This is the brand rule — a
      violation is a failed task, not a nit.
- [ ] Fallbacks stay honest: a loader that returns `null` calls
      `reportLoaderFailure()` (`lib/db/loaderGuard.ts`), and the surface shows
      a labelled mock or an honest empty state (`DataUnavailable`) — never
      plausible fiction presented as real.
- [ ] The nine custom ESLint rules pass **unsuppressed** — all nine at `error`
      on the reader-facing tree, all nine measured at 0. Fix the code; do not
      disable a rule, add an `eslint-disable`, or widen an exemption zone in
      `eslint.config.mjs`. Citation coverage additionally has a meter with a
      denominator (`npm run kpi:citations`, baseline in `docs/kpi-meters.md`):
      a change that adds an uncited figure fails the gate, and a change that
      adds a `// citation-ok:` instead of a source moves the meter without
      failing anything — read both.
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

This project is organized into **50 contexts** across **10 groups**. The full machine-readable map lives in `context-map.json` at the project root — read it at task start to scope your edits to the relevant context's files.

Taxonomy: each context has a `category` (ui · api · lib · data · test · config); each group has a `domain` (feature · infrastructure · shared · integration · data).

### Groups

- **Landing & Navigation** _(domain: feature · 5 contexts)_
- **MP Profiles & Rankings** _(domain: feature · 5 contexts)_
- **Voting & Legislation** _(domain: feature · 4 contexts)_
- **Financial Transparency** _(domain: feature · 5 contexts)_
- **Data Ingestion** _(domain: integration · 10 contexts)_
- **Data Layer** _(domain: data · 2 contexts)_
- **Shared UI Primitives** _(domain: shared · 3 contexts)_
- **Infrastructure & Observability** _(domain: infrastructure · 10 contexts)_
- **Knowledge Graph Explorer** _(domain: feature · 1 contexts)_
- **Civic Feed & Transparency** _(domain: feature · 4 contexts)_

> Auto-generated by Personas on each context scan. Edits between the markers are overwritten on the next scan; edit `context-map.json` or rescan instead.
<!-- personas:context-map:end -->
