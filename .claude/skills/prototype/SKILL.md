---
name: prototype
description: Iteratively prototype a UI surface through directional variants behind a tab switcher, then consolidate and refactor the winner. Use when the user wants to master a component/page they consider a pillar of the app (visual appeal, creativity, UX clarity).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Prototype — Directional Variant Workflow (Politicas)

A disciplined A/B prototyping loop for refining a UI surface. Start from a named file (or a new surface), produce radically different **directional** variants behind a tab switcher, let the user prune/fuse across rounds until one direction wins, then consolidate + refactor.

This is the Politicas-tuned copy of the workflow (adapted from kp). It replaces kp's design system references with this repo's actual state: a young Next 16 + Tailwind v4 app whose visual philosophy is *itself being established* through the landing prototype.

---

## When to use

The user says things like "help me master this component", "prototype ideas on top of X", "this is a pillar of the app and I want it to be amazing", "create N design variants". The request carries an **open direction** and a **visual quality bar**, not a specific change list. A *new* surface is in scope too — skip "verify the rendered file" and scaffold the switcher fresh.

## When NOT to use

- Fixed-scope requests ("change the button color") — just edit.
- Bug fixes.
- Non-visual code (ingestion, scoring, API routes, the entity-resolution layer).
- User asks for "three layouts" but wants them all shipped — that's a build task.

---

## Politicas house rules

1. **The design system is DECIDED — Konstrukt won (2026-07-22).** Tokens live in `app/globals.css`; the canonical reference is `docs/DESIGN.md` (read before building UI). Literal hexes are allowed only in the three declared zones (`features/landing/palette.ts`, `features/labs/**`, party colors in `lib/civic/data.ts`) — `custom/no-hardcoded-colors` enforces this. New prototype variants for module surfaces still explore *within* the Konstrukt language unless the user explicitly opens the art direction.
2. **Evidence-first is the brand, in every variant.** Whatever the art direction, every number rendered on a Politicas surface carries a source citation (dataset + cadence — mono uppercase "zdroj:" lines in Konstrukt, `[source]` log stamps in Rentgen). A variant that drops citations to look cleaner is off-brand by definition (politicas.md §6: "visible source citations everywhere").
3. **Party colors are data, not decoration.** `partyColor` chips (see `app/landing/data.ts`) may appear only as small data swatches; they never compete with the variant's single accent color.
4. **Non-partisan tone.** Copy presents ties as *sourced facts, never accusations*. Sample data stays clearly illustrative (mock MPs, mock IČOs).
5. **Fonts are already wired** in `app/layout.tsx`: `font-serif` = Fraunces (editorial display), `font-sans` = Archivo (variable to Black), `font-mono` = IBM Plex Mono (citations, logs). Prefer these before adding a new face; a new face needs a reason the existing three can't cover.

---

## Reference material

- **Design/architecture source of truth:** `C:\Users\kazda\kiro\opendata\docs\politicas.md` (§6 = design language) and the module prototypes in `C:\Users\kazda\kiro\opendata\src\cases\{civic-score,vote-track,follow-the-money,budget-mirror,law-watch}/` — mine their interaction models (hemicycle, sankey, network board, treemap, diff), not their retired palettes.
- **Sample data:** `lib/civic/data.ts` — MPs, pillars, modules, sources, money-trail graph. Extend it rather than inventing new inline mocks (colocated tests assert its invariants).
- **The decided system:** Konstrukt (Sutnar functionalist poster) is the parent design language — live at `/`, split into `features/landing/`. Rentgen (investigative evidence terminal) is archived at `features/labs/rentgen/` (`/rentgen`) and remains a legitimate reference to mine for investigative sub-surfaces (FollowTheMoney drill-downs). Broadsheet was rejected in round 2; its lead story + standings were fused into the survivors. **All copy is Czech-first.**

---

## Step 0: Collect the starting surface

If the user named a concrete path or unambiguous surface, use it. Otherwise ask **one short question** and wait. Don't guess — picking the wrong file wastes rounds. For a new surface, confirm the target folder, then go straight to Phase 2.

## Phase 1: Verify the actually-rendered component

1. Read the named component.
2. Grep for JSX usage (`<{Name}\b`) and imports.
3. If zero JSX usages, find what actually renders (in this repo, routes are thin: `app/*/page.tsx` mounts a feature component — the landing mounts `features/landing/LandingPage.tsx`).
4. Confirm in one sentence before proceeding.

## Phase 2: Scaffold the tab switcher

1. Rename the current export to `{Name}Baseline`; or for a new surface, create the host.
2. Re-export the original name as a wrapper holding `variant` state with a small labelled tab strip (label + 1-line hint each), delegating the body to the active variant. Same Props as the surface already uses — consumers untouched.
3. Baseline stays the default tab. The scaffold is throwaway — don't over-engineer.
4. The house pattern (retired with the landing consolidation, resurrect when needed): floating bottom dock, number-key shortcuts, localStorage persistence — see git history of `app/landing/LandingLab.tsx`.

