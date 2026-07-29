---
name: Politicas — Konstrukt
description: Czech functionalist information design in the lineage of Ladislav Sutnar — the poster as a data instrument.
colors:
  ink: "#131313"
  paper: "#f0eee7"
  paper-strong: "#e9e6dc"
  signal: "#d5372c"
  cobalt: "#1f3fa8"
  ochre: "#dfa321"
  steel: "#77726a"
  hairline: "#d7d3c8"
  steel-aa: "#6b665f"
  signal-deep: "#b82b21"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 900
    fontSize: "clamp(2.25rem, 6vw, 4.5rem)"
    lineHeight: "0.95"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 900
    fontSize: "2.25rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "1.25rem"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "0.9375rem"
    lineHeight: "1.6"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontWeight: 700
    fontSize: "0.75rem"
    letterSpacing: "0.3em"
rounded:
  none: "0px"
  pill: "9999px"
components:
  button-primary:
    background: "{colors.ink}"
    color: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1.5rem"
  button-secondary:
    background: "transparent"
    color: "{colors.cobalt}"
    border: "2px solid {colors.cobalt}"
    rounded: "{rounded.none}"
  tile:
    background: "{colors.paper}"
    border: "1px solid {colors.ink}"
    rounded: "{rounded.none}"
    padding: "1.25rem"
  tile-illustrative:
    background: "{colors.paper-strong}"
    border: "1px solid {colors.ochre}"
    color: "{colors.steel}"
    rounded: "{rounded.none}"
---

# Design System: Politicas — Konstrukt

> **Authority: [`docs/DESIGN.md`](docs/DESIGN.md).** This file is a generated
> mirror of it in the DESIGN.md spec format, so Impeccable's detector and live
> panel can read the tokens machine-readably — `docs/DESIGN.md` carries no YAML
> frontmatter, so without this file the entire design-system rule family stays
> dormant and off-token colors go unflagged.
>
> It states **no rule `docs/DESIGN.md` does not already state.** If the two ever
> disagree, `docs/DESIGN.md` is right and this file is stale. Regenerate with
> `/impeccable document`; do not hand-edit. Token values additionally originate
> in `app/globals.css` — that is where a change must be made first.

## Overview

**Creative North Star: "The Instrument Poster"**

Konstrukt is Czech functionalist information design in the lineage of Ladislav
Sutnar: flat geometric shapes used as data glyphs, enormous numerals, uppercase
display type, and everything sitting on a visible grid annotated with index
numbers and „obr." captions. The page reads as a measuring instrument that
happens to be beautiful, not as a marketing surface that happens to carry
numbers. Density is high and unapologetic; whitespace is structural, delivered
by rules and grid gaps rather than by padding a card.

The system is aggressively flat. There are no shadows, no gradients and no
rounded corners — depth comes from rule weight (`border-t-4` section splits,
hairline row separators) and from tonal shifts between `paper` and
`paper-strong`. A single red accent carries the whole voice, and its scarcity is
what makes it read as signal rather than decoration.

It was chosen in a landing prototype round on 2026-07-22. The runner-up
direction, **Rentgen**, is the one confirmed visual anti-reference: it survives
as a living archive at `features/labs/rentgen/` (`/rentgen`, noindex) and must
not be reintroduced into the parent world.

**Key Characteristics:**
- Flat planes, square corners, visible grid, no shadow vocabulary at all.
- Uppercase Archivo Black display against IBM Plex Mono meta — no third voice.
- Warm gallery-white canvas (`paper`), never pure white; ink is `#131313`, never `#000`.
- One red accent, used sparingly and never as fill for large areas.
- Every number carries a citation; the citation is typeset, not hidden.

## Colors

Warm, paper-based and near-monochrome, with one loud red doing all the signalling
and two supporting hues that exist to identify score pillars rather than to
decorate.

### Primary
- **Signal Red** (`#d5372c`): THE accent. Section-rule draws, the period after a
  poster headline, the pillar Aktivita, selection highlight, the weight-slider
  thumb. Never a large fill.

### Secondary
- **Cobalt** (`#1f3fa8`): secondary planes and outlined buttons; the pillar
  Docházka; rank-up movement; the DOM-focus ring on the dashboard canvas.

### Tertiary
- **Ochre** (`#dfa321`): the pillar Integrita, and — structurally — the edge and
  tag of any tile whose figure is illustrative rather than computed.

