---
name: friend
description: Endless single-area companion loop over the politicas codebase — scan one context-map group, propose 5 development directions, the user picks a number, execute it against repo conventions (`npm run check`, token discipline, SourceNote), repeat. Momentum-first, parallel-session UX/product building with in-repo memory under docs/friend/. Reach for it when you want to keep shipping user-visible value into one corner of the app with the least typing possible.
category: Development
contexts: tracked
---
# Friend (politicas)

Endless companion loop scoped to one area of the politicas codebase. Each cycle: scan → propose **5 development directions** → user picks a number → execute with repo conventions → report → propose 5 new directions. Designed for **parallel CLI sessions** where the user wants to keep adding UX / product value to a corner of the codebase with the least typing possible.

Adapted from the personas `/friend` skill. Politicas differences:
- Durable memory lives **in-repo** under `docs/friend/` (no Obsidian vault), mirroring `docs/architect/`.
- Taxonomy comes from `context-map.json` (25 contexts / 9 groups) + `CLAUDE.md` + `docs/DESIGN.md`.
- The single validation gate is `npm run check` (typecheck + lint + test). No cargo/tauri, no test-automation harness.
- Visual verification means exercising the surface on `npm run dev` in a browser — or saying plainly that you did not.
- Cross-session lessons that generalize get promoted to the project memory system (`memory/<slug>.md` + a `MEMORY.md` index line), not a Patterns note.

`/friend` is the **light, in-session, single-area companion**: one session, one worktree, one picked direction executed *immediately* per cycle. No builder fleet, no acceptance pool, no review gates — momentum, not orchestration. It is **development-flavored**: it does not do stabilization — that is `/explorer`'s job. It does not do heavy structural rewrites — that is `/architect`'s job. It does not look outside the repo — that is `/research`'s job.

Companion to:
- `/perfect` — the heavy sibling: Director/Builder loop, 10-accepted-directions gate, per-context worktree builders, vault-resident queue. When a `/friend` idea outgrows one area (multi-context scope, schema breaks, needs review gates or a human checkpoint mid-arc), **graduate it to `/perfect`** instead of stretching the cycle — see "Graduation lane" in Phase 2.
- `/explorer` — 10 paper cuts in an area, one-shot (quality / dx / ui / perf / bug / data / a11y / sec)
- `/architect` — heavy structural cross-area sweeps, one-shot
- `/research` — external sources
- `/sentry` — fix prod errors

## Interaction conventions

Built for parallel CLI control — every user prompt is single-keystroke answerable.

- **Every prompt is a numbered menu.** Numeric input picks the option; **Enter** triggers the default; option `1. other → …` is the deviation lane (free text).
- **Every cycle ends with a `Next?` block** of 5 numbered next-direction options plus deviation + refresh. Replying with a digit advances the loop without typing prose.
- Long free-text answers are still accepted everywhere; the menu makes the common case instant.
- **No exit option in the menu.** The loop runs until the user interrupts, types a stop word in the deviation lane (`stop`, `done`, `bye`, `quit`), or the context window forces a wrap. On any of those, run the clean-exit ritual (Phase 6).

## Input

Ask **two** numbered-menu questions, in this order.

### Q1 — Area

```
Area? (Enter = pick for me)
  1. other → type a hint (path fragment, keyword, or context name)
  2. landing-nav          (feature)
  3. profiles-rankings    (feature)
  4. voting-legislation   (feature)
  5. financial            (feature)
  6. graph-explorer       (feature)
  7. ingestion            (integration)
  8. data-layer           (data)
  9. shared-ui            (shared)
  10. infrastructure      (infrastructure)
  11. pick for me   ← default
```

Numeric options 2–10 map 1:1 to the 9 groups in `context-map.json` — Landing & Navigation, MP Profiles & Rankings, Voting & Legislation, Financial Transparency, Knowledge Graph Explorer, Data Ingestion, Data Layer, Shared UI Primitives, Infrastructure & Observability — the same mapping as `/explorer` and `/architect`. Option 1's free text falls through to the resolver (path fragment / keyword / exact context name from the map's 25 contexts). Option 11 / Enter triggers an auto-pick weighted by which area has had the least recent `/friend` activity (see Coverage below) — fall back to round-robin if no Coverage file exists yet.

### Q2 — Goal

```
Goal? (Enter = scan and propose)
  1. other → describe a vague intent (free text)
  2. scan and propose   ← default
  3. surprise me        — let me pick a stretch direction without telling me upfront
```

`scan and propose` and `surprise me` produce 5 directions; `surprise me` biases toward one bolder option and skips the user-readable scan summary.

A vague free-text intent (option 1) is layered as a prior over the auto-proposed directions but does not replace them — `/friend` still surfaces 5 options.

If the user typed `/friend` with no arguments, treat as area=`pick for me` + goal=`scan and propose` + verified=`no`.

### Q2b — Verified loop? (opt-in)

```
Verify each cycle against the running app? (Enter = no)
  1. other → free text
  2. no — validate with npm run check only   ← default (fast loop)
  3. yes — exercise the surface on npm run dev in a browser before reporting done
```

`yes` enables **verified mode** for the whole session (see Phase 4.5). It assumes — or boots once at Phase 0 (step 0f) — a worktree-local `npm run dev` (Next.js Turbopack) instance. The cost is a running dev server; the payoff is that no cycle is reported "done" on a clean `npm run check` alone. A green typecheck is not evidence of behavior. `no` keeps the fast loop and instead emits a concrete manual-verify checklist in the Phase 5 report for any behavior-changing cycle. Either way the honesty rule stands: **if a change is visually meaningful, either actually exercise it on the dev server or state plainly in the report that you have NOT visually verified it.** Verified mode can be toggled mid-session from the deviation lane (`verify on` / `verify off`).

---

## Constants

- **Codebase reference files** (always loaded):
  - `context-map.json` — the context map (9 groups, 25 contexts). The natural area taxonomy; `index` is the one-line-per-context overview.
  - `CLAUDE.md` — project rules (routes stay thin, token discipline, the evidence/`SourceNote` brand rule, quality gates, git discipline, known gotchas).
  - `docs/DESIGN.md` — the design system source of truth. **Read before any UI work.**
  - `MEMORY.md` (+ any `memory/*.md` it points at) — durable cross-session facts already paid for.
