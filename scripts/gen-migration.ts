/* Regenerate the reference migration snapshot from the authoritative CORE_DDL.
 *
 * CORE_DDL in lib/db/pglite-store.ts is what PGlite actually executes; this
 * script copies it verbatim into lib/db/migrations/0001_civic_graph.sql (a
 * snapshot for reviewers + the eventual hosted-Postgres move — nothing applies
 * it at runtime). Run it whenever the DDL changes so the two do not drift.
 *
 *   npx tsx scripts/gen-migration.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("lib/db/pglite-store.ts", "utf8");
const m = src.match(/const CORE_DDL = `([\s\S]*?)`;/);
if (!m) throw new Error("CORE_DDL not found in lib/db/pglite-store.ts");

const header = `-- politicas civic entity graph — reference schema snapshot.
--
-- THIS FILE IS A SNAPSHOT, NOT APPLIED AT RUNTIME. The authoritative schema is
-- CORE_DDL in lib/db/pglite-store.ts, which PGlite executes at open(). This
-- snapshot exists for reviewers and for the eventual move to a hosted Postgres
-- (where it becomes migration 0001). Regenerate from CORE_DDL if the DDL changes:
-- npx tsx scripts/gen-migration.ts
--
-- Provenance columns (source, source_url, fetched_at, ingest_run_id) + a raw
-- jsonb payload travel on every entity table; ids are natural keys
-- <publisher>:<table>:<source id>. *_norm columns hold ASCII-folded Czech text
-- (PGlite ships no unaccent extension) and carry their own btree index.
`;

writeFileSync("lib/db/migrations/0001_civic_graph.sql", header + m[1].trimStart() + "\n");
console.log("wrote lib/db/migrations/0001_civic_graph.sql");
