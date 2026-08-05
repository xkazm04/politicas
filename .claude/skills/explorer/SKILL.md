---
name: explorer
description: Daily low-friction quality sweep of the politicas codebase — wander one context-map area, surface 10 verified items worth fixing, triage them with the user, execute the accepted ones in-session behind `npm run check`, and stamp per-area coverage in docs/explorer/ so the next sweep picks a stale area. Use for paper cuts, bugs and polish; reach for /architect instead when the fix is structural.
category: Maintenance
contexts: tracked
---
# Explorer (politicas)

Wander a logical section of the politicas codebase, surface exactly **10 items** worth fixing, let the user triage, then execute the accepted ones in-session. Designed for frequent / low-friction use — daily wandering — and pairs with `/friend` (momentum-first product building) and `/architect` (heavy structural change).

Adapted from the personas `/explorer` skill. Politicas differences:
- Area taxonomy comes from **`context-map.json`** (9 groups / 25 contexts), not a `.claude/codebase-context.md` snapshot.
- Durable memory lives **in-repo** under `docs/explorer/` (no Obsidian vault), mirroring `/architect`'s `docs/architect/`.
- The validation gate is **`npm run check`** (typecheck + lint + test). No cargo, no Tauri, no test-automation harness.
- Cross-session lessons that survive promotion go to the project memory system (`memory/*.md` + the `MEMORY.md` index), per CLAUDE.md → "Agent memory".
- Content is **Czech-first**; there is no multi-locale extraction pipeline to satisfy.

## Interaction conventions

Built for parallel CLI control — every user prompt is single-keystroke answerable.

- **Every prompt is a numbered menu.** Numeric input picks the option; **Enter** triggers the default; option `1. other → …` is the deviation lane (free text).
- **Every phase output (intermediate or final) ends with a `Next?` block** of 2–5 numbered next-step actions. Replying with a digit advances the run without typing prose.
- Long free-text answers are still accepted everywhere; the menu just makes the common case instant.

## Input

Ask **two** numbered-menu questions, in this order. Numeric input picks the option; **Enter** picks the default; option `1. other → …` is the deviation lane and accepts free text.

### Q1 — Area

```
Area? (Enter = pick for me)
  1. other → type a hint (path fragment, keyword, or context name)
  2. landing        (Landing & Navigation)
  3. profiles       (MP Profiles & Rankings)
  4. legislation    (Voting & Legislation)
  5. money          (Financial Transparency)
  6. graph          (Knowledge Graph Explorer)
  7. ingestion      (Data Ingestion)
  8. data           (Data Layer)
  9. shared         (Shared UI Primitives)
  10. infra         (Infrastructure & Observability)
  11. pick for me   ← default
```

Numeric options 2–10 map 1:1 to the 9 groups in `context-map.json`. Their 25 contexts:

| Group | Contexts |
| --- | --- |
| Landing & Navigation | App Shell & Navigation · Landing Page |
| MP Profiles & Rankings | Velin Dashboard · MP Profile Dossier · CivicScore Leaderboard |
| Voting & Legislation | LawWatch · VoteTrack |
| Financial Transparency | BudgetMirror · Money Case Files & Human Review · FollowTheMoney Graph |
| Knowledge Graph Explorer | Graph Playground |
| Data Ingestion | Admin Console · Ingestion Normalization · Source Adapters |
| Data Layer | Sample Data Fallback · Scoring & Verdict Copy · Knowledge Graph Domain Model · PGlite Repositories · PGlite Store & Runtime |
| Shared UI Primitives | Archived Art Direction (Rentgen) · Shared Display Primitives |
| Infrastructure & Observability | Custom ESLint Rules · Test Utilities & Loader Coverage · App Bootstrap & Global Styles · i18n & Number Formatting |

Option 1's free text falls through to the Phase 2a resolver (path fragment / keyword / exact context name). Option 11 / Enter triggers Phase 2b auto-pick.

### Q2 — Category

```
Category? (Enter = any)
  1. other → describe (free-form intent; layered onto an auto-picked category)
  2. any            ← default
  3. quality
  4. dx
  5. ui
  6. perf
  7. bug
  8. data           (provenance / sourcing / mock-vs-real honesty)
  9. a11y
  10. sec
```

Wait for both answers. Don't ask anything else upfront — further questions only if a phase requires clarification.

If the user replies just "go" or "wander" or types `/explorer` with no arguments, treat as "pick for me" + "any" (Enter defaults for both).

---

## Constants

