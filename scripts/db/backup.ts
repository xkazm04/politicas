/* Backup the live PGlite store: CHECKPOINT, copy, prune.
 *
 * WHY THIS EXISTS (2026-08-22 architecture review). Backups had been taken by hand with
 * `cp -r .pglite .pglite-backup-<date>-pass<n>` before every graph write. Measured:
 *
 *   • 14 full copies, 22 GB — one per pass, kept forever.
 *   • each copy 1,5–1,6 GB, of which `pg_wal` was 625 MB (41 %) because nobody ever
 *     checkpointed the store before copying it.
 *   • every one of them redundant by construction: every case-loop write is a committed,
 *     replayable payload (`persist-batch.ts --pass=<n>`), so "restore the last good copy
 *     and replay one JSON" recovers any state — proved the same day, zero loss.
 *
 * So: a backup is a CHECKPOINTED copy, and the chain is pruned to the last N. Two is the
 * default — the last known good, and the one before it in case the last one is the
 * thing that went wrong.
 *
 * WHAT A CHECKPOINT BUYS. Postgres keeps WAL segments until a checkpoint makes them
 * recyclable; PGlite's defaults let them accumulate for a long time. Forcing one before
 * the copy means the copy carries the data, not the replay log of how it got there.
 * (Recycled segments are still RETAINED on disk for reuse — so the dir may not shrink
 * much even after a checkpoint. The script reports both sizes honestly rather than
 * promising a number.)
 *
 * SAFETY. Refuses to run if anything else holds the store (a second opener tears large
 * reads — batch 016 measured it — and a copy of a held store is torn by construction,
 * see memory/held-store-mimics-corruption.md). Never deletes the live dir. Never deletes
 * a backup it did not create (the `.pglite-backup-` prefix is the contract). Prunes by
 * mtime, oldest first, and PRINTS what it removes before removing it.
 *
 *   npm run db:backup                       # checkpoint + copy + prune to 2
 *   npm run db:backup -- --keep=3 --label=pass60
 *   npm run db:backup -- --prune-only       # no new copy, just enforce the cap
 *   npm run db:backup -- --dry-run
 */
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pglitePath } from "@/lib/db/config";
// The copy rules (filter the holder marker, treat the store as a file set,
// rotate whole copies by our own prefix) live in ONE module, shared with the
// pre-migration snapshot — two copies of that doctrine is how they start
// disagreeing about which files a store is.
import { copyStoreDir, dirSize, mbOf as mb, rotateByPrefix } from "@/lib/db/pglite/storeCopy";

const PREFIX = ".pglite-backup-";
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);

async function main() {
  const keep = Number(arg("keep") ?? 2);
  const label = arg("label");
  const dryRun = flag("dry-run");
  const pruneOnly = flag("prune-only");
  if (!Number.isInteger(keep) || keep < 1) throw new Error("--keep must be a positive integer");

  const live = resolve(pglitePath());
  const root = resolve(live, "..");
  const today = new Date().toISOString().slice(0, 10);

  if (!pruneOnly) {
    // 1. Hold the single connection ourselves and CHECKPOINT. If something else holds
    //    it, open() will fail or the first query will — either way we stop, we do not
    //    copy a store we cannot prove is at rest.
    const before = await dirSize(live);
    const { open } = await import("@/lib/db/pglite/internals");
    const pg = await open();
    await pg.exec("CHECKPOINT");
    await pg.close();
    const after = await dirSize(live);
    console.log(`checkpoint: ${mb(before)} -> ${mb(after)} on disk (WAL segments are retained for reuse, so this may not shrink)`);

    // 2. Copy. `postmaster.pid` is PGlite's lock marker from THIS process's open; a copy
    //    must not carry it or the next opener of the copy sees a phantom holder.
    const name = `${PREFIX}${today}${label ? `-${label}` : ""}`;
    const dest = join(root, name);
    try {
      await stat(dest);
      throw new Error(`${name} already exists — pass --label to disambiguate`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    console.log(`${dryRun ? "[dry-run] would copy" : "copying"} ${live} -> ${dest}`);
    if (!dryRun) {
      await copyStoreDir(live, dest);
      console.log(`copied: ${mb(await dirSize(dest))}`);
    }
  }

  // 3. Prune to the last `keep`, oldest first. Only dirs carrying OUR prefix — a damaged
  //    dir someone parked for autopsy, a case copy, `.pglite-absent`, are not ours.
  const { kept } = await rotateByPrefix(root, PREFIX, keep, { dryRun });
  console.log(`kept: ${kept.join(", ") || "(none)"}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
