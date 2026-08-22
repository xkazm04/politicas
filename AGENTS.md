<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Politicas — agent orientation

Public-accountability platform for Czech politics: five modules (CivicScore,
VoteTrack, FollowTheMoney, BudgetMirror, LawWatch) over one shared entity graph
(person ↔ party ↔ company ↔ contract ↔ vote ↔ budget ↔ law). **Czech-first** —
`lang="cs"`, Czech copy, decimal commas via `lib/format.ts`.

## Commands

```bash
npm run dev          # dev server (next dev, Turbopack)
npm run check        # THE gate: typecheck && lint && test — run before calling work done
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (incl. the custom rules in eslint-rules/)
npm run test         # vitest run
npm run build        # next build
npm start            # next start — NOT the supported path: next.config.ts sets
                     #   output: "standalone". See that option's comment (and
                     #   docs/deploy/container.md §5b) for the correct recipe.
```

`package.json` also declares `da:*` (data-analysis / knowledge-graph pipeline)
and `hybrid:*` (benchmark) scripts run via `tsx` — these drive the offline
ingest and analysis loops, not the app.

## Architecture in one paragraph

`app/` holds thin routes only — a `page.tsx` mounts one feature component and
sets metadata. Each surface lives in `features/<module>/` as an orchestrator
component plus `components/`; `features/shared/components/` is a
domain-agnostic primitive catalog that must not import from `features/*` or
`lib/civic` (lint-enforced). Data comes from an embedded Postgres (PGlite) via
`lib/db/` — a server page `await`s a server-only loader (`features/**/get*Data.ts`,
which calls `getStore()` and `storeReady()`) and passes typed props into a
`"use client"` feature; every loader converts failure into `null`, and the page
then falls back to the labelled sample data in `lib/civic/`. Domain computation
(scores, verdicts, graph shaping) lives in `lib/analysis/` and `lib/kg/` with
colocated vitest tests; ingest adapters live in `lib/ingest/`. Colors originate
only in `app/globals.css` tokens, and **every rendered number cites its source**
(`SourceNote`) — that is the brand rule, not a style preference.

## Deeper sources

- **`CLAUDE.md`** — conventions, the route table, quality gates, definition
  of done, known gotchas. Read this before touching code.
- **`docs/routes/<route>.md`** — one file per surface: the full dated record of
  what that route derives, what it refuses to derive, and why. Read the file for
  the route you are about to touch, and append new findings there rather than to
  CLAUDE.md.
- **`docs/DESIGN.md`** — the design-system source of truth (Konstrukt). Read
  before any UI work.
- **`context-map.json`** (repo root) — every file mapped to a context and
  business-domain group. Use it to scope edits; `docs/feature-doc-map.json`
  maps those same source paths to the docs they keep in sync.
- **`MEMORY.md` + `memory/*.md`** — durable cross-session facts and gotchas
  already paid for.
