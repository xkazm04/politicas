# `/explorer` project overlay — politicas

The method lives in the registry lane (`ai-registry/skills/explorer`, linked at
`.claude/skills/explorer`). Everything below is **this repo's** substitution for the
personas-shaped defaults the lane body still names. Where the two disagree, this file wins.

Extracted 2026-08-24 from the project-owned copy that previously shadowed the lane skill at
`.claude/skills/explorer/SKILL.md`.

## Substitutions for the lane body

| Lane body says | politicas uses |
| --- | --- |
| Obsidian vault at `C:/Users/kazda/Documents/Obsidian/personas` (Phase 0) | **No Obsidian vault.** Memory root is in-repo at `docs/explorer/`, mirroring `/architect`'s `docs/architect/`. Skip Phase 0's vault resolution + abort; run its bootstrap against `docs/explorer/` instead. |
| `.claude/codebase-context.md` (8 groups / 49 contexts) | `context-map.json` at the repo root — 10 groups / 48 contexts, each with `filePaths`. The only taxonomy authority here; if it is missing, stop (a Vibeman context rescan is the remedy — there is no `/refresh-context`). |
| `.claude/codebase-stack.md` | Not present. Use `CLAUDE.md` (+ the `@AGENTS.md` it includes) and `docs/DESIGN.md`; **skip Phase 1a's required-file check for it.** |
| `$VAULT/Patterns/explorer-preferences.md` | `docs/explorer/preferences.md` |
| `$VAULT/Lessons/{date}-explorer.md` | `docs/explorer/lessons/{date}.md` |
| `$VAULT/Architect/strong-patterns.md`, `backlog.md` | `docs/architect/strong-patterns.md`, `docs/architect/backlog.md` — read-only from here. |
| Category `i18n` | Replaced by **`data`** (provenance / sourcing / mock-vs-real honesty) — the highest-value category in this repo. Content is Czech-first and there is no multi-locale extraction pipeline to satisfy; locale defects file under `ui`. |
| Rust / cargo / Tauri / test-automation harness | None. Single Next.js + TypeScript app, no automated UI harness. |

## Reference files (Phase 1b read order)

1. `context-map.json` — area taxonomy (10 groups, 48 contexts, `filePaths`, `index` one-liners).
2. `CLAUDE.md` (+ `AGENTS.md`) — route map, code structure, conventions, quality gates, git discipline, known gotchas, current in-flight status.
3. `docs/DESIGN.md` — the design-system source of truth. **Mandatory before any `ui` item.**
4. `MEMORY.md` — the durable-decision index; open any `memory/*.md` entry touching your area so you do not resurface a settled question.
5. `docs/architect/strong-patterns.md` — prefer the shape of an existing strong pattern over inventing one; reference it in `strong_pattern_ref`. Skim `docs/architect/backlog.md` so you do not surface something `/architect` already queued.
6. `docs/explorer/preferences.md`, `state.md`, `coverage.md`, `passes.md`, then the 3 most recent `docs/explorer/lessons/*.md`.

Freshness (Phase 1d): parse `generatedAt` / `revision` in `context-map.json`; warn if >30 days
old or `git rev-list --count HEAD` has advanced >200 since. A file that belongs to no context
is itself a finding.

## Memory root — `docs/explorer/` (Phase 0 bootstrap; create if missing)

| Path | Holds |
| --- | --- |
| `docs/explorer/sweeps/` | one note per run — the canonical artifact |
| `docs/explorer/state.md` | informational claim board (which areas are being explored right now) |
| `docs/explorer/coverage.md` | last visit per area + yield density |
| `docs/explorer/passes.md` | per-area "already considered and rejected" fingerprints; future passes skip these |
| `docs/explorer/preferences.md` | distilled rules across runs (promoted from lessons) |
| `docs/explorer/lessons/{date}.md` | append-only self-reflection |

Header-only skeletons are enough at bootstrap. **Do not touch `docs/architect/`** — that is
`/architect`'s memory, read-only from here.

## Q1 — Area menu

Options map 1:1 to the groups in `context-map.json`. Read them at run time; this is a
convenience copy, not the authority:

| Group | Contexts |
| --- | --- |
| Landing & Navigation | app-shell · dashboard-instruments · dashboard-state-graph · landing-page · shell-navigation |
| MP Profiles & Rankings | civicscore-leaderboard · civicscore-lens-duel · contribution-scoring · mp-profile · mp-rankings-routes |
| Voting & Legislation | lawwatch · votetrack-kompas · votetrack-ledger · voting-legislation-routes |
| Financial Transparency | budget-mirror · kg-analysis · money-budget-routes · money-cases-review · money-ledger-graph |
| Civic Feed & Transparency | civic-chronicle · civic-feeds-verification · claim-verifier · schranka-notifications |
| Knowledge Graph Explorer | graph-explorer |
| Data Ingestion | czech-civic-data-parsing · effort-case-loop · ingest-external-sources · ingest-psp-sources · kg-pipeline · law-amends-analysis · law-collision-analysis · law-triage-batch · money-analysis-triage · money-contract-ingest |
| Data Layer | db-repositories · db-store |
| Shared UI Primitives | civic-kg-primitives · shared-primitives · shared-provenance |
| Infrastructure & Observability | admin-control · analysis-quality · app-config · civic-transparency-eslint-plugin · db-hybrid-benchmarks · eslint-rules-shims · graph-admin-data-routes · observability · testing-sentinel |

## Q2 — Category menu

