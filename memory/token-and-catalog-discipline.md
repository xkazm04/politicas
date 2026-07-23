---
name: token-and-catalog-discipline
description: Colors originate only in globals.css tokens (3 declared exceptions); shared catalog is a lint-enforced boundary. Know these before fighting lint.
---

# Token discipline + shared-catalog boundary — lint-enforced

Four custom ESLint rules run at **error** level (kept strict while the codebase
is young — do not downgrade): `custom/no-hardcoded-colors`,
`custom/no-silent-catch`, `custom/role-button-requires-keydown`,
`custom/enforce-reduced-motion-fallback`.

**Colors originate only in `app/globals.css` tokens** (consumed as Tailwind
classes: `bg-paper`, `text-ink`, `fill-signal`, …). Hardcoding a hex errors.
There are exactly **three declared exceptions** (scoped in `eslint.config.mjs`)
— know them so you don't waste time fighting the rule:
1. `features/landing/palette.ts` — hex mirror of tokens for recharts chrome
   (grids/ticks/tooltips need literal strings). **Change tokens in BOTH places.**
2. `features/labs/**` — archived fixed art directions (Rentgen).
3. `lib/civic/data.ts` — party colors are *data*, not decoration (small chips
   only, must never compete with `signal`).

**Shared catalog is a boundary, not a folder:** `features/shared/components/`
holds domain-agnostic primitives tagged `@catalog`; it must **not** import from
`features/*` or `lib/civic` (lint-enforced) — pass data via props. Check the
catalog before hand-rolling any widget; hand-rolling a primitive that exists is
the #1 source of UI drift (personas' lesson). New reusable primitives go INTO
the catalog with a `@catalog` one-liner, not into a feature folder.

**Why it matters:** these rules error the build, and the color/catalog
exceptions are non-obvious. Knowing them up front saves a debugging loop and
keeps the design system coherent as the code grows.
