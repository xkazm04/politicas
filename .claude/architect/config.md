# `/architect` project overlay — politicas

The method lives in the registry lane (`ai-registry/skills/architect`, linked at
`.claude/skills/architect`). Everything below is **this repo's** substitution for the
personas-shaped defaults the lane body still names. Where the two disagree, this file wins.

Extracted 2026-08-24 from the project-owned copy that previously shadowed the lane skill at
`.claude/skills/architect/SKILL.md`.

## Substitutions for the lane body

| Lane body says | politicas uses |
| --- | --- |
| Obsidian vault at `C:/Users/kazda/Documents/Obsidian/personas` (Phase 0) | **No Obsidian vault.** Memory root is in-repo at `docs/architect/`. Skip Phase 0's vault resolution + abort; run the Phase 0 bootstrap against `docs/architect/` instead. |
| `.claude/codebase-context.md` (area taxonomy) | `context-map.json` at the repo root — the only taxonomy authority here. |
| `.claude/codebase-stack.md` | `CLAUDE.md` (+ the `@AGENTS.md` it includes) and `docs/DESIGN.md`. There is no stack snapshot; **skip Phase 1a's required-file check for it** and skip Phase 10e's `codebase-stack.md` update check. |
| `.claude/Design.md` | `docs/DESIGN.md` |
| `$VAULT/Patterns/architect-preferences.md`, `$VAULT/Lessons/{date}-architect.md` | No preferences file and no Lessons folder. Cross-session learnings go to the project memory system: `memory/<slug>.md` + a one-line entry in `MEMORY.md` (CLAUDE.md → "Agent memory"). Bar: worth recalling in 3 months **and** not derivable from `docs/`. |
| `docs/architecture/cli-coordination.md` (coordination rationale link) | Not present. The ledger convention itself is in `CLAUDE.md` → "Concurrent CLI sessions". |
| Worktree-by-default isolation (Phase 7a) | **Default: commit on the current branch.** Offer an `architect/<slug>` branch only when clean separation genuinely matters; never push toward branching or worktrees. |
| Rust / cargo / Tauri references | None. This is a single Next.js + TypeScript app. |

## Reference files (Phase 1b read order)

1. `CLAUDE.md` (+ `AGENTS.md`) — route/feature structure, token discipline, the source-citation brand rule, git discipline, known gotchas, concurrent-session rules.
2. `context-map.json` — scope resolution (10 groups / 48 contexts, each with `filePaths`). Authority when any doc disagrees with reality.
3. `docs/DESIGN.md` — read in full before any UI-relevant scan.
4. `MEMORY.md` — the durable-knowledge index; open any `memory/*.md` entry touching the scope.
5. `docs/architect/{strong-patterns,weak-patterns,backlog,coverage}.md`.
6. `docs/data-analysis/*.md` — for knowledge-graph / analysis work.

Freshness (Phase 1c): parse `generatedAt` / `revision` in `context-map.json`; warn if >30 days
old or `git rev-list --count HEAD` has advanced >200 since. There is no `/refresh-context`
command here — the remedy is a Vibeman context rescan.

## Memory root — `docs/architect/`

| Path | Holds |
| --- | --- |
| `docs/architect/scans/` | one note per scan run (the Phase 11 synthesis) |
| `docs/architect/decisions/` | one ADR per accepted decision, `{YYYY-MM-DD}-{slug}.md` |
| `docs/architect/backlog.md` | durable queue of accepted decisions (Pending / Shipped / Abandoned) |
| `docs/architect/strong-patterns.md` | load-bearing patterns kept for codification |
| `docs/architect/weak-patterns.md` | anti-patterns with reach data |
| `docs/architect/coverage.md` | themes/areas scanned, staleness, yield density |

Phase 0 bootstrap: if the directory or any file is missing, create it with empty-section
skeletons (Pending/Shipped/Abandoned for the backlog; a Patterns heading for the pattern
files; Themes/Areas for coverage).

`docs/explorer/` is `/explorer`'s memory — read-only from here.

## Coordination

Register the run in `.claude/active-runs.md` before materially editing the tree (CLAUDE.md →
"Concurrent CLI sessions"). Ledger edits are a **single bash invocation** (read + append in one
command). Declared paths for `/architect` here:

- `docs/architect/scans/<run>.md`, `docs/architect/decisions/<adr>.md`, `docs/architect/{backlog,strong-patterns,weak-patterns,coverage}.md`
- Working tree: typically a subset of `app/`, `features/`, `lib/`, `packages/`, `scripts/`
- Always: `.claude/active-runs.md`

## Q2a — Theme menu (scan mode)