`quality | dx | ui | perf | bug | data | a11y | sec` (`data` in place of the lane's `i18n`).

## Phase 2b — auto-pick penalties

Beyond staleness and yield density: score 0 for any context holding an active claim in
`docs/explorer/state.md`, and for any context under active redesign per `CLAUDE.md`'s status
section, unless the user asked for it by name.

## Phase 4b — hard exclusions (politicas-specific)

- **Nothing `npm run lint` already catches.** The custom rules in
  `packages/eslint-plugin-civic-transparency/rules/` — `no-hardcoded-colors`,
  `no-raw-number-display`, `no-server-import-in-client`, `no-silent-catch`,
  `no-silent-null-catch`, `require-source-citation`, `role-button-requires-keydown`,
  `enforce-reduced-motion-fallback` — run at **error** level and the tree is clean; a violation
  would fail the gate, not sit as backlog. Surface the **gap in the rule** instead (a case it
  misses, an exclusion in `eslint.config.mjs` hiding real violations) — that is a real item.
  (`eslint-rules/*.cjs` are compat shims for the same rules.)
- **Not "rewrite the mock as real data."** `lib/civic/` is a deliberate, test-pinned fallback
  (`MEMORY.md` -> sample-data-first). Porting a surface to the graph is an `/architect` or
  `/friend` job. A **mislabelled** mock — sample numbers rendered as if sourced — IS an item,
  and a severe one.

## Phase 4b — what to look for, by category

**quality** — dead code, unreachable branches, unused exports; duplicated logic (3+ near-identical blocks); misleading names / leaking abstractions; comments explaining "what" not "why"; commented-out code older than the branch.

**dx** — test-setup boilerplate that could be a fixture; a `lib/` invariant with no colocated vitest test; a `get*Data.ts` loader whose `null` fallback path is untested (the mock/real seam is where regressions hide); repeated try/catch boilerplate; catches that log without context; a route `page.tsx` doing work that belongs in its feature; build hot-paths; errors thrown without enough info to debug.

**ui** — hand-rolled duplicates of primitives already in `features/shared/components/` (look for `@catalog` JSDoc tags — check the catalog before flagging *and* before fixing); a shared primitive importing from `features/*` or `lib/civic` (lint-enforced boundary; data comes in via props); reproducible visual bugs; drift from `docs/DESIGN.md` (spacing/radius/rule-weight, a color that is not an `app/globals.css` token); missing loading / empty / error states (the money and law surfaces have real empty cases); a rendered number without a `SourceNote` (file under `data` when the defect is sourcing rather than layout); Czech copy defects — an English string leaking into the UI, a number formatted with `.toFixed` / `toLocaleString` instead of `lib/format.ts` (decimal commas); a11y gaps that double as UX gaps.

**perf** — unnecessary re-renders (literals in deps, missing memoization, a whole feature re-rendering on hover/pin); N+1 queries in a `lib/db/` repository loop; large lists / graphs without virtualization or a bounded node budget; `useEffect` cascades; subscriptions, rAF loops, timers and canvas listeners that do not clean up; synchronous render-path work that belongs in the server loader; a recharts `ResponsiveContainer` in a grid track without `min-w-0` + a fixed-aspect `overflow-hidden` wrapper — a known livelock (CLAUDE.md -> known gotchas), rate it `high`.

**bug** — race conditions (state read-then-write without a transaction, async effects without abort); unhandled edge cases (empty arrays, null/undefined, NaN); stale closures; off-by-one / boundary errors; wrong hook dependency arrays; silently swallowed errors; SVG coordinates from trig not rounded to 2dp (SSR/CSR float drift trips hydration — see `Hemicycle.tsx`); a link built from a mock slug where the route expects a real id (`/poslanec/[id]` takes a psp.cz id — see `MEMORY.md`).

**data** (the brand rule — the highest-value category here) — a rendered number with no `SourceNote` / no citation path back to a source; sample data (`lib/civic/`) presented as if sourced, or a real/mock boundary the user cannot see; a derived or unverified fact rendered as established (human-gated ties, `pending_review` verdicts and derived posudky must render as such and must never feed a score); a number computed in the view layer that disagrees with the `lib/` function that owns it (`score` must equal `composite(pillars)`; the colocated test enforces it — a second implementation is the defect); fabricated structure (a stage, diff or trend the graph carries no data for — removing it is the fix, inventing it is the sin); a loader whose `null` fallback silently swaps real data for mock without saying so on screen.

**a11y** — missing labels on form inputs; low-opacity foreground tokens on tinted surfaces (contrast); clickable divs without role/tabIndex (`role-button-requires-keydown` catches the keydown half only); missing focus styles; modal/drawer without focus trap, escape handler or backdrop click; looping motion without a `prefers-reduced-motion` fallback (WCAG 2.3.3) — canvas/rAF animation the custom rule cannot see; `lang`/locale correctness (Czech content marked up as anything but `cs`).

**sec** — externally reachable surfaces (route handlers, server actions, the `/admin` console) without validation or an auth gate; user input interpolated into a SQL string instead of a parameterized query in `lib/db/`; server-only code (`getStore()`, `server-only` modules, secrets) reachable from a `"use client"` boundary (`no-server-import-in-client` covers the import, not a leaked value passed through props); credentials or absolute local paths in logs, error messages or Sentry payloads. **Auto-promote sec findings to `critical`.**

## Phase 5 — item fields

Add to the lane's schema, in place of its i18n field:

```yaml
  copy_impact: "<none | new Czech UI copy | changes a rendered number's source note>"
```

Severity rubric addition: **critical** also covers a truth defect — a fabricated, uncited or
mislabelled number on a public surface.

## Phase 7 — execution gate

- **`npm run check` is THE gate** = `typecheck && lint && test && test:rules && census:test && library:check`. It must pass before every commit. Fast inner loops may use the legs (`npm run typecheck`, `npm run lint`, `npm run test`).
- Lint runs at error level; there is no warning budget.
- **Stage scoped + verify + commit in ONE bash invocation** — `git add path/one path/two && git diff --cached --stat` — concurrent sessions rewrite the index between separate calls. If the cached stat lists more files than you added, `git restore --staged <path>` each unrelated file and re-verify. Never `git add -A` / `.` / `-u`, never `git stash`, `git reset --hard`, `git clean`, or `git restore` / `git checkout --` on paths this run did not author.
- Conventional Commits + Co-Authored-By footer + a body explaining the why. No `--no-verify`, no `--amend`.

## Phase 7 — frontend non-negotiables

Same list as `/architect`'s overlay: `app/globals.css` tokens only; every rendered number cites
its source via `SourceNote`; Czech-first copy with numbers through `lib/format.ts`; check
`features/shared/components/` before building a widget (and keep it free of `features/*` /
`lib/civic` imports); routes stay thin (server page -> `get*Data.ts` loader -> typed props into
the `"use client"` feature; `/hlasovani` + `features/votetrack/` is the template); extend
`lib/civic/` rather than inlining a mock; mind the recharts and SVG-trig gotchas.

**Visual verification:** there is no automated UI harness. Either run `npm run dev` and exercise
the affected route (say which route and what you saw), or state explicitly — in the commit body
**and** the run record — that you have **NOT** visually verified. Do not claim "looks good" from
code review alone.

## Phase 9e — pattern promotion targets

- Option 1: `docs/explorer/preferences.md` — the skill's own taste memory (calibration preferences).
- Option 2: the project memory system — `memory/<slug>.md` (terse `name` + `description` frontmatter) + a one-line entry in `MEMORY.md`, per CLAUDE.md -> "Agent memory". The bar is high: worth recalling in three months **and** not derivable in ten seconds from `docs/`.

## Phase 10 — Next? menu

`/friend` is not installed in this repo; offer `/architect resume` (drain `docs/architect/backlog.md`)
as the escalation instead.