### Neutral
- **Ink** (`#131313`): text, rules, solid planes. A tinted near-black; pure black is not in the system.
- **Paper** (`#f0eee7`): the warm gallery-white canvas.
- **Paper Strong** (`#e9e6dc`): hover and selected-row tone, and the ground of an illustrative tile.
- **Steel** (`#77726a`): secondary text, and the numeral colour of an illustrative figure.
- **Hairline** (`#d7d3c8`): hairline rules, chart grids, table separators.
- **Steel AA** (`#6b665f`): the AA-passing twin of Steel (4.90:1), for small secondary text.
- **Signal Deep** (`#b82b21`): the AA-passing twin of Signal (5.31:1) — small red text AND button planes under paper text.

### Named Rules
**The Single Origin Rule.** Colors originate in `app/globals.css` and nowhere
else; components consume Tailwind classes (`bg-paper`, `text-ink`,
`border-hairline`). `custom/no-hardcoded-colors` errors on a literal. Three
exceptions are declared and scoped in `eslint.config.mjs`:
`features/landing/palette.ts` (recharts chrome needs literal strings — change
tokens in both places), `features/labs/**` (archived directions), and
`lib/civic/data.ts` (party colors are *data*, and may appear only as small chips
that never compete with `signal`).

**The Form-Carries-Provenance Rule.** Real versus illustrative is not a caption,
it is a form difference: an illustrative figure moves to `paper-strong`, takes an
`ochre` edge and tag, and renders its numeral in `steel` instead of full `ink` —
because the citation line is the first thing a skimming reader drops.

## Typography

**Display Font:** Archivo (variable to Black), with `system-ui, sans-serif`
**Body Font:** Archivo
**Label/Mono Font:** IBM Plex Mono, with `ui-monospace, monospace`
**Reserved:** Fraunces is wired as `font-serif` but unused by Konstrukt.

**Character:** A two-voice pairing with no middle register. Archivo Black set
uppercase and tight is the poster voice; IBM Plex Mono is the instrument's
labelling — every eyebrow, index, caption and citation. The contrast between
them *is* the hierarchy, which is why a third family would dilute rather than add.

### Hierarchy
- **Display** (900, up to `text-7xl`, `leading-[0.95]`, `tracking-tight`, uppercase): poster headlines, the hero, the big score numeral.
- **Headline** (900, `text-4xl`–`text-5xl`, `tracking-tight`, uppercase): section titles, closed by a `signal`-red period.
- **Title** (700, `text-xl`): panel and card headings inside a section.
- **Body** (400, `text-[15px]`+, `leading-relaxed`): reading copy. Never below `text-sm`.
- **Label** (700 mono, 12px, `tracking-[0.3em]`, uppercase): eyebrows, „obr. N" captions, nav indexes, `tabular-nums` figures — and source citations **only when short**. A citation over 48 characters is set in sentence case at the same size; `SourceNote` measures and decides.

### Named Rules
**The Czech Numeral Rule.** Display numbers go through `czech()` / `czechInt()`
in `lib/format.ts` — decimal comma, Czech grouping. A component never calls
`.toFixed()` for display.

**The Meta-Stays-Meta Rule.** Uppercase tracked mono is for labelling only. Meta
type never carries primary content, and new surfaces do not ship pixel-valued
arbitrary sizes (`text-[10px]`); legacy `text-[11px]` meta is being consolidated
into `SourceNote`.

## Layout

A centred `max-w-6xl` measure with `px-6` gutters. The page is a stack of
numbered sections split by `border-t-4 border-ink`, each opened by
`SectionHeading` (a mono `/01` index, an uppercase title, a red period, and meta
flush right). Above them sits a header bar with `border-b-4` carrying a
`/ sekce` mono breadcrumb and the dataset meta; the poster title band follows
(h1 + `SectionRule` + a single intro line).

Sets of numbers are laid out as **tile grids** — `grid gap-px border border-ink
bg-ink` with `bg-paper p-5/6` cells, so the ink ground shows through the gap and
draws the grid for free. Lists use a `border-t-2 border-ink` head rule,
`border-b border-hairline` separators, `hover:bg-paper-strong`, and generous
`py-4`; a row that navigates gets an `ArrowUpRight` hover nudge.

App chrome is not the page's job: `features/shell/AppShell` is mounted in
`app/layout.tsx` and owns the left rail (brand mark, module rows, scroll-spied
section anchors). A wrapped page must not draw a logo, a language switcher or a
back link. Sections are declared in `features/shell/navModel.ts` and matched by
`id`; the rail drops anchors whose element is absent, so a data-gated section
degrades on its own. `isBareRoute()` opts out the landing, `/admin`, `/rentgen`
and `/graf`.

