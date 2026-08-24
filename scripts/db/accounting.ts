/* Per-table storage accounting for the PGlite store.
 *
 *   npm run db:accounting                      # the live store (must be unheld)
 *   npm run db:accounting -- --json            # machine-readable, same numbers
 *   PGLITE_PATH=./.pglite-backup-2026-08-24-pass73-pre npm run db:accounting
 *
 * WHY THE THIRD FORM MATTERS. PGlite is single-connection: while `next dev` or an
 * ingest pass holds `.pglite`, this script cannot open it, and it says so instead
 * of half-reporting. Pointing PGLITE_PATH at a COPY is the repo's standing pattern
 * for analysis (lib/db/config.ts) and gives the same table shares — a copy of the
 * store IS the store, minus whatever was written after the copy.
 *
 * The report itself, and every predicate attached to its numbers, lives in
 * lib/db/pglite/accounting.ts. This file is the door, not the doctrine.
 */
import { resolve } from "node:path";
import { accountingReport, storeAccounting } from "@/lib/db/pglite/accounting";
import { pglitePath } from "@/lib/db/config";

const json = process.argv.includes("--json");

async function main() {
  const dir = resolve(pglitePath());
  const { open } = await import("@/lib/db/pglite/internals");
  let pg;
  try {
    pg = await open();
  } catch (err) {
    console.error(
      `cannot open ${dir}: ${(err as Error).message}\n` +
        `PGlite allows ONE connection per data dir. If a dev server or an ingest pass is holding it, ` +
        `stop it, or run this against a copy: PGLITE_PATH=<copy> npm run db:accounting`,
    );
    process.exit(1);
    return;
  }
  const a = await storeAccounting(pg, dir);
  console.log(json ? JSON.stringify(a, null, 2) : accountingReport(a));
  await pg.close();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
