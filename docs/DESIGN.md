# Politicas — Design System („Konstrukt")

Single source of truth for the visual language. Read before adding any UI
surface. The parent art direction is **Konstrukt** — Czech functionalist
information design in the lineage of Ladislav Sutnar: flat geometric shapes as
data glyphs, enormous numerals, everything uppercase, everything on a visible
grid with index numbers and „obr." captions. Declared the winner of the
landing prototype round on 2026-07-22 (runner-up Rentgen is archived at
`features/labs/rentgen/`, mounted on `/rentgen`).

## 1. Tokens (app/globals.css — the only place colors originate)

| Token | Value | Role |
|---|---|---|
| `ink` | `#131313` | text, rules, solid planes |
| `paper` | `#f0eee7` | warm gallery-white canvas |
| `paper-strong` | `#e9e6dc` | hover / selected row |
| `signal` | `#d5372c` | THE accent — red; pillar Aktivita |
| `cobalt` | `#1f3fa8` | secondary planes; pillar Docházka; rank-up |
| `ochre` | `#dfa321` | pillar Integrita |
| `steel` | `#77726a` | secondary text |
| `hairline` | `#d7d3c8` | hairline rules, chart grids |

Consume as Tailwind classes (`bg-paper`, `text-ink`, `border-hairline`,
`fill-signal`, …). **Never hardcode a color** — `custom/no-hardcoded-colors`
errors on it. Declared exceptions (scoped in `eslint.config.mjs`):

1. `features/landing/palette.ts` — hex mirror for recharts chrome (grids,
   ticks, tooltips need literal strings). Change tokens in BOTH places.
2. `features/labs/**` — archived fixed art directions (Rentgen).
3. `lib/civic/data.ts` — party colors are **data**, not decoration; they may
   appear only as small chips and never compete with `signal`.

## 2. Typography

- `font-sans` — **Archivo** (variable to Black). Display = `font-black
  uppercase tracking-tight`; poster headlines up to `text-7xl`.
- `font-mono` — **IBM Plex Mono**. All meta: eyebrows, „obr. N" captions,
  source citations, nav indexes, tabular numbers (`tabular-nums`).
- `font-serif` — **Fraunces**. Reserved; not used by Konstrukt (kept wired for
  editorial sub-surfaces if a module needs one).
- Czech numerals: decimal comma via `czech()` / `czechInt()` from
  `lib/format.ts` — components never call `.toFixed()` for display.
- Readable copy ≥ `text-sm`; uppercase tracked labels only for meta.
  No pixel-valued arbitrary sizes (`text-[10px]`) in new shipped surfaces
  (legacy `text-[11px]` meta is being consolidated into `SourceNote`).

## 3. Evidence-first (the brand rule)

Every rendered number carries a source citation — dataset + cadence. The
canonical primitive is `features/shared/components/SourceNote.tsx`. A surface
that drops citations to look cleaner is off-brand by definition
(opendata/docs/politicas.md §6). Ties render as dated, sourced facts — never
accusations.

## 4. Motion

- Entry animations once (`whileInView` + `viewport={{ once: true }}`), short
  (≤0.7 s), gated by `useReducedMotion` where looping — enforced by
  `custom/enforce-reduced-motion-fallback`.
- House signatures: `SectionRule` (scroll-drawn red rule), `AnimatedScore`
  (0.5 s numeric ease-out), hemicycle row stagger, hover-gated color/translate
  transitions. No ambient/infinite motion on the landing.
- recharts: flat styling — square corners, `HAIRLINE` grids, `INK` axis lines,
  mono tick labels, `TOOLTIP_STYLE` from `palette.ts`. Wrap every
  `ResponsiveContainer` in a fixed-aspect `overflow-hidden` parent AND give
  the grid column `min-w-0` — without it the svg width feeds the track's
  min-content and the page livelocks in a resize loop (hit 2026-07-22).

## 5. App-content patterns (established by Velín + Spis, 2026-07-22)

- **Page anatomy:** brand bar (`border-b-4`, logo + `/ sekce` mono breadcrumb)
  → poster title band (h1 + `SectionRule` + one intro line) → numbered
  sections split by `border-t-4 border-ink pt-10`, each anchored by
  `SectionHeading` (mono `/01` index + uppercase title + red period, aside
  meta right).
- **Tile grids:** `grid gap-px border border-ink bg-ink` with `bg-paper p-5/6`
  cells (stats, pillars, module tiles, prev/next nav) — the house way to
  show a set of numbers.
- **List rows:** `border-t-2 border-ink` head rule, `border-b border-hairline`
  separators, `hover:bg-paper-strong`, generous `py-4`; body copy `text-[15px]`+,
  meta in mono 11px. Rows that navigate get the `ArrowUpRight` hover nudge.
- **Readability floor:** panel labels are mono 11px **bold**; chart ticks 12px;
  never let meta type carry primary content.

## 6. Component layers

```
features/shared/components/   domain-agnostic catalog (SourceNote, AnimatedScore,
                              SectionRule, RankDelta, SectionHeading, …) —
                              @catalog JSDoc tag, NO imports from features/*
                              or lib/civic (lint-enforced)
features/<feature>/           feature module: orchestrator + components/ + palette
features/labs/                archived art directions — fixed hexes allowed
lib/                          domain data (civic/) + pure helpers (format.ts) + tests
app/                          thin routes only — pages just mount a feature
```

Before building any widget, check the shared catalog first; hand-rolling a
primitive that exists is the #1 source of UI drift (personas' lesson). New
reusable primitives go INTO the catalog with a `@catalog` one-liner.
