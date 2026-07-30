---
name: architect
description: Heavy-hitter structural scan of the politicas codebase — parallel-agent sweep over a theme or area, findings triaged into execute/queue/drop, with a durable in-repo backlog of ADRs under docs/architect/. Use for deliberate, high-effort sessions (a class of bugs eliminated, a convention promoted to lint-enforced rule), not for paper cuts.
argument-hint: "[decision or topic]"
---

# Architect (politicas)

Heavy-hitter codebase scan for **structural patterns** — both weak ones to upgrade and strong ones to codify. Designed for rare, deliberate, high-effort sessions where the payoff is a class of bugs eliminated, a tech swap landed, or a convention promoted from "tribal knowledge" to "lint-enforced rule."

Adapted from the personas `/architect` skill. Politicas differences:
- Durable memory lives **in-repo** under `docs/architect/` (no Obsidian vault).
- Taxonomy comes from `context-map.json` (24 contexts / 8 groups) + `CLAUDE.md` + `docs/DESIGN.md`.
- Validation gate is `npm run check` (typecheck + lint + test). No cargo/tauri.
- Cross-session lessons go to the project memory system (`memory/*.md` + `MEMORY.md` index), not a Lessons folder.

## Interaction conventions

Every user prompt is a numbered menu; numeric input picks, **Enter** picks the default. Multi-finding triages use `<id>=<verdict>` syntax (`1=2 2=1`), `all=<n>` accepted. When running autonomously (user asked to "run" without follow-up), take the documented defaults and say so.

## Input

### Q1 — Mode

```
Mode? (Enter = scan)
  1. scan      — pick a theme, parallel-agent sweep        ← default
  2. area      — bound the sweep to one context-map group
  3. resume    — drain the backlog (skip scanning)
```

### Q2a — Theme (scan mode)

```
Theme? (Enter = pick for me)
  1. other → describe (free-form)
  2. data-loading-boundary   (server loader → client feature, mock fallback)
  3. state-management
  4. error-handling
  5. data-modeling           (kg schema, repositories, store)
  6. testing-strategy
  7. type-safety
  8. i18n-and-formatting     (cs-first, lib/format.ts, messages/*)
  9. design-token-discipline
  10. pick for me   ← default (uses docs/architect/coverage.md staleness)
```

### Q2b — Area (area mode)

Options map 1:1 to the 8 groups in `context-map.json`: Landing & Navigation, MP Profiles & Rankings, Voting & Legislation, Financial Transparency, Data Ingestion, Data Layer, Shared UI Primitives, Infrastructure & Observability.

## Constants

- **Reference files:** `context-map.json`, `CLAUDE.md`, `docs/DESIGN.md`, `MEMORY.md` (+ any `memory/*.md` it points at), `docs/data-analysis/*.md` for graph work.
- **Memory root:** `docs/architect/`
  - `scans/` — one note per scan run (synthesis output)
  - `decisions/` — one ADR per accepted decision
  - `backlog.md` — durable queue of accepted decisions with status
  - `strong-patterns.md` — load-bearing patterns, kept for codification
  - `weak-patterns.md` — anti-patterns with reach data
  - `coverage.md` — themes/areas scanned, staleness
- **Categories** — `weak-pattern | strong-pattern | tech-swap | structural-bug-class | convention-gap`
- **Risk** 1–5 · **Effort** s/m/l/xl · **Payoff** 1–5 · **Reach** — always a concrete count ("N files / M call sites"), never vague.

## Phase 0: Bootstrap

If `docs/architect/` or any of its files are missing, create them with empty-section skeletons (Pending/Shipped/Abandoned for backlog; Patterns heading for the pattern files; Themes/Areas for coverage).

## Phase 1: Load context & memory

Read in order: `CLAUDE.md`, `context-map.json` (scope resolution), `docs/DESIGN.md` (if UI-relevant), `MEMORY.md`, then `docs/architect/{strong-patterns,weak-patterns,backlog,coverage}.md`. Aging review: any strong-pattern entry with `Codification status: noted`, age > 60 days, and no `Last reviewed` within 30 days is **aging** — surface it in Phase 5.

## Phase 2: Mode dispatch

scan/area → Phase 3. resume → Phase 9.

## Phase 3: Parallel scan

Spawn **3–5 `Explore` sub-agents in parallel** (single message), each a different angle on the theme. Default angles: usage map, type/contract, failure mode, performance surface, test coverage — pick the ones that fit the theme. Area mode bounds every angle to the group's files from `context-map.json`.

Sub-agent prompts are self-contained (they have no session context): theme, scope, 1-paragraph background, 3 tailored questions, and this report shape — files inspected (top 30), observed shapes with file:line, inconsistencies, outliers, smell strength 1–5, cross-references. Sample strategically; report shape, not exhaustive detail.

Synthesize: convergence (multiple angles, same module → high confidence), conflict (strength vs weakness → context-dependent), surprise (usually the most valuable finding), reach quantification. If all smell strengths are 1–2, the area is healthy — **say so**; don't manufacture findings. Cap findings at **8**, ranked by `(reach × payoff) / (risk × effort)`.

## Phase 4: Cross-check memory

