/* Regenerate the reference migration snapshot from the authoritative CORE_DDL.
 *
 * CORE_DDL in lib/db/pglite/ddl.ts is what PGlite actually executes; this
 * script copies it verbatim into lib/db/migrations/0001_civic_graph.sql (a
 * snapshot for reviewers + the eventual hosted-Postgres move — nothing applies
 * it at runtime). Run it whenever the DDL changes so the two do not drift.
 *
 *   npm run db:snapshot            # rewrite the snapshot
 *   npm run db:snapshot -- --check # exit 1 if the snapshot on disk has drifted (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CORE_DDL } from "@/lib/db/pglite/ddl";

const OUT = "lib/db/migrations/0001_civic_graph.sql";

const header = `-- politicas civic entity graph — reference schema snapshot.
--
-- THIS FILE IS A SNAPSHOT, NOT APPLIED AT RUNTIME. The authoritative schema is
-- CORE_DDL in lib/db/pglite/ddl.ts, which PGlite executes at open(). This
-- snapshot exists for reviewers and for the eventual move to a hosted Postgres
-- (where it becomes migration 0001). Regenerate from CORE_DDL if the DDL changes:
-- npm run db:snapshot
--
-- Provenance columns (source, source_url, fetched_at, ingest_run_id) + a raw
-- jsonb payload travel on every entity table; ids are natural keys
-- <publisher>:<table>:<source id>. *_norm columns hold ASCII-folded Czech text
-- (PGlite ships no unaccent extension) and carry their own btree index.
`;

const expected = header + CORE_DDL.trimStart() + "\n";

if (process.argv.includes("--check")) {
  let onDisk: string | null = null;
  try {
    onDisk = readFileSync(OUT, "utf8");
  } catch {
    console.error(`${OUT} is missing — run \`npm run db:snapshot\``);
    process.exit(1);
  }
  // Normalise CRLF: core.autocrlf=true checkouts on Windows would otherwise
  // report drift for a byte-identical snapshot.
  if (onDisk.replace(/\r\n/g, "\n") !== expected) {
    console.error(
      `${OUT} has drifted from CORE_DDL in lib/db/pglite/ddl.ts — run \`npm run db:snapshot\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`${OUT} matches CORE_DDL`);
} else {
  writeFileSync(OUT, expected);
  console.log(`wrote ${OUT}`);
}