- **Codebase reference files** (always loaded):
  - `context-map.json` (repo root) — the feature map: 9 groups, 25 contexts, each with `filePaths`. The natural area taxonomy.
  - `CLAUDE.md` + `AGENTS.md` — project rules (route/feature structure, token discipline, the source-citation brand rule, git discipline, known gotchas).
  - `docs/DESIGN.md` — the design system source of truth. Read before any UI item.
  - `MEMORY.md` — the durable-knowledge index; skim it so you don't resurface a decision already taken.
- **Memory root** — in-repo under `docs/explorer/` (created at Phase 0):
  - `docs/explorer/sweeps/` — one note per run, the canonical artifact
  - `docs/explorer/state.md` — informational claim board (which areas are being explored *right now*)
  - `docs/explorer/coverage.md` — heatmap of last visit per area + yield density
  - `docs/explorer/passes.md` — per-area "already considered and rejected" memory; future passes skip these
  - `docs/explorer/preferences.md` — distilled rules across runs (promoted from lessons)
  - `docs/explorer/lessons/{date}.md` — append-only self-reflection
  - Sibling, read-only here: `docs/architect/strong-patterns.md` + `docs/architect/backlog.md`
- **Categories** — `quality | dx | ui | perf | bug | data | a11y | sec`
- **Severities** — `critical | high | medium | low`
- **Effort buckets** — `xs (<15m) | s (15-60m) | m (1-3h) | l (>3h)`

---

## Phase 0: Bootstrap the in-repo memory

Everything durable lives in the repo at `docs/explorer/` — git-tracked markdown, no external vault, so a future session (or another clone) resumes from the same files.

### Bootstrap (one-time per repo)

If any of these are missing, create them:

- `docs/explorer/` (directory)
- `docs/explorer/sweeps/` (directory)
- `docs/explorer/lessons/` (directory)
- `docs/explorer/state.md` — header only:
  ```markdown
  # Explorer State

  Active claims by `/explorer` runs. Informational only — not a hard lock.
  Stale entries (>2h) are released automatically by the next run.

  ## Active

  _No active explorers._
  ```
- `docs/explorer/coverage.md` — header only:
  ```markdown
  # Explorer Coverage

  Heatmap of areas explored. Used by Phase 2 to pick the staleest, highest-yield area.

  ## Areas
  ```
- `docs/explorer/passes.md` — header only:
  ```markdown
  # Explorer Passes

  Per-area record of items that were surfaced and **rejected** in past runs.
  Future passes over the same area skip these. Accepted items don't appear here
  (their fix is in the codebase). Items that were not surfaced are also absent.

  ## Areas
  ```
- `docs/explorer/preferences.md` — header only:
  ```markdown
  # Explorer Preferences (distilled from /explorer runs)

  > Rules upgraded from `docs/explorer/lessons/` after 3+ observations. Loaded by Phase 1.

  _No patterns yet. Will be populated as runs accumulate._
  ```

Don't touch `docs/architect/` — that's `/architect`'s memory, read-only from here.

---

## Phase 1: Load context & memory

### 1a. Required-file check

- `context-map.json` at the repo root — if missing, stop: the area taxonomy is the whole premise. Tell the user to re-run a Vibeman context scan.
- `CLAUDE.md` and `docs/DESIGN.md` — if either is missing, warn and continue with reduced convention awareness.

### 1b. Read in order

1. `context-map.json` — to learn the area taxonomy (9 groups, 25 contexts, `filePaths`, `index` one-liners).
2. `CLAUDE.md` (+ the `@AGENTS.md` it includes) — route map, code structure, conventions, quality gates, known gotchas.
3. `docs/DESIGN.md` — the design system (token discipline, layout language). Mandatory before any `ui` item.
4. `MEMORY.md` — the one-line index of durable decisions; open any `memory/*.md` entry that touches your area so you don't resurface a settled question.
5. `docs/architect/strong-patterns.md` (if present) — the canonical shapes this codebase does well. When you propose a fix in Phase 5, **prefer the shape of an existing strong pattern** over inventing a new one. Reference it in the item's `strong_pattern_ref` field. Also skim `docs/architect/backlog.md` so you don't surface something `/architect` already queued.
6. `docs/explorer/preferences.md` — to deprioritize finding shapes the user has rejected before.
7. `docs/explorer/state.md` — to know what *other* explorers are working on right now.
8. `docs/explorer/coverage.md` — to know last-visit dates and yield per area.
9. `docs/explorer/passes.md` — to know which items were already rejected per area.
10. The 3 most recent files in `docs/explorer/lessons/` (sorted descending) — to absorb recent self-reflection.

### 1c. Stale-claim sweep

