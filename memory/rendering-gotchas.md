---
name: rendering-gotchas
description: Four hard-won rendering traps (recharts livelock, SVG float drift, Czech formatting, SSR determinism) that each cost real debugging time.
---

# Rendering gotchas — paid for on 2026-07-22, will bite again

Non-derivable traps hit during the founding build. Each cost debugging time and
is easy to reintroduce:

1. **recharts `ResponsiveContainer` page livelock.** Inside a CSS grid track it
   feeds its SVG width into the track's min-content and the page enters an
   infinite resize loop. Fix: wrap every `ResponsiveContainer` in a
   fixed-aspect `overflow-hidden` parent **and** put `min-w-0` on the grid
   column. (docs/DESIGN.md §4.)

2. **SVG trig coordinates must be rounded** (to ~2 decimals). Raw float output
   differs between SSR and CSR and trips React hydration mismatch — seen in
   `Hemicycle.tsx`.

3. **Czech number/date formatting goes through `lib/format.ts`.** Use
   `czech()` / `czechInt()` (decimal comma) and the Czech date helper — never
   `.toFixed()` for display, never `toLocaleDateString` (ICU version drift
   makes SSR ≠ CSR). `lib/format.ts` is the *only* place `.toFixed` is allowed
   for display.

4. **No `Math.random` / `Date.now()` in anything that renders on the server.**
   SSR must equal CSR (see also `sample-data-first`). Also: don't nest
   `SourceNote` inside a `<p>` — it renders a `<div>` deliberately, which is an
   invalid `<p>` child.

**Why it matters:** all four are hydration/layout landmines that pass a quick
eyeball and blow up at runtime or in `npm run check`. Reach for the established
helper/wrapper instead of re-deriving.
