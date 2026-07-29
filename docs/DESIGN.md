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
| `steel-aa` | `#6b665f` | small secondary text — the AA-passing twin of `steel` |
| `signal-text` | `#b82b21` | red in small text — the AA-passing twin of `signal` |

**The two AA twins** (added 2026-07-29 by the `/impeccable` audit,
`docs/design/impeccable-pass-01.md`). Recomputed by hand: `steel` on `paper` is
**4,11:1** and `signal` on `paper` is **4,10:1** — both just under the WCAG AA
floor of 4,5:1 for text below 18,66 px. That is a property of the palette, not a
bug in any component, so the originals are **not** overwritten: `signal` passes
the 3:1 large-text bar everywhere Konstrukt actually uses it big (the red period,
poster numerals, `SectionRule`), and only small text needs the twin. Use
`steel-aa` / `signal-text` for anything under 18,66 px; keep `steel` / `signal`
for planes, rules and display. Whether the twins should simply *replace* the
originals is an open decision — see §3.

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

**A citation that cannot be read has not been made.** The `/impeccable` audit
(2026-07-29) found `SourceNote` set in `text-[11px] uppercase tracking-widest
text-steel` — 4,11:1, sometimes 10 px, and letter-spaced verzálky on runs up to
**115 characters**. §2 below permits tracked caps „only for meta" and a citation
*is* meta, so it passed: the rule classifies by **role** and never by **length**,
and a 115-character sentence in a label's clothes goes straight through it.

So the rule now has a second half: **a citation is typeset by its length.** Short
strings („obr. 4 — ověřené veřejné zdroje") stay tracked verzálky; anything
sentence-shaped is set in sentence case at `text-xs` in `steel-aa`.
`features/shared/components/Citation.tsx` closes this in code — it measures the
children and picks the mode, so a caller cannot get it wrong by judgement.
`SourceNote` is unchanged and still correct for true labels; migrating the long
callers is open work, tracked in the audit ledger.

**Real vs illustrative must be visible, not merely stated.** When a strip mixes
computed figures with sample ones, the citation line is the first thing a
skimming reader drops — so the difference also carries in the FORM: `StatTile`'s
`variant="illustrative"` moves the tile to `paper-strong`, gives it an `ochre`
edge and tag, and renders the numeral in `steel` rather than full `ink`. And
when the whole store is unreachable, per-tile labels are not enough: say it once
at the top of the page with `LiveDataNotice` — a page of demo figures must never
read as an editorial choice when it is actually an outage.

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

- **App chrome lives in the layout** (2026-07-26). `features/shell/AppShell` is
  mounted in `app/layout.tsx` and draws the left rail: the brand mark, the six
  module rows, and — nested under the row you are on — that page's section
  anchors and sub-routes, scroll-spied. Consequences for every wrapped page:
  **do not draw a logo, a language switcher, or a back-to-dashboard link** —
  the rail owns all three. Declare your sections in
  `features/shell/navModel.ts` and put the matching `id` on the `<section>`;
  the rail drops anchors whose element is absent, so a section gated on real
  data degrades on its own. Opt out via `isBareRoute()` (landing, `/admin`,
  `/rentgen`, and `/graf` — the graph canvas owns the full viewport width and
  composes its own floating bars; its breadcrumb links back to the app).
- **Page anatomy:** header bar (`border-b-4`, `/ sekce` mono breadcrumb +
  dataset meta) → poster title band (h1 + `SectionRule` + one intro line) →
  numbered sections split by `border-t-4 border-ink pt-10`, each anchored by
  `SectionHeading` (mono `/01` index + uppercase title + red period, aside
  meta right).
- **Entity graphs:** shape carries the entity kind (circle person, square firm,
  diamond money, triangle vote, pentagon law — `features/dashboard/components/
  GraphGlyph` for SVG, `features/graph/kindStyle.ts` for canvas; the two speak
  the same vocabulary). Colour only reinforces the shape, so the graph survives
  greyscale. Unverified edges are dashed and say so in the legend. Layout
  coordinates come from a pure module (`lib/kg/layout.ts`) and are rounded to
  2 decimals (§4 float drift).
- **SVG or canvas:** SVG up to ~100 nodes (hoverable, inspectable, styled by
  tokens); `<canvas>` beyond that — the `/graf` playground draws ~3 200 nodes,
  which SVG cannot hold. Canvas rules: batch one path per (shape, colour) bucket
  and one path for all bulk edges; keep pan/zoom and hover in refs so pointer
  movement never re-renders React; resolve `--font-plex` via `getComputedStyle`
  because `ctx.font` does not understand CSS variables. Canvas is not keyboard
  operable — always pair it with a search/list that can reach every node, and do
  not put `tabIndex` on the canvas to fake it.
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
                              SectionRule, RankDelta, SectionHeading, StatTile,
                              DataUnavailable, LiveDataNotice, …) —
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