In `docs/explorer/state.md`, any entry whose `claimed_at` is older than 2 hours is **stale** — assume the run was abandoned. Remove stale entries before proceeding. This keeps the file honest without an explicit lock.

### 1d. Map freshness

Parse `generatedAt` / `revision` in `context-map.json`. If the map is >30 days old, or `git rev-list --count HEAD` has advanced by >200 commits since it was generated, warn but continue:
```
Warning: context-map.json may be stale ({N} commits / {D} days since it was generated).
Consider a Vibeman context rescan after this session.
```
If a file you read in Phase 4 belongs to no context, note it — an unmapped file is itself a finding.

---

## Phase 2: Pick area

### 2a. If user gave a hint

Resolve the hint against `context-map.json`:
- Exact group name (e.g. `Financial Transparency`) → all contexts under that group.
- Exact context name (e.g. `VoteTrack`) → that single context.
- Path fragment (e.g. `features/votetrack`) → contexts whose `filePaths` overlap.
- Keyword (e.g. `pglite`, `hlasovani`) → contexts whose name/description/`index` line matches.

If the resolution is ambiguous (>3 plausible areas), present a short numbered list and ask "which one?" before continuing.

### 2b. If user said "pick for me"

Score each context by:
- **Staleness** — days since last visit per `docs/explorer/coverage.md` (more days = higher score). Never-visited = max staleness.
- **Past yield density** — items accepted / items surfaced in last 1–2 visits (higher = higher score). Tie-breaker.
- **Active claim penalty** — if the context appears in the `docs/explorer/state.md` Active section, score = 0 (skip it; pick a different area).
- **In-flight penalty** — a context under active redesign per CLAUDE.md's status section (currently `features/graph`, round 4) scores 0 unless the user asked for it by name.

Pick the top-scored context. If multiple tie, pick the one with the smaller file count (faster to scan, tighter feedback loop).

Tell the user which area you picked and why (one short sentence), then a `Next?` menu:

```
Next?
  1. other → name a different area or context id
  2. proceed with {picked-area}   ← default
  3. abort
```

### 2c. Category filter

If the user's category filter is not `any`, narrow the scan focus accordingly. The area stays the same; the filter only changes what kind of items count toward the 10-item budget.

---

## Phase 3: Claim the area

Append an entry to `docs/explorer/state.md` under the `## Active` section:

```markdown
- **{area-slug}** — claimed_at: {ISO timestamp}, run_id: {short random id}, category: {filter}
```

This is **informational, not a lock.** Other explorers reading this file will pick a different area. There's no enforcement, but only one explorer runs at a time, so this is sufficient for awareness.

Other sessions may hold in-flight work in this tree (CLAUDE.md → "Git discipline"). Before scanning, run `git status --porcelain -- <area paths>`; if the area already has uncommitted changes you didn't author, say so up front and default to layering on top rather than reverting anything.

Print the claim line to the user so they know what's recorded.

---

## Phase 4: Wander the code

Read enough of the area to identify 10 items. Budget your tool calls — don't read every file in a 100-file area. Sample strategically.

### 4a. Sampling strategy

For an area with N files:
- N ≤ 5: read all of them.
- 5 < N ≤ 20: read the context's entry points (the orchestrator component named in `context-map.json`'s description / `index` line — e.g. `features/<x>/<X>Page.tsx`, a `get*Data.ts` loader, a `lib/` module's public surface) + a sampling of the rest, capped at 10 file reads.
- N > 20: read all entry points + grep-discover the largest files (`Glob` then sort by line count) + sample 5–8 of those.

Colocated `*.test.ts` files next to a `lib/` module are cheap, high-signal reads — they encode the invariants the code is supposed to hold.

Use `Read` with offset/limit when files are >500 lines — read top + bottom + a middle slice rather than the full file.

### 4b. What to look for, by category

**Hard exclusions.**
- **Nothing that `npm run lint` already catches.** The 6 custom rules in `eslint-rules/` (`no-hardcoded-colors`, `no-silent-catch`, `no-silent-null-catch`, `no-server-import-in-client`, `role-button-requires-keydown`, `enforce-reduced-motion-fallback`) run at **error** level and the tree is clean — a violation would fail the gate, not sit as backlog. Surface the *gap in the rule* instead (a case the rule misses, an exclusion in `eslint.config.mjs` hiding real violations) — that's a real item.
- **Not "rewrite the mock as real data."** `lib/civic/` is a deliberate, test-pinned fallback (see `MEMORY.md` → sample-data-first). Porting a surface to the graph is an `/architect` or `/friend` job, not a paper cut. A *mislabelled* mock — sample numbers rendered as if sourced — IS an item, and a severe one.