## Phase 3: Generate directional variants

**Default is 2 per round** (more = analysis paralysis). The landing's founding round ran 3 by explicit user request to establish visual philosophy — that is the exception, not the rule.

### 3a. Ground the variants (do this every time)

1. Read `politicas.md` §6 and the relevant module prototype in `opendata/src/cases/`.
2. Read `app/landing/data.ts` before inventing data — extend it if a variant needs more.
3. If the user names an inspiration surface, treat it as authoritative and mine it: (a) layout shape, (b) motion language, (c) typography + data patterns.

### 3b. Directional means directional

A variant is not "baseline with spacing tweaks" — it's a different **mental model** carried through layout, typography, motion, iconography, and copy voice. Good axes for Politicas: editorial narrative vs. instrument panel; one-politician story vs. chamber-wide overview; score-first vs. evidence-first entry.

Deliverables per variant:
- File: `{Name}{Variant}.tsx` next to the host, header comment stating the metaphor.
- Degrade gracefully: empty lists, loading, the "insufficient data / pending review" state (a real state here — integrity claims are gated on human review).
- **Data-concrete over abstract:** a pillar bar with its dataset citation beats a decorative gauge. Real-shaped Czech entities (IČO, roll-call counts, Kč amounts) beat lorem.
- **Design for extraction:** name sub-components (`SourceChip`, `MoneyGraph`, `Hemicycle`) that could live elsewhere.

## Phase 4: Iterate by subtraction and fusion

- **Rejection → delete immediately** (file, import, tab entry).
- **Fusion → extract the strong element, merge into the keeper, delete the source.** Live tab count should shrink round-over-round.
- **Specific feedback → apply inside the chosen variant.** Don't spawn a new variant for a fix.
- **New variant only when explicitly asked.**
- **Hoist shared pieces the moment two variants render the same structure.**

End each round with an explicit menu of what changed, then ask for the next move.

## Phase 5: Declare the winner and consolidate

Triggers: "this is the one", "promote X", "X is our visual philosophy".

1. Stop iterating. Make the winner the default (or remove the switcher).
2. Delete non-winner variants from disk and imports.
3. **Consolidation standard (done for the landing 2026-07-22, repeat for future surfaces):** extract new palette/type additions into `@theme` tokens in `app/globals.css` (+ mirror in `features/landing/palette.ts` if charts use them), hoist reusable primitives into `features/shared/components/` with a `@catalog` tag, and record the decision in `CLAUDE.md` + `docs/DESIGN.md`.
4. `npx tsc --noEmit` to confirm no dangling references.
5. Do NOT refactor here — refactor is a separate, explicit request.

## Phase 6: Refactor (only on request)

1. Mirror a sibling folder's conventions.
2. Split by responsibility: types → pure helpers → hooks → leaf components → panes → orchestrator.
3. ~200 LOC per file is a guideline, not a rule.
4. Grep every import site before moving anything.
5. Typecheck once at the end.

---

## Guardrails (inherited from kp, still true here)

- **Watch for external reverts** — after a significant Write, watch the next tool result for "file was modified" markers; re-apply, don't re-argue.
- **Don't touch files outside the prototype scope.** Stage per-file; never `git add -A`.
- **Typography quality axis:** readable copy at `text-sm`/`text-base`+; uppercase tracked labels only for meta. No pixel-valued arbitrary sizes in a shipped variant.
- **Animation austerity:** entry fades once, hover-gated transitions, `AnimatePresence` for mounts. No always-on motion in shipped variants except a deliberate, reduced-motion-gated signature element (the Broadsheet ticker is the one sanctioned example). Gate everything behind `useReducedMotion`.
- **framer-motion + SVG:** never animate raw `cx`/`cy`/`r` — wrap in `motion.g` and animate transforms. Safe: `strokeDashoffset`, `pathLength`, `opacity`, transforms.
- **No `useMemo` side effects** — `useMemo(() => { …setX() })` is a bug; use `useEffect`.

## Signals

**Green:** tab count decreasing; feedback shifting from "wrong direction" to "tweak this"; user names the winning metaphor positively.
**Red → reset direction:** wholesale rejection round after round; user restates the baseline as their preference.

## Exit checklist

- [ ] Winner is the default rendered component.
- [ ] Non-winner variants deleted from disk, imports, and tab configs.
- [ ] `npx tsc --noEmit` clean.
- [ ] Winner's palette extracted to tokens (landing consolidation only).
- [ ] Every rendered number still carries its source citation.
- [ ] Consumer import paths resolve (grep old filenames → zero references).