- **Active-runs ledger**: `.claude/active-runs.md` — register at Phase 0, deregister at Phase 6. Create it with `## Active` / `## Recently completed` headings if missing.
- **Memory root**: `docs/friend/` (created at Phase 0). This is where `/friend` accumulates cross-session learning so feature selection improves over time. Mirror of the `/explorer` pattern and of `docs/architect/`, scoped to development-flavored directions instead of paper cuts.
  - `docs/friend/sessions/` — one note per session, the canonical artifact
  - `docs/friend/state.md` — the claim board: which area each live/recent session is working, so parallel sessions don't collide
  - `docs/friend/coverage.md` — heatmap of last `/friend` visit per area + acceptance density
  - `docs/friend/passes.md` — **rejected direction fingerprints per area**; Phase 2 reads this and avoids re-proposing. Hard rejects only (user typed "no", refresh, or "other" with reason); soft skips (user picked a different option this cycle) do NOT land here.
  - `docs/friend/preferences.md` — distilled rules promoted from `docs/friend/lessons/` after **3+ observations**. Loaded by Phase 1; biases Phase 2 proposal shapes.
  - `docs/friend/lessons/{YYYY-MM-DD}.md` — append-only per-session self-reflection.
  - `docs/architect/strong-patterns.md` (if present) — canonical shapes the codebase already does well, recorded by `/architect`. Phase 2 should **prefer the shape of an existing strong pattern** when proposing directions; reference it in the direction body.
- **Direction shape** — every proposed direction must:
  - Add or polish **user-visible product surface** (a new control, a clearer flow, a missing affordance, a new capability, an interaction that makes an existing feature feel more finished).
  - **Name the concrete files it would touch and the user-visible outcome.** "Polish X", "improve the Y experience", "make Z nicer" without named files and a stated outcome are banned menu items — if you can't name the files, you haven't scanned enough to propose it.
  - **Match learned taste** (from `docs/friend/preferences.md` and past sessions): outcome-value directions — a user can do or see something they couldn't before — yes; cosmetic churn with no new capability (restyling that changes nothing behavioral) — no.
  - **Never fabricate data to make a surface look finished.** Politicas' brand rule is that every rendered number cites its source; if the graph doesn't carry the field, the honest direction is an empty/derived state, not invented content.
  - Ship as **one or more atomic commits** — each individually compiling and lint-clean. A small self-contained polish is one commit; a complete vertical slice (repository → server loader → client feature → polish) is a short ordered sequence of atomic commits delivered in the **same cycle** (see Phase 2 "two shapes for ambitious work" and Phase 4). The invariant is per-commit atomicity and never carrying a >30-min uncommitted blob — NOT one-commit-per-cycle.
  - NOT be pure cleanup, dead-code removal, test-only changes, dependency bumps, or refactors without user-visible payoff. Those belong to `/explorer` / `/architect`.

---

## Phase 0: Setup (memory root, ledger, worktree)

### 0a — Bootstrap the in-repo memory root