For `quality`:
- Dead code, unreachable branches, unused exports.
- Duplicated logic across files (3+ near-identical blocks).
- Misleading names, unclear intent, leaking abstraction.
- Comments that explain "what" instead of "why" — flag the comment, not just the code.
- Commented-out code older than current branch.

For `dx`:
- Test setup boilerplate that could be a fixture; a `lib/` invariant with no colocated vitest test.
- A `get*Data.ts` loader whose `null` fallback path is untested (the mock/real seam is where regressions hide).
- Repeated try/catch boilerplate; catches that log without context.
- A route `page.tsx` doing work that belongs in its feature (routes stay thin).
- Build-time hot-paths (large bundles, slow rebuilds) — use `npm run build` output if recent.
- Missing error context (errors thrown without enough info to debug).

For `ui`:
- Hand-rolled duplicates of primitives that already exist in `features/shared/components/` (look for the `@catalog` JSDoc tags). Check the catalog before flagging *and* before fixing.
- A shared primitive importing from `features/*` or `lib/civic` — the lint-enforced boundary; data comes in via props.
- Visual bugs (overflow, alignment, contrast). Only flag if you can reproduce or strongly suspect from the code.
- Drift from `docs/DESIGN.md` — spacing/radius/rule-weight inconsistency, a color that isn't an `app/globals.css` token.
- Missing loading / empty / error states on user-facing components (the money/law surfaces have real empty cases).
- A rendered number without a `SourceNote` (see the `data` category — it's the brand rule, so file it there when the defect is sourcing rather than layout).
- Czech copy defects: an English string leaking into the UI, a number formatted with `.toFixed`/`toLocaleString` instead of `lib/format.ts` (decimal commas).
- Accessibility gaps that double as UX gaps (missing aria-label on icon-only buttons, focus traps, keyboard nav broken).

For `perf`:
- Unnecessary re-renders (object/array literals in deps, missing memoization on expensive children, a whole feature re-rendering on a hover/pin state).
- N+1 queries in a repository loop (`lib/db/`) where one query would do.
- Large lists / large graphs without virtualization or a bounded node budget.
- `useEffect` chains where one effect depends on another's state (cascade).
- Subscriptions, rAF loops, timers and canvas listeners that don't clean up.
- Synchronous work on the render path that could move to the server loader.
- recharts `ResponsiveContainer` in a grid track without `min-w-0` + a fixed-aspect `overflow-hidden` wrapper — a known livelock, not a paper cut (see CLAUDE.md → known gotchas). Rate it `high`.

For `bug`:
- Race conditions (state read-then-write without a transaction, async effects without abort).
- Edge cases unhandled (empty arrays, null/undefined, NaN).
- Stale closures in effects/callbacks.
- Off-by-one, boundary errors.
- Wrong dependency arrays in hooks.
- Errors swallowed silently (catch with empty body or just `console.log`).
- SVG coordinates from trig not rounded to 2 decimals — SSR/CSR float drift trips hydration (see `Hemicycle.tsx`).
- A link built from a mock slug where the route expects a real id (`/poslanec/[id]` takes a psp.cz id — see `MEMORY.md`).

For `data` (the brand rule — the highest-value category in this repo):
- A rendered number with no `SourceNote` / no citation path back to a source.
- Sample data (`lib/civic/`) presented as if it were sourced, or a real/mock boundary the user can't see.
- A derived or unverified fact rendered as established — human-gated ties, `pending_review` verdicts and derived posudky must render as such and must never feed a score.
- A number computed in the view layer that disagrees with the `lib/` function that owns it (`score` must equal `composite(pillars)`; the colocated test enforces it — a second implementation is the defect).
- Fabricated structure: a stage, a diff or a trend the graph carries no data for. Removing it is the fix; inventing it is the sin.
- A loader whose `null`-fallback silently swaps real data for mock without saying so on screen.

For `a11y`:
- Missing labels on form inputs.
- Color contrast (you can't measure it, but you can flag low-opacity foreground tokens stacked on tinted surfaces).
- Keyboard navigation broken (clickable divs without role/tabIndex — `custom/role-button-requires-keydown` catches the keydown half only).
- Missing focus styles.
- Modal/drawer without focus trap, escape handler, or backdrop click.
- Looping motion without a `prefers-reduced-motion` fallback (WCAG 2.3.3) — canvas/rAF animation the custom rule can't see.
- `lang`/locale correctness: Czech content marked up as anything but `cs`.

For `sec`:
- Externally-reachable surfaces (route handlers, server actions, the `/admin` console) without validation or an auth gate.
- User input interpolated into a SQL string instead of a parameterized query in `lib/db/`.
- Server-only code (`getStore()`, `server-only` modules, secrets) reachable from a `"use client"` boundary — `custom/no-server-import-in-client` covers the import, not a leaked value passed through props.
- Credentials or absolute local paths logged or surfaced in error messages / Sentry payloads.
- Auto-promote sec findings to severity `critical`.

### 4c. Honor the deprioritization signals

- If `docs/explorer/preferences.md` contains a rule like "user rejects cosmetic CSS findings without a measurable issue," skip those.
- If `docs/explorer/passes.md` for this area lists items by short fingerprint (file:line + 1-line summary), skip exact matches. A near-match is OK to surface — but note "previously passed; resurfacing because <reason>".
- Cross-check the area's previous sweep notes (`docs/explorer/sweeps/*-{area-slug}.md`) — don't resurface an item a past run already surfaced, unless its status changed.
- Check `MEMORY.md` + `docs/architect/backlog.md`: a settled decision or an already-queued architect item is not an explorer item.

### 4d. Dedupe against recent history (one command, seconds)

Before finalizing candidates, run **one** git log over the area's paths:

```bash
git log --oneline -20 -- <area path globs>
```

Drop any candidate whose anchor was plausibly fixed or reworked by a recent commit (verify by reading the current code, not the commit message). If a candidate survives despite recent activity, note "still present after <sha>" in its evidence. This plus passes.md plus prior sweeps is the full dedupe — no deeper archaeology.

### 4e. Stop conditions

- 10 items found → stop scanning, move to Phase 5.
- Exhausted the area without 10 items → widen scope by pulling in the *adjacent* context from the same group in `context-map.json`. Note the widening in the run record. If still <10 after widening twice, stop with what you have and explain the shortfall.
- Tool budget exceeded (>40 file reads) → stop with what you have.

**Do not pad the list** with low-value items just to hit 10. Quality over quota. If you stop short, the run record explains why.

---

## Phase 5: Categorize and structure each item

### Premise verification (hard gate — no item ships without it)

Every item's `anchor` must be a `file:line` **you actually Read in this session**, and its `evidence` must quote or paraphrase the real code at that line. Before presenting, re-Read the anchor lines of any item whose premise came from a grep hit or a sampled slice, and confirm the defect is really there (the guard isn't elsewhere, the "dead" export isn't imported, the "missing" abort isn't in a wrapper — one targeted Grep settles it). Pattern-matched suspicion ("this *usually* means…") is not an item. If verification kills a candidate, replace it or run short — never pad with unverified ones.

For each of the 10 (or fewer) items, capture:

```yaml
- id: 1
  title: "<short imperative phrase, ≤60 chars>"
  category: quality | dx | ui | perf | bug | data | a11y | sec
  severity: critical | high | medium | low
  effort: xs | s | m | l
  context: "<context name from context-map.json>"
  anchor: "<file_path>:<line_number>"
  evidence: "<2-3 sentence explanation of the gap, with verbatim code snippet if helpful>"
  suggested_fix: "<1-2 sentence shape of the fix — not the fix itself>"
  strong_pattern_ref: "<link to docs/architect/strong-patterns.md#... entry>" | null
  copy_impact: "<none | new Czech UI copy | changes a rendered number's source note>"
  cluster_hint: "<other ids that ship naturally with this one, or 'standalone'>"
```

**On `strong_pattern_ref`:** if the suggested fix matches the shape of an entry in `docs/architect/strong-patterns.md` (e.g. proposing a server-loader boundary when the strong pattern "async page → `get*Data.ts` → typed props into a client feature" exists), set `strong_pattern_ref` to that link. The fix should then **conform to the canonical example** in that entry, not invent a new shape. If no strong pattern applies, leave it null.

### Severity rubric (be honest)

- **critical** — security gap, data loss risk, crash on common path, **or a truth defect: a fabricated/uncited/mislabelled number on a public surface**. Drop everything and ship.
- **high** — wrong behavior on the golden path, broken on a common edge case, regression risk if left.
- **medium** — paper cut, confusing UX, small perf hit, latent risk.
- **low** — polish, nice-to-have, taste-level.

If you find yourself rating most items "high," recalibrate downward. A 10-item list typically lands as 0–1 critical, 2–3 high, 4–6 medium, 1–3 low.

### Cluster detection

After categorizing, scan for items that should ship together:
- Same file → same commit.
- Type/function dependency → ship in order.
- Same feature folder + same convention (e.g. three components all needing the same `SourceNote`) → one commit.

Note these in `cluster_hint`.

---

## Phase 6: Present to user

Print a summary table, then per-item detail.

### Summary table

```
#   Cat     Sev    Effort  Title                                              Anchor
─   ─────   ────   ──────  ─────────────────────────────────────────────────  ──────────────────────────
1   bug     high   s       Hemicycle seat coords unrounded (hydration drift)  features/landing/components/Hemicycle.tsx:42
2   perf    med    xs      Vote ledger rows re-render on every hover pin      features/votetrack/components/VoteLedger.tsx:118
3   data    high   s       Rebel-rate figure rendered without a SourceNote    features/votetrack/components/DisciplineBoard.tsx:31
...
```

### Per-item detail

For each row:
```
[N] {title}
    Category / Severity / Effort:  {cat} / {sev} / {effort}
    Context:   {context name from context-map.json}
    Anchor:    {file:line}
    Evidence:  {explanation + snippet}
    Suggested: {1-2 sentence fix shape}
    Follows:   {strong-pattern link + canonical example, or "—" if none applies}
    Copy:      {none | new Czech UI copy | changes a source note}
    Cluster:   {standalone | ships with [a, b]}
```

If any items are clustered, end the section with a short "Clusters" block:
```
Clusters:
  - [2, 5, 8] — all in VoteLedger.tsx; ship in one commit. Order: 5 → 2 → 8.
  - [3] alone — SourceNote fix, separate commit.
```

---

## Phase 7: Triage

Ask the user:
```
Which to action? Reply with item numbers (e.g. "1, 3, 4").

Shortcuts:
  all     — accept every surfaced item
  none    — accept nothing (still write the sweep note)
  ask     — guided walkthrough item-by-item
  Enter   — same as "none"   ← default
```

For each accepted item, execute it **in this same session**: discover → decide → implement → commit, all in one context window.

### Execution rules

**Single accepted item with a clear anchor (Option A):**
1. Apply the edit at `anchor`.
2. Run validation — **`npm run check`** (typecheck → lint → test) is THE gate and must pass. Lint runs at error level; there is no warning budget. Fast inner loops may use the individual legs (`npm run typecheck`, `npm run lint`, `npm run test`), but the full gate runs before the commit.
3. **Stage scoped + verify + commit in ONE Bash invocation** (concurrent sessions rewrite the index between separate calls):
   ```bash
   git add path/one path/two && git diff --cached --stat
   ```
   Never `git add -A`, `git add .`, or `git add -u` (CLAUDE.md → "Git discipline"). If the cached stat lists **more files than you added**, the index held another session's pre-staged work — `git restore --staged <path>` each unrelated file, re-verify, THEN commit. Never trust the index.
4. Commit atomically in Conventional Commits form (`fix: …`, `refactor: …`, `perf: …`) + Co-Authored-By footer + a body explaining the why.

**2+ accepted items (Option B):**
1. Print the inline plan (one paragraph per item: file, change shape, validation).
2. Execute in **risk-ascending order** (xs effort first, l last; severity ties broken by category — `sec` before `data` before `bug` before `perf` before `a11y` before `quality`).
3. Atomic commit per item, validation per commit, same one-invocation stage-verify-commit discipline as Option A.
4. If validation fails → fix inline, do NOT stack failing commits. No `--no-verify`, no `--amend`.
5. If a downstream item turns out to be redundant after an upstream commit, drop it and note the drop in the run record.

**Item that needs more thought (Option D — escape hatch):**
Record it in the run record as `decided: deferred` with the reason. Do NOT write a handoff file. The run record is the future search target. Use sparingly — prefer A or B.

### Frontend changes — non-negotiable

If any accepted item touches `app/**` or `features/**`:
- **Read `docs/DESIGN.md` first.** It is the design system source of truth; a change that contradicts it is not a fix.
- **Colors come from `app/globals.css` tokens only** — the three declared exceptions are in DESIGN.md §1. `custom/no-hardcoded-colors` enforces it at error level.
- **Every rendered number cites its source** via `SourceNote`. If you add or move a number and can't cite it, you may not ship it — that's the brand rule.
- **Czech-first copy.** All user-facing strings are Czech; numbers go through `lib/format.ts` (decimal commas) — `.toFixed` for display lives nowhere else.
- **Check `features/shared/components/` before building a widget.** A new reusable primitive goes there with a `@catalog` JSDoc one-liner, never into a feature folder — and it may not import from `features/*` or `lib/civic` (lint-enforced boundary; pass data via props).
- **Routes stay thin** — a `page.tsx` mounts a feature and sets metadata, nothing else. Server pages `await` a server-only `get*Data.ts` loader and pass typed props into the `"use client"` feature (`/hlasovani` + `features/votetrack/getVoteThemes.ts` is the template).
- **Sample data lives in `lib/civic/data.ts`** — extend it, never inline a mock; `score` must equal `composite(pillars)` (colocated test).
- **Mind the known gotchas** (CLAUDE.md): recharts `ResponsiveContainer` needs `min-w-0` + a fixed-aspect wrapper; SVG trig coords round to 2dp.

If you can't honor these in the change, defer the item — don't ship it half-converted.

### Frontend visual verification

If a change is visually meaningful (`ui` category, or any change to a rendered component shape), either:
- start the dev server (`npm run dev`, Turbopack) and exercise the affected route in a browser before committing — say which route you loaded and what you saw; **or**
- state explicitly, in the commit body and in the run record, that you have **NOT** visually verified.

There is no automated UI harness in this repo. Don't claim "looks good" from code review alone.

---

## Phase 8: Persist the sweep

Write `docs/explorer/sweeps/{YYYY-MM-DD}-{area-slug}.md`:

```markdown
---
date: 2026-05-01
run_id: {short id}
area: {context name or group from context-map.json}
files_sampled: {N}
category_filter: any | quality | ...
total_items: 10
accepted: [1, 3, 4]
declined: [2, 5, 6, 7, 8, 9, 10]
deferred: []
commits: [<sha1>, <sha2>]
widened: false
---

# {Area title} sweep — {date}

## Items

### [1] {title}  ✅ accepted → {commit sha} `{commit subject}`
**Category / Severity / Effort:** {cat} / {sev} / {effort}
**Anchor:** `{file:line}`
**Evidence:** {evidence}
**Fix shape:** {what was actually done; reference commit body for detail}

### [2] {title}  ❌ declined
**Category / Severity / Effort:** ...
**Anchor:** ...
**Evidence:** ...
**Decline reason:** _filled in Phase 9_

### [3] {title}  ⏸ deferred
**Category / Severity / Effort:** ...
**Reason:** {why deferred — concrete blocker, not vague "later"}

...

## Cross-references
- Adjacent areas not yet swept: {list from docs/explorer/coverage.md, optional}
- Related preferences: [preferences](../preferences.md)
- Related architect findings: {links into docs/architect/, optional}
```

The sweep note is committed with the run (`docs: explorer sweep — {area}`), staged per-path like any other change.

---

## Phase 9: Self-reflection

### 9a. Ask why for declined items

Single batched question:
```
For the declined items, why did you skip them?

  [2] {title}
  [5] {title}
  ...

Reply per-item ("2: too vague, 5: already planned") or one overall reason.

Shortcuts:
  skip    — record "no reason given"
  Enter   — same as "skip"   ← default
```

### 9b. Append to lessons

Write/append `docs/explorer/lessons/{YYYY-MM-DD}.md`:

```markdown
## Run: {timestamp} — {area} ({category filter})

Sampled: {N} files
Surfaced: {M} items
Accepted: [list]
Declined: [list] (with reasons)
Deferred: [list] (with blockers)

### Self-reflection
- Categories that resonated: {pattern}
- Categories that didn't: {pattern}
- Calibration drift: {e.g. "rated 7 items 'high' but user accepted only 2; over-weighting severity"}
- Tools to use more / less next time: {observation}
```

### 9c. Backfill the sweep note

Add the decline reasons to the Phase 8 sweep note's `[N] declined` blocks.

### 9d. Update passes.md

For each declined item, append a fingerprint to `docs/explorer/passes.md` under the area's section (create section if missing):

```markdown
## {area}

- {file:line} — {1-line summary of the rejected suggestion} — pass {date}, run {id}, reason: {short reason}
```

The fingerprint matters — future passes over the same area skip these. Keep entries short.

### 9e. Pattern promotion check

Read all `docs/explorer/lessons/*.md`. If a decline reason has appeared in **3+ runs** (or a close synonym), propose promoting it:

```
I've seen this 3+ times — promote to permanent rule?
  "{distilled rule}"

Source runs: 2026-04-12-money-case-files, 2026-04-20-velin-dashboard, 2026-04-28-votetrack

Next?
  1. promote to docs/explorer/preferences.md          ← default
  2. promote to project memory (memory/<slug>.md + MEMORY.md index)
  3. snooze (re-ask after 3 more observations)
  4. drop (don't promote, reset the counter)
```

Option 1 appends to `docs/explorer/preferences.md` — the skill's own taste memory.

Option 2 is for a learning that any agent in this repo should have, not just `/explorer`: per CLAUDE.md → "Agent memory", write `memory/<slug>.md` (terse `name` + `description` frontmatter, then the fact and why it matters) and add its one-line entry to `MEMORY.md`. The bar is high — worth recalling in three months **and** not derivable in ten seconds from `docs/`. A calibration preference ("user rejects cosmetic findings") is option 1; a durable repo fact ("`/poslanec` takes a pspId, so mock slugs 404") is option 2.

### 9f. Update coverage.md

Update or insert the row for this area:

```markdown
## Areas

### {area-slug}

- Last visited: {date}
- Last run: [sweeps/{date}-{area-slug}](sweeps/{date}-{area-slug}.md)
- Items surfaced (last 3 runs): [10, 8, 10]
- Items accepted (last 3 runs): [3, 5, 4]
- Yield density: {accepted / surfaced average}
- Notes: {anything noteworthy across runs}
```

### 9g. Release the claim

Remove the entry written in Phase 3 from `docs/explorer/state.md`. Commit the memory updates (`docs/explorer/**`) alongside — staged per-path, never `-A`.

---

## Phase 10: Final summary

Print:
```
Explorer run complete.

  Area:           {name} (group: {group})
  Category:       {filter}
  Files sampled:  {N}
  Items surfaced: {M} / 10
  Accepted:       {K} → {commit shas}
  Declined:       {L}
  Deferred:       {D}

  Coverage update: last visit {date} → {today}, yield density {X}/{Y}

  Files updated:
    + docs/explorer/sweeps/{date}-{slug}.md
    + docs/explorer/lessons/{date}.md
    ~ docs/explorer/coverage.md
    ~ docs/explorer/passes.md  (if any declines)
    ~ docs/explorer/state.md   (claim released)
    {if pattern promoted:}
    ~ docs/explorer/preferences.md
    {or, if promoted to project memory:}
    + memory/{slug}.md  ~ MEMORY.md

  Next?
    1. /explorer {stalest adjacent area}                 ← default
    2. /explorer {same area, different category}
    3. /friend {area}      (momentum-first product loop on the same context)
    4. /architect resume   (drain the docs/architect backlog)
    5. done
```

If zero items were accepted, frame the run as a successful pass over a healthy area. The point is signal, not action.

---

## Notes on use

- **Pair with `/friend`** — `/friend` builds forward on one context; `/explorer` sweeps it for defects afterwards. `/architect` is the escalation when a finding is structural rather than local.
- **Cadence** — daily or every-other-day is a reasonable rhythm. `docs/explorer/coverage.md` will tell you when the codebase is uniformly fresh and you should switch to `/architect` instead.
- **Coexist with uncommitted work.** Multiple CLIs and editor sessions share the working tree. Explorer never stashes, resets, or discards anything it didn't author. Each commit stages **only the specific paths** the explorer touched (`git add path/one path/two`); never `git add -A`, `git add .`, or `git add -u`. If an item's anchor file already has uncommitted changes from someone else, surface it: "this file already has changes — commit them first, or layer on top?" Default to layer-on-top if the user doesn't pick. Forbidden at all times: `git stash`, `git reset --hard`, worktree-touching `git restore` / `git checkout --` on paths the run didn't author, `git clean -f`. (`git restore --staged <path>` to unstage a foreign pre-staged file is allowed — it never touches the working tree.)
- **Drift signal** — if 3+ explorer runs in a row produce 0 accepted items, the calibration is off (severity bar too low, or area was wrong). Trigger a self-reflection: read the last 3 sweeps and ask the user "what shape would have actually been useful?"

## App context coverage (Personas-managed repos)

This skill declares `contexts: tracked` — the Personas app measures per-context memory coverage for it. When run inside a Personas-managed repo (a `.personas/` dir exists, or the app dispatched this run), record progress into the Project Memory Ledger so the Skills Manager shows honest coverage. Before finishing, append JSON lines to `.personas/memory-outbox.jsonl` at the repo root (append, never rewrite) — one node per context you meaningfully worked on:

```json
{"type":"node","kind":"progress","title":"<=200 chars: what you did in this context","body":"optional detail","context":"<exact context name from this repo's context-map.json, e.g. \"VoteTrack\">","skill":"explorer"}
```

Always set both `"skill":"explorer"` and `"context":"<name>"` — together they drive the per-skill context-coverage % (last 30 days). The app ingests and deletes the file when the session ends. Skip silently when the repo is not Personas-managed.
