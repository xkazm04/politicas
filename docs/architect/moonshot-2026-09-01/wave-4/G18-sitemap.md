# G18 — release-stamped entity sitemap (wave 4)

Card: deck #21. Registry: law non-partisan-symmetry (all 207 MPs, all firms, all
laws, or none); accountability-publishing-ethics / public-role-scope-limit.

Builds on: G5 (release manifest + certification; `degraded` verdict), G15
(readings written by the release cut — write `release_index` in the same step).

## Goal of this wave's slice

1. `release_index(version, kind, id)` in a `-- [G18 release index]` block at the
   END of `CORE_DDL`; written by the release-cutting path in `scripts/data-analysis`
   (same step that writes G15's reading): every current mandate holder (the
   `membership` on organ 174 rule, memory current-mandate-holder-signal), every
   company node with a canonical IČO, every law with a dossier — never a shortlist.
2. `features/shell/publicRoutes.ts`: keep `publicStaticRoutes`; add
   `entitySitemapRoutes(version)` unit-tested against `DISALLOWED_PATHS`.
3. `app/sitemap.ts` becomes a sitemap INDEX; `app/sitemap/[version]/[kind]/route.ts`
   renders one kind from `release_index` with `lastModified = cutAt` (a real
   content-change date), base URL from headers as now; unknown version → 404; an
   empty index → empty urlset with the population stated; a release whose manifest
   is `degraded` never becomes the "latest" sitemap.
4. `/zdroj/[ref]` stays out (receipts are per claim, not per entity).
5. Symmetry guard: a colocated test asserts the MP sub-sitemap's count equals the
   chamber's current-mandate count from the same release; a partial list fails.
6. `/data` prints `entityIndexCounts`.

## Owned paths

`lib/db/pglite/ddl.ts` (append block), `lib/db/pglite/repositories/releaseIndex.ts`
(new), `scripts/data-analysis/*` (the release-cut write only), `features/shell/**`,
`app/sitemap.ts`, `app/sitemap/**` (new), `app/robots.ts` (if the index path
changes), `features/data-releases/**` (counts), docs `docs/routes/{app-shell,data}.md`.

## Report

README shape, plus: URLs in the sitemap set before/after, the symmetry test
result on the fixture, carry-over.