Bootstrap `docs/friend/` (idempotent — only create what's missing; never overwrite an existing file):

- `docs/friend/` (directory)
- `docs/friend/sessions/` (directory)
- `docs/friend/lessons/` (directory)
- `docs/friend/state.md` — header only:
  ```markdown
  # Friend State

  Claim board: which area each `/friend` session is working, and on which branch.
  Read at Phase 0 so parallel sessions don't land on the same files.

  ## Live

  ## Recent
  ```
- `docs/friend/coverage.md` — header only:
  ```markdown
  # Friend Coverage

  Heatmap of areas visited by `/friend`. Used by Phase 0 auto-pick to favor stale, high-yield areas.

  ## Areas
  ```
- `docs/friend/passes.md` — header only:
  ```markdown
  # Friend Passes

  Per-area record of directions that were proposed and **hard-rejected** in past sessions.
  Future Phase 2 proposals over the same area filter against these. Soft skips (user picked
  a different option) are NOT recorded here — only hard rejects (explicit "no", refresh of
  the whole menu with a reason, or "other" with a rejection note).

  ## Areas
  ```
- `docs/friend/preferences.md` — header only:
  ```markdown
  # Friend Preferences (distilled from /friend sessions)

  > Rules upgraded from `docs/friend/lessons/` after 3+ observations. Loaded by Phase 1; biases Phase 2.

  _No patterns yet. Will be populated as sessions accumulate._
  ```

Also read `docs/friend/state.md` now and claim the area for this session (see 0d). Never block on any of these being missing — degrade gracefully and create as you go.

### 0b — Read the active-runs ledger

Read `.claude/active-runs.md` (create it with `## Active` / `## Recently completed` headings if it doesn't exist yet) and the `## Live` section of `docs/friend/state.md`. Scan for entries whose declared `Paths:` overlap with the resolved area's path glob (see area→path mapping below) AND are `started`-status AND less than 2 hours old.

If overlap is found, present:

```
Heads up — another session is editing this area:
  <name> (started <hh:mm>, paths: <paths>)

What now? (Enter = proceed in worktree — physical isolation)
  1. other → free text
  2. proceed in worktree   ← default (recommended; worktree avoids collision)
  3. switch area
  4. abort
```

Default proceeds because `/friend` always runs in a worktree, so coexistence is safe; the prompt is informational so the user knows their commits land on a separate branch from the other session.

### 0c — Create the worktree

Compute a short slug: `friend-<area>-<HHMMSS>`. For example: `friend-financial-143012`.

```bash
SLUG="friend-<area>-$(date +%H%M%S)"
git worktree add ".claude/worktrees/$SLUG" -b "worktree-$SLUG"
cd ".claude/worktrees/$SLUG"
```

The entire loop runs inside the worktree. Branch name = `worktree-<slug>`. On clean exit (Phase 6), the worktree and branch are left in place — the user owns the merge decision.

### 0d — Register the run (ledger + claim board)

Append to `## Active` in the **main checkout's** `.claude/active-runs.md` (not the worktree's copy — they share the same file via git's worktree semantics, so the Edit lands in the same place):

```
### friend — <area>
- Started: <YYYY-MM-DD HH:MM>
- Status: started
- Branch: worktree-friend-<area>-<HHMMSS>
- Worktree: .claude/worktrees/friend-<area>-<HHMMSS>/
- Paths: <area's path glob — e.g. features/money/ lib/analysis/kg-money.ts>
- Note: /friend endless development loop
```

Add the mirror one-liner under `## Live` in `docs/friend/state.md`:
`- <area> — branch worktree-friend-<area>-<HHMMSS> — started <YYYY-MM-DD HH:MM> — paths: <glob>`

### 0e — Area → path mapping

For the ledger entry and for scoping the scan, resolve area to paths. Contexts come from `context-map.json` — use its `filePaths` as the authoritative list when you need file-level precision.

| Area | Contexts | Primary paths |
| --- | --- | --- |
| landing-nav | App Shell & Navigation, Landing Page | `features/shell/` `features/landing/` `app/page.tsx` |
| profiles-rankings | Velin Dashboard, MP Profile Dossier, CivicScore Leaderboard | `features/dashboard/` `features/profile/` `features/civicscore/` `app/dashboard/` `app/poslanec/` `app/zebricek/` |
| voting-legislation | LawWatch, VoteTrack | `features/lawwatch/` `features/votetrack/` `app/zakony/` `app/hlasovani/` |
| financial | BudgetMirror, Money Case Files & Human Review, FollowTheMoney Graph | `features/budget/` `features/money/` `app/rozpocty/` `app/penize/` `app/kauzy/` |
| graph-explorer | Graph Playground | `features/graph/` `lib/kg/` `app/graf/` |
| ingestion | Admin Console, Ingestion Normalization, Source Adapters | `features/admin/` `lib/ingest/` `app/admin/` |
| data-layer | Sample Data Fallback, Scoring & Verdict Copy, Knowledge Graph Domain Model, PGlite Repositories, PGlite Store & Runtime | `lib/civic/` `lib/analysis/` `lib/db/` |
| shared-ui | Shared Display Primitives, Archived Art Direction (Rentgen) | `features/shared/components/` `features/labs/rentgen/` |
| infrastructure | Custom ESLint Rules, Test Utilities & Loader Coverage, App Bootstrap & Global Styles, i18n & Number Formatting | `eslint-rules/` `lib/testing/` `app/layout.tsx` `app/globals.css` `lib/i18n/` `lib/format.ts` |

For free-text areas (Q1 option 1), resolve the hint → context (by name, `index` line, or `filePaths` match in `context-map.json`) → primary paths — the same resolver `/explorer` uses.

### 0f — Boot the verified-mode dev server (only if Q2b = yes)

If the user enabled verified mode, start **one** worktree-local dev server for the whole session (not per cycle):

```bash
# from inside the worktree
npm run dev   # Next.js + Turbopack
```

- Wait for the "ready" line and note the port it actually bound (Next picks the next free port if 3000 is taken — another session may already hold it). Probe the URL before the first verification.
- Frontend edits are picked up live by Fast Refresh — no restart. Changes to server-side loaders, `lib/db/` or config may need a restart; budget for it or batch them within a slice.
- Exercise the surface the way a user would: navigate to the route the direction touches, drive the interaction, and force the empty/loading/error states. Report what you actually saw.
- If the server can't be booted, tell the user once and downgrade the session to checklist-only verification rather than blocking the loop.

---

## Phase 1: Load memory + scan

### 1a — Read learning artifacts (once per session, not per cycle)

Read in parallel and hold in session context for the rest of the loop:

1. `context-map.json` — area taxonomy (9 groups / 25 contexts) and the `filePaths` for the resolved area.
2. `CLAUDE.md` — project rules (thin routes, token discipline, the `SourceNote` brand rule, quality gates, git discipline, known gotchas).
3. `docs/DESIGN.md` — the design system. Mandatory before any UI work.
4. `MEMORY.md` + any `memory/*.md` entries relevant to the area — hard-won facts, already paid for.
5. `docs/friend/preferences.md` — distilled rules from prior sessions. Treat each rule as a Phase 2 constraint (e.g. "user prefers inline detail expansion over route-level drilldowns" → bias proposals accordingly).
6. `docs/friend/passes.md` — the area's section, if present. Each line is a rejected-direction fingerprint. Phase 2 must filter against these.
7. `docs/friend/coverage.md` — last-visit date and acceptance density per area. Used by Phase 0 auto-pick; also surfaces here for the scan summary.
8. `docs/architect/strong-patterns.md` (if present) — canonical shapes recorded by `/architect`. Prefer these when proposing.
9. The 3 most recent files in `docs/friend/lessons/` (sorted descending) — recent self-reflection, e.g. "last session over-proposed net-new pages."

Skip any artifact that doesn't exist; never block on missing memory state.

### 1b — Scan the area (every session, lightweight)

Inside the worktree, do a **lightweight** scan to ground the proposals. Read budget: roughly **20–40 files**, weighted toward UI components and the most-recently-edited paths in the area. Do not exhaustively read everything — `/friend` is a fast loop.

Pull in parallel:

1. `git log --oneline --since="14 days ago" -- <area-paths>` — what's been moving here lately
2. `git diff --stat HEAD~10..HEAD -- <area-paths>` — recent volume by file
3. A `Grep` for `TODO|FIXME|XXX` scoped to the area
4. A `Grep` for `SourceNote|DataUnavailable` scoped to the area — where the evidence chain is already wired, and where a surface is still missing its citation or empty state
5. The group's `description` + its contexts' `index` lines in `context-map.json`
6. 5–10 most-recently-modified files in the area (Glob with sorted-by-mtime)

For the `surprise me` goal, also pull two random non-trivial files from the area to seed something less obvious.

Synthesize a **two-sentence area summary** for the user (skip in `surprise me` mode):

```
<Area>: <one sentence on what's here>. <one sentence on what's been moving lately>.
```

---

## Phase 2: Propose 5 directions

Produce **exactly 5** development directions. Each direction is:

```
N. <short title — verb-led, 3–6 words>
   What:  <one line, ≤90 chars — concrete UX/product change>
   Why:   <one line, ≤90 chars — the user-visible outcome once it lands>
   Files: <the actual files to touch, e.g. "features/money/components/TiesLedger.tsx, features/money/getMoneyData.ts">
```

A direction with no named files or no stated outcome is malformed — rework it or drop it before presenting.

Constraints on the 5:

- **Always development, always outcome-value.** UX polish with behavioral payoff, missing affordances, small new capabilities, clearer flows, new product surfaces. If a candidate is "remove dead code", "extract a hook", "add tests", "bump a dep", or cosmetic-only restyling, drop it.
- **Default mix:** `1 small polish (<1h) / 2 medium feature adds (1–3h) / 2 stretch (a complete vertical slice, ~2–5 atomic commits in one cycle)`. One of the five slots may instead be a **graduation candidate** (see "Graduation lane"). `surprise me` mode drops the small and adds a second stretch. If a session signals "dial down to polish" (user picks the small repeatedly, or says "smaller next time"), shift to `2 small / 2 medium / 1 stretch` for the rest of that session. **Do not hand back a half-feature to keep a cycle short:** if the honest unit of value is a vertical slice, propose the whole slice and deliver it as a commit sequence — but if the honest unit is bigger than one cycle in one area, that's a graduation candidate, not a stretch.
- **Prefer deepening existing surfaces over net-new surfaces** in an established feature area. If the area already has obvious adjacent polish (a control that needs a sibling, a flow that needs a recap card, a panel that needs a sub-view of its own data), build on what exists. Net-new surfaces (a new tab, a new sidebar rail, a new page-level panel) should be at most **1 of the 5**. The remaining 4 slots are for direct extensions of code already in the area. Reason: net-new surface ideas read well as menu items but rarely match the user's actual want when they're already iterating on a feature.
- **Two shapes for ambitious work — pick the honest one:**
  - **Vertical slice (default for self-contained features):** the whole feature lands *this cycle* as a sequence of atomic commits (e.g. `feat(db): add repository query` → `feat(money): expose it from the server loader` → `feat(ui): ledger column + filter` → `polish: empty/loading states`). Each commit typechecks and lints clean; the cycle is "done" only when the slice is whole and — in verified mode — observed working. This is the primary way `/friend` tackles real product work; reach for it freely.
  - **Stages-of-N (only when a gate between stages helps the user):** reserve this for work that is genuinely sequential *and* worth a human checkpoint mid-way — e.g. a risky `kg_node`/`kg_edge` shape change the user wants to eyeball before the UI builds on it. Mark it `Stage 1 of N — ships <X>; next stage wires <Y>.` If the arc would span days or multiple contexts, don't stage it — graduate it to `/perfect`.
- **Each commit is atomic; a cycle may be several.** Every commit individually typechecks and lints clean and represents one logical step. A polish cycle is one commit; a vertical-slice cycle is a short ordered sequence. Never carry more than ~30 minutes of uncommitted work between commits — other sessions share this tree. The old "one commit per cycle" rule is retired — it was a proxy for "don't bite off more than you can finish," which the model now handles directly.
- **Honor CLAUDE.md and docs/DESIGN.md.** Every direction must be implementable without violating token discipline, the `SourceNote` evidence rule, thin-route structure, the shared-component catalog, or the git discipline.
- **No repeats.** Track proposed-and-completed direction titles within the session; do not re-propose. Track proposed-and-rejected titles within the session too — only re-propose if the user explicitly says "you can re-propose."
- **Drop in-session 2× soft-skips.** Maintain a set of direction titles the user has soft-skipped (i.e. picked something else when this was on the menu) in the current session. If a title hits the set twice and is still unpicked, **stop re-proposing it for the rest of the session**. The same direction can return in a future session (it's not a hard reject), but burning a 5-slot menu position on something the user has already passed on twice is noise. Net-new-surface ideas in particular tend to keep getting re-proposed because they're easy to generate — this rule is the in-session brake.
- **Filter against `docs/friend/passes.md`.** Any candidate whose fingerprint (area + short title + one-line What) closely matches a past hard-reject in this area is silently dropped before presentation. If it's a *near*-match (same target file, different angle), surface it but annotate `↻ previously passed; resurfacing because <reason>`.
- **Honor `docs/friend/preferences.md`.** Distilled rules (e.g. "prefer inline detail expansion over route-level drilldowns in this codebase") are hard constraints, not suggestions. If a candidate violates a preference, drop it.
- **Honor `docs/architect/strong-patterns.md`.** When the area has a canonical shape (e.g. "an `async` server page awaits a `get*Data.ts` loader and passes typed props into the `"use client"` feature, with the `lib/civic` mock as fallback"), propose directions that reuse the canonical shape; reference the pattern by name in the direction body.

### Graduation lane (handoff to /perfect)

Multi-cycle themed arcs, multi-context builds, and anything wanting review gates belong to `/perfect` — its Director/Builder loop, acceptance pool, and per-context worktrees exist exactly for that. `/friend` does not run campaigns. Instead, when the scan surfaces a genuinely valuable idea that is **too big for one cycle in one area** (multi-context scope, schema break rippling across features, days-long arc, needs a human review gate), one menu slot may present it as a graduation candidate:

```
N. <idea title> — graduate to /perfect
   What:  <one line — the compounded payoff if the full build lands>
   Why big: <one line — multi-context / schema break / needs review gates>
```

If the user picks it: do **not** execute. Record the idea (title, what, why-big, files/contexts it spans) in this session's note (`docs/friend/sessions/…`) under `## Graduated to /perfect`, tell the user to run `/perfect propose` to feed it into the acceptance pool, then return to the `Next?` menu for a normal direction. Propose a graduation candidate **only** when something real rises to that bar — never pad the slot; fill it with a medium/stretch otherwise.

Present:

```
Area: <area>  Worktree: <slug>  Cycle: <n>

<scan summary, omit in surprise-me>

Next? (pick a number — Enter = 2)
  1. other → describe a direction in free text
  2. <Direction A title>                    ← default
  3. <Direction B title>
  4. <Direction C title>
  5. <Direction D title>
  6. <Direction E title>
  7. refresh — rescan and propose 5 new directions
```

For cycles 2+ in the same session, replace the scan summary with a one-line delta: `Since last cycle: <last commit title>, <files touched>`.

If the user types a stop word (`stop`, `done`, `bye`, `quit`, `exit`) in the free-text lane, jump to Phase 6.

---

## Phase 3: Risk gate

Before executing the chosen direction, you (the model) **silently judge** whether the path is materially risky. There is no hardcoded checklist — use judgment. Things that should trip the gate include but are not limited to:

- Changes to the graph schema (`kg_node` / `kg_edge`), the PGlite DDL, or migration snapshots
- Renaming or removing a server-only loader, a `get*Data.ts` contract, or a shared type in `lib/db/types.ts`
- Touching the human-review gate on money ties / forensic verdicts, or anything that would let `pending_review` data render as verified
- Changing how a number reaches the screen without carrying its `SourceNote` provenance — or inventing a value the graph does not contain
- Cross-area scope creep (the direction reads like one area but actually touches many contexts)
- Deleting >50 lines of any single file, or removing a component / module
- Anything that changes ingestion behavior (`lib/ingest/`) or rewrites stored rows
- Anything that affects code paths the user cannot easily verify locally
- Anything that would break `npm run check` beyond the file being touched, or require relaxing a custom ESLint rule

If the gate trips, pause and ask before acting:

```
Heads up: <one sentence on why this is risky, in plain language>.
<one sentence on the alternative shape if relevant>.

Proceed? (Enter = yes)
  1. other → describe an alternative
  2. yes
  3. narrower scope — describe the smaller version
  4. skip — pick a different direction
```

If the gate does **not** trip, execute immediately without asking. Do not ask for confirmation on routine UX/feature work — that is the entire point of the loop.

---

## Phase 4: Execute

Implement the chosen direction inside the worktree. Treat CLAUDE.md as binding. The non-negotiables most likely to apply on a `/friend` cycle:

### Frontend
- **Read `docs/DESIGN.md` before any UI work** — it is the design source of truth (Konstrukt: Sutnar functionalist poster). Section 1 covers tokens, 3 the evidence rule, 4 motion, 5 the app-content patterns established by Velín + Spis, 6 the component layers.
- **Reuse before building** — check the shared catalog at `features/shared/components/` before writing a widget (`SourceNote`, `DataUnavailable`, `SectionHeading`, `SectionRule`, `AnimatedScore`, `RankDelta`, …). A genuinely new reusable primitive goes there with a `@catalog` JSDoc one-liner, never into a feature folder. The catalog is domain-agnostic and lint-enforced: it must not import from `features/*` or `lib/civic` — pass data via props.
- **Colors originate in `app/globals.css` tokens only** — no hex, no raw `rgb()`, no arbitrary Tailwind color values. Enforced at error level by `custom/no-hardcoded-colors`; the only exceptions are the three declared in docs/DESIGN.md §1 (and `features/labs/` archived art directions).
- **Every rendered number cites its source** — `SourceNote` is the brand rule. Derived or human-gated values must be visibly marked as derived / `pending_review`. Never fabricate a number, a diff, or a stage the graph doesn't carry.
- **Czech-first copy** — user-facing strings are authored in Czech directly (`lang="cs"`). All number/date formatting goes through `lib/format.ts` (decimal commas) — that is the only place `.toFixed` is allowed for display.
- **Routes stay thin** — an `app/**/page.tsx` mounts a feature component and sets metadata; the logic lives in `features/<name>/`.
- **Errors** — no empty `catch {}` and no silent `catch { return null }`; enforced by `custom/no-silent-catch` and `custom/no-silent-null-catch`.
- **a11y & motion** — click-role elements need a keydown handler (`custom/role-button-requires-keydown`); looping motion needs a reduced-motion fallback (`custom/enforce-reduced-motion-fallback`, WCAG 2.3.3).
- **Known gotchas** — recharts `ResponsiveContainer` inside a CSS grid track needs `min-w-0` on the track plus a fixed-aspect `overflow-hidden` wrapper, or the page livelocks in a resize loop (docs/DESIGN.md §4). SVG coordinates computed from trig must be rounded to 2 decimals or SSR/CSR float drift trips React hydration (see `features/landing/components/Hemicycle.tsx`).

### Data & server boundary
- **The loader pattern** — an `async` server page awaits a server-only loader (`get*Data.ts` → `getStore()`), which returns typed props for the `"use client"` feature; when the store is unavailable the loader returns `null` and the feature falls back to the `lib/civic` mock. Follow it; `/hlasovani` + `features/votetrack/getVoteThemes.ts` is the template.
- **Never import server-only modules from a client component** — enforced at error level by `custom/no-server-import-in-client`.
- **Sample data lives in `lib/civic/data.ts`** — extend it, don't inline mocks in a component. `score` must equal `composite(pillars)`; the colocated vitest test enforces it.
- **Graph/schema changes** are additive only on a `/friend` cycle. Anything destructive trips the Phase 3 gate.

### Docs
- If the direction changes what a route shows or how it's wired, update the route's line in the `CLAUDE.md` route map in the **same commit**, and `docs/DESIGN.md` if you established a new visual pattern. `docs/feature-doc-map.json` maps source areas to their docs — check it before deciding nothing needs updating.

### Self-review (before validation)

Now that cycles run longer, spend one deliberate adversarial pass on the diff before validating — you are the only reviewer this code gets before it lands. Read your own `git diff` and check:

- **Correctness:** edge cases, null/empty/error states, off-by-one, races, stale closures, missing `await`. Would this break if the list were empty, the store unavailable, or the loader returned `null`?
- **Reuse & drift:** did you re-implement something `features/shared/components/` already has? A hex or raw color where a `globals.css` token belongs? A `.toFixed` outside `lib/format.ts`? An empty or silently-nulling `catch`? A server-only import reaching a client component?
- **Evidence:** does every number you rendered carry a `SourceNote`, and is anything derived or `pending_review` labelled as such? Did you invent any value the graph doesn't hold?
- **Scope:** does the diff touch only files this direction needed? Anything accidental swept in?

For a small polish cycle, do this inline. For a vertical-slice cycle (multi-file, multi-commit), spawn a `general-purpose` review subagent on the staged diff (or run `/code-review`) and fix what it surfaces before committing — cheap insurance against a plausible-but-wrong change shipping. Fix findings in the worktree, then validate.

### Validation (before the commit)

`npm run check` (typecheck + lint + test) is **the** gate — it must be green before the cycle is reported done.

For fast inner loops between commits in a slice, the individual legs are fine:

- `npm run typecheck` — `tsc --noEmit`, after any `.ts`/`.tsx` change.
- `npm run lint` — eslint including the 6 custom error-level rules in `eslint-rules/`. The lint is clean and error-level: **no baseline, no allowed warnings.** Any new finding is yours to fix.
- `npm run test` — vitest. Cheap here; don't skip it just because the cycle "didn't touch tests" — the colocated `lib/**` tests pin data invariants that UI work can break.

Run the full `npm run check` at least once per cycle before the last commit lands. If a check fails: fix inline in the worktree, re-validate, then commit. Do **not** stack failing work into the next cycle.

### Commit

**One commit per logical step**, Conventional Commits format (CLAUDE.md → Git discipline). A polish cycle is a single commit; a vertical-slice cycle is an ordered sequence — commit each step as soon as it typechecks and lints clean, never batch the whole slice into one mega-commit. Message shape per commit:

```
<type>(<scope>): <imperative title for this step>

<2–4 sentences: what changed, why user-visible. No bullet lists.>

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

`<type>` from {`feat`, `feat(ux)`, `feat(ui)`, `polish`}. `/friend` rarely produces `fix` / `refactor` / `chore` — if you find yourself reaching for those types, the direction was probably stabilization and should have been rejected at Phase 2.

Stage only the files you intentionally touched (`git add <path>` per file, never `git add -A` / `git add .` / `git add -u`). Before **each** commit, verify the staged count matches what you intended: `git diff --cached --stat`. If the staged-file count exceeds what you wrote, run `git restore --staged <unrelated-file>` per file before committing. This is CLAUDE.md's "Git discipline" section verbatim, and it matters more across a multi-commit slice — re-check the index before every commit in the sequence, since a parallel session may have pre-staged files between your commits.

After each commit: `git rev-parse --short HEAD` to capture the SHA. Collect the range (`<first-sha>..<last-sha>`) for the report.

---

## Phase 4.5: Verify (verified mode only)

Skip this phase entirely if the session is not in verified mode (Q2b = no) — the Phase 5 report carries a manual-verify checklist instead (see below).

In verified mode, after the cycle's commits land, **prove the change works before reporting it done** — a green `npm run check` is not evidence of behavior:

1. Ensure the worktree-local `npm run dev` server (Phase 0f) is up and has the change — client edits arrive via Fast Refresh; server-loader / `lib/db/` / config changes may need a restart.
2. Exercise the actual scenario the direction claims to deliver: open the route in a browser, drive the interaction, and force the empty / loading / error states. Look at what actually renders — the new control, the numbers and their `SourceNote`s, the Czech formatting.
3. If the observed behavior contradicts the claim, the cycle is **not done** — fix in the worktree, add a follow-up atomic commit, and re-verify. Never report a red scenario as green.
4. Record what you drove and saw for the Phase 5 report (`Verified: <route + scenario> → <observed>`).

If the dev server is unavailable this cycle, downgrade *this cycle* to the manual-verify checklist (don't silently claim done) and note the downgrade in the report.

**Manual-verify checklist (non-verified sessions, behavior-changing cycles):** the report must end with a short, concrete `To verify:` list — the route, the exact clicks/inputs, and the expected result — so the user (or a later verified cycle) can confirm the change by hand. A cycle that changed user-visible behavior is never reported as flatly "done" without either an observed verification or this checklist, and **if the change is visually meaningful the report must say in plain words that it was not visually verified.**

---

## Phase 5: Report + propose next 5

Print the report:

```
✓ <direction title>  (cycle <n>)
  Commits: <first-sha>..<last-sha>  (<count>)  ·  Files: <N>  ·  +<a>/-<b>
  Did:  <one sentence — what changed, behavior-first>
  Checks: npm run check <✓|✗>  (typecheck <✓|—>  lint <✓|—>  test <✓|—>)
  Verified: <route + scenario → observed | NOT visually verified — checklist below | — no behavior change>
  Worktree: .claude/worktrees/<slug>/   Branch: worktree-<slug>

<non-verified + behavior changed only:>
  To verify: <route → exact clicks/inputs → expected result>

Since last cycle: <previous direction or "first cycle">

Next? (Enter = 2)
  1. other → describe a direction
  2. <new Direction A>                    ← default
  3. <new Direction B>
  4. <new Direction C>
  5. <new Direction D>
  6. <new Direction E>
  7. refresh — rescan area and propose fresh
```

The 5 new directions follow the same constraints as Phase 2:
- Always development; no stabilization.
- Spread across the calibrated mix (small / medium / stretch, optional graduation slot — see Phase 2). Every direction names its files and outcome.
- Do not re-propose anything already executed or rejected this session.
- May build on the just-completed cycle (e.g. if cycle N landed a new control, cycle N+1 could propose a polish on it) but should not require it — the user should be able to pick any of the 5 independently.

Loop back to **Phase 3** with the chosen direction (a picked graduation candidate is recorded, not executed — see Graduation lane). The loop has no built-in stopping condition.

---

## Phase 6: Clean exit + learn

Triggered by: user typing a stop word in the free-text lane, an explicit interrupt, or the context window forcing a wrap. This is also where `/friend` gets smarter — every session must close the learning loop, not just save work.

### 6a — Stabilize the worktree

1. **If anything uncommitted:** decide whether to commit. If the last cycle was interrupted mid-execute, prefer to discard the partial change (`git restore .`) rather than commit broken work; surface this decision to the user with a numbered confirm if they are still responsive.
2. **Update active-runs.md** in the main checkout: move your `## Active` entry to the top of `## Recently completed`. Status: `completed (branch: worktree-<slug>, commits: <count>, last: <sha>)`. Keep the entry under 6 lines. Move the matching `docs/friend/state.md` line from `## Live` to `## Recent` the same way.

### 6b — Capture rejection reasons (one batched question)

Before writing the learning artifacts, ask the user a single batched question to attribute *why* the unpicked directions were unpicked. This is what makes `passes.md` and the preferences file actually useful — the title alone isn't enough signal.

```
For the directions you didn't pick this session, was it:
  [from cycle N] {title}
  [from cycle M] {title}
  ...

Reply per-item ("N: too risky, M: wrong layer") or one overall reason.

Shortcuts:
  skip    — record "no reason given" (still a soft skip, not a hard reject)
  hard <ids>  — mark these as hard rejects in passes.md (e.g. "hard N,M")
  Enter   — same as "skip"   ← default
```

Distinguish:
- **Soft skip** (default for unpicked) — could be re-proposed in a future session; does NOT land in `passes.md`. Recorded in the session note only.
- **Hard reject** (user typed `hard <ids>` or gave a reason that reads as principled refusal, e.g. "wrong direction", "we already tried this", "doesn't fit the product") — lands in `passes.md` so future sessions skip it.

### 6c — Write the session note

`docs/friend/sessions/{YYYY-MM-DD}-{slug}.md`:

```markdown
# Friend session: {area} — {YYYY-MM-DD HH:MM}

Worktree: `.claude/worktrees/{slug}/`
Branch: `worktree-{slug}`
Cycles: {N}
Commits: {first-sha}..{last-sha}

## Cycles

### Cycle 1 — ✓ {title} ({sha})
- What: {one line}
- Files: {N}, +{a}/-{b}
- Other proposed (soft-skipped): {titles}

### Cycle 2 — ✓ {title} ({sha})
- ...

## Hard rejects this session

- [{area}] {title} — {reason} (→ added to passes.md)

## Graduated to /perfect

- {title} — {what} — why big: {multi-context / schema / review-gate reason} — spans: {files/contexts}
  (user directed to `/perfect propose`; omit section if nothing graduated)

## Cross-references

- Related preferences: [preferences](../preferences.md)
- Strong patterns referenced: [architect strong-patterns](../../architect/strong-patterns.md) §{pattern-name}
- Contexts touched: {names from context-map.json}
```

### 6d — Append the lesson note

Write/append `docs/friend/lessons/{YYYY-MM-DD}.md`:

```markdown
## Session: {timestamp} — {area} ({N} cycles)

Accepted: [list of titles]
Hard-rejected: [list with reasons]
Soft-skipped: [list]

### Self-reflection
- Direction shapes that resonated: {pattern observed}
- Direction shapes that didn't: {pattern observed}
- Calibration drift: {e.g. "proposed 4 net-new routes out of 15; only 1 picked — over-weighting new surfaces in the money area"}
- Tools/files I should have read earlier: {observation}
- Strong patterns I should reuse more: {observation}
```

### 6e — Update `passes.md`

For each direction marked hard-reject in 6b, append a fingerprint to `docs/friend/passes.md` under the area's section (create the section if missing):

```markdown
## {area}

- {short-title} — {one-line What from the proposal} — pass {date}, session {slug}, reason: {short reason}
```

Keep entries short. The fingerprint is what Phase 2 filters against next session.

### 6f — Update `coverage.md`

Update or insert the row for this area in `docs/friend/coverage.md`:

```markdown
## Areas

### {area-slug}

- Last visited: {date}
- Last session: [{date}-{slug}](sessions/{date}-{slug}.md)
- Contexts touched: {names from context-map.json}
- Cycles last 3 sessions: [3, 5, 2]
- Acceptance density last 3 sessions: [3/8, 5/15, 2/6]   <!-- picked/proposed -->
- Notes: {anything noteworthy across sessions}
```

### 6g — Pattern promotion check

Read all `docs/friend/lessons/*.md` (cap at the last 20 files for speed). If any single observation — accepted shape or rejected shape — has appeared in **3+ sessions** with close-synonym phrasing, propose promoting it:

```
I've seen this 3+ times across sessions — promote to a permanent preference?

  "{distilled rule, e.g.: prefer inline detail expansion over route-level drilldowns in features/money/}"

Source sessions: docs/friend/sessions/2026-05-01-friend-financial.md, …-05-06-…, …-05-12-…

Next? (Enter = 1)
  1. promote to docs/friend/preferences.md   ← default
  2. snooze — re-ask after 3 more observations
  3. drop — don't promote, reset the counter
```

If the user picks 1 (or Enter), append to `docs/friend/preferences.md` with the rule + relative links to the source session notes. This is the slow loop that makes Phase 2 better over weeks of use.

**Escalation to project memory.** If the promoted rule (or anything else the session surfaced) is a *durable, non-obvious, cross-session fact about the repo* rather than a taste preference — the bar from CLAUDE.md → "Agent memory": worth recalling in three months **and** not derivable in ten seconds from `docs/` — also record it through the project memory system: a new `memory/<slug>.md` (terse `name` + `description` frontmatter, then the fact and why it matters) plus its one-line index entry in the root `MEMORY.md`. Preferences stay in `docs/friend/preferences.md`; repo facts go to `memory/`. No filler, no restating the docs.

### 6h — Print the exit summary

**Do NOT auto-merge to master.** Do NOT delete the worktree or branch. The user owns the merge decision. Print:

```
Session done.
  Branch:    worktree-{slug}
  Worktree:  .claude/worktrees/{slug}/
  Commits:   {count}  ({first-sha}..{last-sha})
  Area:      {area}
  Acceptance: {picked}/{proposed}  ({pct}%)

To merge: from the main checkout,
  git merge --no-ff worktree-{slug}
To inspect first:
  git log --oneline worktree-{slug} ^master
  git diff master...worktree-{slug}
To discard:
  git worktree remove .claude/worktrees/{slug} && git branch -D worktree-{slug}

Files updated:
  + docs/friend/sessions/{date}-{slug}.md
  + docs/friend/lessons/{date}.md
  ~ docs/friend/coverage.md
  ~ docs/friend/state.md                (claim moved Live → Recent)
  ~ docs/friend/passes.md               (if any hard rejects)
  ~ docs/friend/preferences.md          (if pattern promoted)
  ~ memory/{slug}.md + MEMORY.md        (if a durable repo fact was recorded)
  ~ .claude/active-runs.md              (ledger entry moved to completed)
```

The `docs/friend/` artifacts are in-repo files: stage them per-path like any other change (`git add docs/friend/<file>`) and commit them as `docs(friend): session {slug}` on the worktree branch.

---

## Learning artifacts (how the loop gets smarter)

`docs/friend/` holds three artifacts that turn `/friend` from a stateless proposer into a sharpening tool over time. Mirror of `/explorer`'s machinery and of `docs/architect/`, scoped to development directions:

| File | Lifecycle | What it does |
| --- | --- | --- |
| `docs/friend/passes.md` | Append on hard-reject (Phase 6e). Read in Phase 1 / used in Phase 2 filter. | Stops `/friend` from re-proposing directions the user already principled-refused. Title-level fingerprint per area. |
| `docs/friend/preferences.md` | Append after 3+ observations (Phase 6g). Read in Phase 1 / hard constraint in Phase 2. | Distilled rules ("prefer X over Y in this codebase"). Slow loop; one promotion per session at most. |
| `docs/friend/lessons/{date}.md` | Append every session (Phase 6d). Last 3 read in Phase 1. | Per-session self-reflection. Source signal for the promotion check. |

Two more: `docs/friend/coverage.md` — last-visit dates and acceptance density per area, which powers the Q1 auto-pick weighting (Phase 6f); and `docs/friend/state.md` — the claim board that keeps parallel sessions off each other's files (Phase 0). Durable *repo facts* (as opposed to taste preferences) escalate out of this tree entirely, into `memory/<slug>.md` + `MEMORY.md`.

Never block on any of these being missing — degrade gracefully. The first 2–3 sessions over a new area will run with no learned signal, and that's fine; the artifacts populate themselves.

### Pacing expectations (so users don't read "smarter over time" as "smarter on cycle 2")

The `docs/friend/` learning loop is real but **slow on purpose**. Concretely:

- **Session 1 over a new area:** zero patterns loaded, zero passes. Phase 2 proposals are pure scan-driven. The session writes its first Lesson entry. Expect this to feel like a stateless skill.
- **Sessions 2–3:** the in-session sticky-drop and any soft-skip filtering still come from current-session memory; cross-session signal only kicks in via the Lesson notes the model reads at Phase 1, which influence proposal *shape* but rarely cause hard filtering yet.
- **Session 3–4** is typically the first time the pattern-promotion check at Phase 6g triggers — 3+ observations of a close-synonym phrasing across lesson notes promotes a rule to `docs/friend/preferences.md`, which becomes a *hard constraint* in Phase 2 from then on.
- **Session 5+:** the area starts feeling like it has a personality. Promoted preferences filter out shapes the user has rejected before; coverage scoring routes auto-pick to fresher areas; passes.md keeps the same bad idea from resurfacing.

If the user expects "/friend will adapt to my taste by cycle 2," they'll be disappointed. The right mental model: **the skill is sharpening, not adapting on every turn.** Surface this expectation in the Phase 6 exit summary on early sessions ("first pattern promotion typically happens around session 3–4 as observations accumulate") so the slow-loop design doesn't read as a missing feature.

---

## Non-goals (do not do these)

- **No stabilization.** If a direction reduces to lint cleanup, dead-code removal, type tightening, or test addition without behavior change, drop it from the Phase 2 menu. Suggest the user run `/explorer` for that area.
- **No fabricated data.** Never invent a number, a diff, a stage, or a source to make a surface look complete — politicas' entire premise is that every rendered number cites its provenance. Missing data is an empty state, not a placeholder value.
- **No non-atomic commits.** A cycle may span several commits (a vertical slice), but every *individual* commit must typecheck and lint clean and represent one logical step — never commit broken intermediate state, and never let an uncommitted slice grow past ~30 minutes. If a step can't be made atomic, it isn't ready to commit.
- **No cross-area scope creep.** If executing a chosen direction reveals it needs to touch files outside the area, Phase 3's risk gate should trip and ask the user — often the right answer is graduating it to `/perfect`.
- **No orchestration.** No builder subagent fleets, no multi-cycle autonomous arcs, no acceptance pools — that machinery is `/perfect`'s. `/friend` executes exactly one picked direction per cycle, in-session.
- **No auto-merge.** The worktree and branch are left for the user to inspect and merge on their own time.
- **No silent stash, no reset.** Per CLAUDE.md's git discipline: never `git stash` work that isn't yours, never `git reset --hard`, never `git clean`. Use `git add <path>` per file in Phase 4 and verify the staged count with `git diff --cached --stat`.
- **No `--no-verify` / `--no-gpg-sign`.** If a hook fails on commit, fix the underlying issue.
- **No memory writes** about routine cycles. Only add a `memory/<slug>.md` entry (+ `MEMORY.md` index line) when the session surfaced a durable, non-obvious fact that clears the CLAUDE.md bar — worth recalling in three months and not derivable in ten seconds from `docs/`.

---

## Quick reference (one-screen)

```
/friend
  Q1:  Area? (1=other, 2..10=group, 11=pick for me)       ← Enter = 11
  Q2:  Goal? (1=other, 2=scan-and-propose, 3=surprise)    ← Enter = 2
  Q2b: Verified loop? (2=no, 3=yes)                       ← Enter = 2 (no)
  →  Phase 0  docs/friend/ + state claim + ledger + worktree (+ npm run dev if verified)
  →  Phase 1  load passes + preferences + recent lessons + context-map/CLAUDE/DESIGN, then scan
  →  Phase 2  propose 5 dev directions (each names files + outcome)
              mix: 1 small / 2 medium / 2 stretch  (one slot may be a /perfect graduation)
LOOP:
  →  Phase 3   silent risk gate; ask only if risky
  →  Phase 4   execute slice → self-review → npm run check → atomic commit(s)
  →  Phase 4.5 verified mode: exercise the route on npm run dev
               (else manual-verify checklist + say "not visually verified")
  →  Phase 5   report + propose 5 new directions  ─┐
                                                   │ user picks number → Phase 3
                       (graduation pick → record in session note, point at /perfect)
EXIT (stop word / interrupt / context wrap):
  →  Phase 6  capture rejections → session note → lessons → passes → coverage
              → pattern-promotion check (→ memory/ if it's a repo fact)
              → ledger → exit summary
              (worktree + branch left intact for user merge)
```

## App context coverage (Personas-managed repos)

This skill declares `contexts: tracked` — the Personas app measures per-context memory coverage for it. When run inside a Personas-managed repo (a `.personas/` dir exists, or the app dispatched this run), record progress into the Project Memory Ledger so the Skills Manager shows honest coverage. Before finishing, append JSON lines to `.personas/memory-outbox.jsonl` at the repo root (append, never rewrite) — one node per context you meaningfully worked on:

```json
{"type":"node","kind":"progress","title":"<=200 chars: what you did in this context","body":"optional detail","context":"<exact context name from context-map.json>","skill":"friend"}
```

`"context"` must be one of this repo's 25 context names, spelled exactly as in `context-map.json`: App Shell & Navigation · Landing Page · Velin Dashboard · MP Profile Dossier · CivicScore Leaderboard · LawWatch · VoteTrack · BudgetMirror · Money Case Files & Human Review · FollowTheMoney Graph · Graph Playground · Admin Console · Ingestion Normalization · Source Adapters · Sample Data Fallback · Scoring & Verdict Copy · Knowledge Graph Domain Model · PGlite Repositories · PGlite Store & Runtime · Archived Art Direction (Rentgen) · Shared Display Primitives · Custom ESLint Rules · Test Utilities & Loader Coverage · App Bootstrap & Global Styles · i18n & Number Formatting.

Always set both `"skill":"friend"` and `"context":"<name>"` — together they drive the per-skill context-coverage % (last 30 days). The app ingests and deletes the file when the session ends. Skip silently when the repo is not Personas-managed.
