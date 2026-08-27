---
product: "Politicas"
stack: "Next 16 App Router + React 19 + TypeScript, Tailwind v4, embedded Postgres (PGlite) via lib/db, vitest"
vault: ["docs/spark"]            # no Obsidian vault on this machine — in-repo, TRACKED (like docs/architect)
vault_subdir: ""                 # docs/spark/ IS the Spark root: Spark.md, ideas/, sessions/
context_map: context-map.json
base_branch: master
active_runs_ledger: .claude/active-runs.md
locale_count: 2                  # messages/cs.json + messages/en.json — Czech is the source
---

# `/spark` project overlay — politicas

The method lives in the registry lane (`ai-registry/skills/spark`, linked at
`.claude/skills/spark`). This file is only what THIS repo is. Adopted 2026-08-27.

## Gates

- always: `npm run check` (typecheck → lint → test → test:rules → census:test → library:check)
- when a route or `app/**` file changed: `npm run build` (in a detached worktree if the shared
  tree's `.next` is suspect — memory/dirty-tree-build-failures-need-a-clean-probe.md)
- when `lib/db/pglite/schema*` / `CORE_DDL` changed: `npm run db:migrate -- --dry-run` first;
  never let a boot apply schema work
- builder: `npm run typecheck && npm run lint && npx vitest run <touched dirs>`

Lint runs at error level, no warning budget; `custom/require-source-citation` warnings under
`features/**` may go down, never up.

## Rituals

- Phase 0: register the run in `.claude/active-runs.md` (`## Live`) in ONE bash invocation
  (read + append), declaring the spark slug and the paths it will touch. Also `git status` and
  classify every dirty path as foreign / pre-existing / yours.
- Phase 6: move the ledger entry to `## Recently completed` with the SHA, one bash invocation.
- No translation pipeline and no decision-capture command exist here.

## Repo law

Paste verbatim into every builder brief:

1. Read `CLAUDE.md` (+ `AGENTS.md`), `docs/DESIGN.md` (Konstrukt — before any UI), and the
   `docs/routes/<route>.md` record of every route you touch. `node_modules/next/dist/docs/`
   before writing Next code — this Next has breaking changes.
2. **Every rendered number cites its source** (`SourceNote`). Derived/ungated values are labelled
   (`pending_review`). Nothing renders a figure the data does not carry. Violation = failed task.
3. Loaders: `features/**/get*Data.ts`, server-only, `getStore()` + `storeReady()`; failure →
   `null` + `reportLoaderFailure()`; the surface shows a labelled mock or `DataUnavailable`,
   never fiction. Reader-facing analyst prose goes through `lib/analysis/language-gate.ts`.
4. Routes stay thin (`app/**/page.tsx` mounts one feature + metadata). Colors only from
   `app/globals.css` tokens. Czech display numbers only via `lib/format.ts`. Check
   `features/shared/components/` (`@catalog`) before building a widget; shared primitives never
   import `features/*` or `lib/civic`.
5. Strings: Czech-first; `messages/cs.json` is the source, `messages/en.json` mirrors it.
6. Never add `eslint-disable`, never widen exemption zones in `eslint.config.mjs`.
7. Docs coupled to touched source (`docs/feature-doc-map.json`) update in the same change;
   route findings are appended to `docs/routes/<route>.md`, not to CLAUDE.md.
8. **Git: NEVER stage, NEVER commit, NEVER stash — only the Director touches the index.**
   Report the exact file list you changed. Never touch `.pglite/`, `.next/`, `data/raw/`.
9. PGlite is single-connection: never open the store while a dev server holds it; a "store
   won't open" is a holder or a torn copy, not code (see MEMORY.md traps).
10. State the constraint and the evidence, and counter-propose rather than guess.
11. (Director) The `commit-msg` doc-sync rung owes every coupled doc in `docs/feature-doc-map.json`
    a touch OR a `Doc-sync(<doc>): <reason>` trailer per doc (README.md, AGENTS.md, DESIGN.md,
    docs/ROADMAP.md are coupled to `features/**`); a map entry whose glob matches no file is a
    BLOCKING drift — register a new feature's globs only once its files exist.

Out-of-scope walls: no redesign of the Konstrukt direction; no new graph DB; no scoring formula
changes outside `lib/analysis/contribution.ts` + `/metodika` together.

## Wave defaults

One AskUserQuestion call of up to 4 questions per wave; the Phase-3 checklist as written in the
method. Design-direction forks may use a static canvas (`/design`) as comparison input.

## Question taste

- 2026-08-27: operator builds directly on master (no worktree) for a single-session spark — offer it as the first go-gate option, not the worktree.

## Skill improvement log

- 2026-08-27 election-replay: doc-sync commit-msg rung bounced 3 commits (dead globs, unknown coupled docs, header count) → Repo law 11. Scout read prop REGISTRY not prop VALUES: `electoral_arena` wrong for 1 296 obce. A brief asserted `asciiFold` in a module that lacks it — verify helper symbols before naming them in a contract. Go-gate: operator builds on master; worktree offered second now.