## Elevation & Depth

**There is no shadow vocabulary.** Not "shadows used sparingly" — none. Depth is
carried entirely by rule weight and tonal layering: `border-t-4 border-ink` for a
structural split, `border-b border-hairline` for a row separator, and the
`paper` → `paper-strong` step for hover, selection and the illustrative state.
A `box-shadow` anywhere in a Konstrukt surface is a defect.

## Shapes

Square. `border-radius: 0` is the default and the norm — the only radius in the
system is the `9999px` pill on the weight-slider thumb, which reads as a machined
control rather than a soft corner. Borders do the work radii would otherwise do,
at three deliberate weights: 4px (structural section split), 2px (list head rule,
outlined button), 1px hairline (separators, chart grids).

Entity graphs carry meaning in **shape, not colour**: circle = person, square =
firm, diamond = money, triangle = vote, pentagon = law (`GraphGlyph` for SVG,
`features/graph/kindStyle.ts` for canvas — the two speak one vocabulary). Colour
only reinforces the shape, so the graph survives greyscale. Unverified edges are
dashed and the legend says so.

## Components

### Buttons
- **Shape:** square (`0px`); no radius, ever.
- **Primary:** `bg-ink` plane, `text-paper`, `text-sm font-black uppercase tracking-wider`, `px-6 py-3.5`.
- **Hover / Focus:** a 0.5-unit upward translate on primary; secondary inverts to a filled cobalt plane.
- **Secondary:** `border-2 border-cobalt`, `text-cobalt`, transparent ground, same type treatment.

### Cards / Containers
- **Corner Style:** square. Cards are not the default container — a tile grid or a ruled list usually is.
- **Background:** `paper`; `paper-strong` when hovered, selected or illustrative.
- **Shadow Strategy:** none (see Elevation).
- **Border:** `border-ink` on tiles; the `gap-px` over an ink ground draws the grid.
- **Internal Padding:** `p-5`/`p-6` in tile cells, `py-4` in list rows.

### Navigation
The left rail owns navigation: mono uppercase module rows with numeric indexes,
nested scroll-spied section anchors under the active module, `paper-strong` for
the active row. Mobile collapses it into `features/shell/MobileNav`.

### Signature components
- **`SectionRule`** — a scroll-drawn red rule; the house transition between bands.
- **`SourceNote`** — the citation primitive that makes the brand rule visible.
- **`AnimatedScore`** — a 0.5 s numeric ease-out on a large numeral.
- **`StatTile`** — the tile-grid cell, carrying the `variant="illustrative"` state described above.
- **`Hemicycle`** — 200 seats as a data glyph; SVG coordinates rounded to 2 decimals against SSR/CSR float drift.

## Do's and Don'ts

### Do:
- **Do** consume colors as Tailwind token classes; add a new color to `app/globals.css` first if one is genuinely missing.
- **Do** cite every rendered number with `SourceNote`, and label derived or ungated values as such.
- **Do** carry provenance in form as well as words — `ochre` edge, `steel` numeral, `paper-strong` ground for anything illustrative.
- **Do** run entry animations once (`whileInView` + `viewport={{ once: true }}`), keep them ≤0.7 s, and gate looping motion behind `useReducedMotion` (`custom/enforce-reduced-motion-fallback`).
- **Do** wrap every recharts `ResponsiveContainer` in a fixed-aspect `overflow-hidden` parent **and** give its grid column `min-w-0` — without both, the page livelocks in a resize loop.
- **Do** check `features/shared/components/` before building a widget, and put new reusable primitives there with a `@catalog` line.
- **Do** round SVG coordinates from trigonometry to 2 decimals, or SSR/CSR float drift trips hydration.

### Don't:
- **Don't** hardcode a color, outside the three scoped exceptions.
- **Don't** add a `border-radius` (the slider thumb is the one exception) or a `box-shadow`.
- **Don't** use pure black or pure white; ink is `#131313` and the canvas is `#f0eee7`.
- **Don't** put ambient or infinite motion on the landing.
- **Don't** draw a logo, language switcher or back link inside a page that the app shell wraps.
- **Don't** let meta type carry primary content, and don't ship new pixel-valued arbitrary type sizes.
- **Don't** reintroduce the archived Rentgen direction into the parent world.
