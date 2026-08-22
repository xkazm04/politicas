---
name: pglite-05-ships-postgres-18
description: PGlite 0.5.x is Postgres 18.3 and cannot open the repo's PG_VERSION 17 store — bumping it is a data migration, not a dependency bump
metadata:
  type: project
---

`@electric-sql/pglite` 0.5.0 upgraded the embedded server to **Postgres 18.3**.
Our `.pglite` store is **`PG_VERSION 17`** (written by 0.4.x) and PGlite has no
`pg_upgrade`, so 0.5.x cannot read it.

Measured 2026-08-22 with bare PGlite (no app code), as a controlled A/B over
**one healthy PG17 directory** (a copy of `.pglite-backup-20260806-pass55`):
0.4.6 opens it and reports PostgreSQL 17.5; 0.5.4 answers `PGlite failed to
initialize properly`. The same 0.5.4 build creates a fresh directory at
`PG_VERSION 18` and opens that fine, so it is the on-disk major that is
refused, not the build. Do the A/B on a HEALTHY store — the first run used a
copy of the damaged main store, where a refusal proves nothing.

**Why it matters:** dependabot proposes this as a routine bump (PR #8). Taking
it strands both the local 1,6 GB store and the deployed persistent volume that
`docs/deploy/container.md` pins the product to. The upgrade path is dump +
re-ingest into a fresh store, then reseed the volume — planned work, not a
lockfile change. `.github/dependabot.yml` therefore ignores minor/major for this
package; lift that ignore in the same change that performs the migration.

Related: [[kgneighbours-weight-order-is-not-total]], [[ico-node-id-canonical-form]]