Before presenting, check each finding against `strong-patterns.md` (conflict = most interesting finding of the run), `backlog.md` (duplicate → merge, re-confirm with new reach), `weak-patterns.md` (update existing entry rather than duplicating).

## Phase 5: Present findings

Summary table (`# Type Sev R E Reach Title`), then per-finding detail: type, reach, risk, effort, payoff, current shape (with file:line examples), proposed shape (with canonical example), migration plan (3–7 independently-shippable steps), risks with mitigations, already-on-radar link. Strong patterns get: reach, why it works, codification vehicle, risk-to-losing. Then an Aging block for Phase-1 aging patterns, if any.

## Phase 6: Triage

```
Per finding: 1=execute now  2=queue ← default  3=drop  4=rework
Strong patterns: 1=codify  2=note ← default  3=drop
Aging: 1=codify ← default  2=snooze (30d)  3=drop
Reply "<id>=<verdict>" space-separated, "all=<n>", or Enter for defaults.
```

Only one "execute now" per session recommended — warn if more. rework → ask for the right shape, re-present or queue as `proposed (needs reshape)`.

## Phase 7: Execute (one decision)

**7a. Branch** — default: commit on the current branch. Offer `architect/<slug>` branch only when clean separation matters; never push toward branching.

**7b. ADR first** — write `docs/architect/decisions/{YYYY-MM-DD}-{slug}.md` before touching code: frontmatter (date, slug, status: in-progress, type, reach, risk, effort, payoff), Context, Decision, Consequences (+mitigations), Rollout (numbered atomic commits, each with its validation), Acceptance criteria, Regression checklist.

**7c. Pre-flight** — do NOT require a clean tree; other sessions share it. `git status --short`, classify each dirty path (someone else's in-flight / pre-existing in your touch zone → surface to user / yours). Capture baselines: `npm run typecheck`, `npm run lint`, `npm run test`. Record in the ADR. **Forbidden:** `git stash`, `git reset --hard`, `git restore`/`checkout --` on others' paths, `git clean`, `git add -A`/`.`/`-u` (per CLAUDE.md git discipline — stage per-file, always).

**7d. Atomic commits per rollout step** — apply, validate, compare to baseline (delta, not absolute), stage only the exact paths touched, commit as `refactor(architect): <step>` (or `feat`/`fix`/`chore` as fits Conventional Commits), body referencing the ADR. Record SHAs in the ADR.

**7e. Final sweep** — full `npm run check` (+ `npm run build` for risky changes), walk the regression checklist. Unverified items → ADR stays `in-progress`, never claim shipped.

**7f. Frontend rules (non-negotiable)** — colors only via `app/globals.css` tokens (lint-enforced); every rendered number cites its source (`SourceNote`); Czech-first strings via `messages/cs.json`+`en.json`; Czech number formatting via `lib/format.ts`; check `features/shared/components/` before building widgets; routes stay thin. Visual verification: `npm run dev` and exercise the surface — state explicitly when you have NOT visually verified.

## Phase 7B: Codify strong patterns

Vehicles: **lint-rule** (`eslint-rules/*.js` — follow the 4 existing custom rules' shape, register in `eslint.config.mjs`, error level per project policy but warn first if violation count is large), **docs-claude** (CLAUDE.md convention), **docs-design** (docs/DESIGN.md section), **test-guard** (vitest structural test walking the tree). Pick per the pattern's nature; combinations fine, one commit each. Then update the `strong-patterns.md` entry (Codification status, date, ADR link) and write a mini-ADR (`decisions/{date}-codify-{slug}.md`).

## Phase 8: Backlog queued decisions

Stub ADR (`status: proposed`, sketchy rollout OK) + backlog entry under Pending (sorted by `(reach × payoff)/(risk × effort)`) + weak/strong-patterns entry with reach, trend, examples. Never persist strong patterns the user dropped.

## Phase 9: Resume mode

Print the Pending table, let the user pick (Enter = top item). **Refresh the ADR first** — re-verify file:line anchors, re-count reach, check git log on touched files; if anything material changed, present the delta before executing. Then run Phase 7c–7f.

## Phase 10: Self-reflection & memory

Ask (batched, skippable) why dropped findings were dropped. If the run surfaced a durable non-obvious fact, record it via the project memory system (`memory/<slug>.md` + `MEMORY.md` index line) — bar: worth recalling in 3 months and not derivable from docs. Update `coverage.md` (theme, last scan, findings/actioned counts, yield density).

## Phase 11: Persist the scan

Write `docs/architect/scans/{YYYY-MM-DD}-{slug}.md`: frontmatter (mode, theme/area, sub-agent count, finding counts, triage outcome, ADRs, commits), per-finding verdicts, strong patterns observed, cross-references.

## Phase 12: Final summary

Print mode, theme, sub-agent count, findings by category, triage outcome, files updated, and a numbered `Next?` block (resume / new scan / done).

## Notes on use

- Cadence: weekly at most. Alternate scan (fill queue) and resume (drain it).
- Coexist with uncommitted work — never stash/reset/clean; stage per-file only.
- A finding contradicting a recorded strong pattern is the most interesting finding of the run.
- Never propose a tech swap with reach ≥100 files unless smell strength is 5.
