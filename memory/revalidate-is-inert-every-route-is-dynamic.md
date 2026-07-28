---
name: revalidate-is-inert-every-route-is-dynamic
description: lib/i18n/request.ts calls cookies() in getRequestConfig, so every route builds as ƒ Dynamic — `export const revalidate` is a declared ceiling, not today's behaviour
metadata:
  type: project
---

`next build` marks **every** route in this app `ƒ (Dynamic)`. It is not a
property of any one page: `lib/i18n/request.ts` reads the locale cookie via
`cookies()` inside `getRequestConfig`, which opts the whole app out of static
generation.

Consequence: `export const revalidate = 86_400` on `/dashboard` and
`/poslanec/[id]` is a **declared ceiling for the day those routes go static**,
not a description of current behaviour. Anything that says "refreshed daily"
because a `revalidate` exists is an uncovered claim — the brand rule applies to
freshness statements as much as to figures.

What actually bounds staleness today is memoization: `getDashboardData`'s money
read (~12 s cold) was memoized for the **process lifetime**, i.e. unbounded
until restart, and now expires on the same 24 h window
(`features/dashboard/freshness.ts`, pinned by `freshness.test.ts` so the route
literal and the loader constant cannot drift). `getStore()` and
`features/graph/graphLoader.ts` cache for process lifetime by design — after a
`da:kg-compute` recompute, a restart is still required.

If static generation is ever wanted, the fix is upstream: move locale off a
cookie, or wrap the loaders in `unstable_cache`.