```
Theme? (Enter = pick for me)
  1. other -> describe (free-form)
  2. data-loading-boundary   (server loader -> client feature, mock fallback)
  3. state-management
  4. error-handling
  5. data-modeling           (kg schema, repositories, store)
  6. testing-strategy
  7. type-safety
  8. i18n-and-formatting     (cs-first, lib/format.ts, messages/*)
  9. design-token-discipline
  10. provenance-and-sourcing (SourceNote, mock-vs-real honesty)
  11. pick for me   <- default (uses docs/architect/coverage.md staleness)
```

## Q2b — Area menu (area mode)

Options map 1:1 to the groups in `context-map.json` — currently:
Landing & Navigation · MP Profiles & Rankings · Voting & Legislation · Financial Transparency ·
Civic Feed & Transparency · Knowledge Graph Explorer · Data Ingestion · Data Layer ·
Shared UI Primitives · Infrastructure & Observability.

Read the groups from `context-map.json` at run time rather than trusting this list — it is a
convenience copy, not the authority.

## Validation gate (Phase 7c baselines, 7d per-step, 7e final sweep)

- **The gate is `npm run check`** = `typecheck && lint && test && test:rules && census:test && library:check`.
- Fast inner loops may use the legs: `npm run typecheck`, `npm run lint`, `npm run test`.
- Risky changes also run `npm run build`.
- Lint runs at **error** level; there is no warning budget.
- Compare against the **baseline delta**, not absolutes — other sessions share the tree.

## Git discipline (Phase 7c/7d — non-negotiable, per CLAUDE.md)

Do NOT require a clean tree. Classify each dirty path (someone else's in-flight / pre-existing
in your touch zone -> surface it / yours). **Forbidden at all times:** `git stash`,
`git reset --hard`, `git restore` / `git checkout --` on paths this run did not author,
`git clean`, and `git add -A` / `.` / `-u`. Stage per-file, always; stage-verify-commit in one
bash invocation and re-check `git diff --cached --stat` before committing.

## Phase 7B — codification vehicles

| Vehicle | How it lands here |
| --- | --- |
| **lint-rule** | `packages/eslint-plugin-civic-transparency/rules/*.cjs` — follow the shape of the eight existing rules (`no-hardcoded-colors`, `no-raw-number-display`, `no-server-import-in-client`, `no-silent-catch`, `no-silent-null-catch`, `require-source-citation`, `role-button-requires-keydown`, `enforce-reduced-motion-fallback`), register in `index.cjs` + `eslint.config.mjs`, add a `__tests__` case (`npm run test:rules`). `eslint-rules/*.cjs` are compat shims — do not add new rules there. Error level per project policy, but warn first if the violation count is large. |
| **docs-claude** | a convention in `CLAUDE.md` / `AGENTS.md` |
| **docs-design** | a section in `docs/DESIGN.md` |
| **test-guard** | a vitest structural test walking the tree |

Combinations are fine — one commit each. Then update the `strong-patterns.md` entry
(codification status, date, ADR link) and write a mini-ADR
(`docs/architect/decisions/{date}-codify-{slug}.md`).

## Phase 7g — frontend rules (non-negotiable)

- Colors only via `app/globals.css` tokens (lint-enforced; the declared exceptions are in `docs/DESIGN.md`).
- **Every rendered number cites its source** via `SourceNote` — the brand rule. A number you cannot cite may not ship.
- Czech-first strings via `messages/cs.json` + `messages/en.json`; Czech number formatting via `lib/format.ts` (decimal commas) — never `.toFixed` / `toLocaleString` for display.
- Check `features/shared/components/` (the `@catalog` JSDoc tags) before building a widget; a shared primitive may not import from `features/*` or `lib/civic` — data comes in via props.
- Routes stay thin: a `page.tsx` mounts a feature and sets metadata; server pages `await` a server-only `get*Data.ts` loader and pass typed props into the `"use client"` feature.
- Sample data lives in `lib/civic/` — extend it, never inline a mock.

## Phase 7h — visual verification

There is no automated UI harness. Either run `npm run dev` and exercise the affected route
(say which route and what you saw), or state explicitly — in the commit body **and** the ADR —
that you have **NOT** visually verified.

## Phase 10 — self-reflection

Record durable non-obvious facts via the project memory system (`memory/<slug>.md` +
`MEMORY.md` index line), not a Lessons folder. Then update `docs/architect/coverage.md`
(theme, last scan, findings/actioned counts, yield density).

## Notes

- Cadence: weekly at most. Alternate scan (fill the queue) and resume (drain it).
- A finding that contradicts a recorded strong pattern is the most interesting finding of the run.
- Never propose a tech swap with reach >=100 files unless smell strength is 5.
