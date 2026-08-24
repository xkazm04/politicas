/* Put a pre-migration snapshot back in place. The restore path is a deliverable,
 * not a hope — a snapshot nobody can apply is storage, not safety.
 *
 *   npm run db:restore -- --from=.pglite-premigration-2026-08-24-1a2b3c4d --yes
 *   npm run db:restore -- --list
 *
 * SEMANTICS, stated before the flags: restoring DISCARDS everything written to
 * the live store after the snapshot was taken. This script therefore never runs
 * on its own judgement — `--yes` is the consent of the person losing that delta.
 * Automatic restore would be defensible only in the one window where the loss is
 * provably empty (the same boot, the chain halted before anything else wrote),
 * and this repo has no such window: `open()` returns a working store or rejects.
 *
 * MECHANICS: the snapshot is verified BEFORE anything moves (restoring an
 * unreadable copy over a damaged store loses both), the store that is there is
 * MOVED ASIDE and never deleted (it is evidence, and sometimes the failed
 * migration is the recoverable one), then the file set is copied in and the
 * result is verified at the live path.
 *
 * AFTERWARDS the restored store carries the old schema shape, so the next boot
 * re-applies CORE_DDL and discloses that it is doing so. That is correct: restore
 * pairs with fixing the step, not with retrying it in a loop.
 *
 * WHY THIS IS A SEPARATE PROCESS and not a function the app calls after a failed
 * open: measured on Windows, a PGlite open that FAILS still holds the data
 * directory in that process, so renaming the damaged store aside comes back
 * EPERM. The recovery path must therefore start where nothing has ever opened
 * the store — which is exactly what a CLI invocation is.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pglitePath } from "@/lib/db/config";
import { restoreFromSnapshot, SNAPSHOT_PREFIX } from "@/lib/db/pglite/premigration";
import { listByPrefix, mbOf, dirSize } from "@/lib/db/pglite/storeCopy";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);

async function main() {
  const liveDir = resolve(pglitePath());
  const root = resolve(liveDir, "..");

  if (flag("list") || !arg("from")) {
    const snaps = await listByPrefix(root, SNAPSHOT_PREFIX);
    console.log(`pre-migration snapshots in ${root}: ${snaps.length}`);
    for (const s of snaps) console.log(`  ${s.name}  ${mbOf(await dirSize(s.path))}  ${new Date(s.mtimeMs).toISOString()}`);
    if (!flag("list")) {
      console.error(`\n--from=<snapshot dir> is required. Add --yes once you have chosen one.`);
      process.exit(1);
    }
    return;
  }

  const from = resolve(arg("from")!);
  if (!flag("yes")) {
    console.error(
      `refusing without --yes: restoring ${from} over ${liveDir} DISCARDS everything written since that copy was ` +
        `taken. Nobody but you can decide that delta is expendable.`,
    );
    process.exit(1);
  }

  // PGlite allows one holder. The marker can be stale after a crash — which is
  // exactly the situation a restore is for — so `--force` exists, and says what
  // it is overriding rather than hiding it.
  if (existsSync(join(liveDir, "postmaster.pid")) && !flag("force")) {
    console.error(
      `${liveDir} carries postmaster.pid, so a process may be holding it — copying over a held store is the ` +
        `corruption this repo has a memo about (memory/robocopy-of-a-live-pglite-store-can-corrupt.md). Stop the ` +
        `holder and retry. If you know the marker is stale (the holder crashed), re-run with --force.`,
    );
    process.exit(1);
  }

  const result = await restoreFromSnapshot({ snapshotDir: from, liveDir });
  console.log(
    `done. The previous store is at ${result.movedAsideTo ?? "(nothing was there)"} — inspect or delete it ` +
      `yourself; this script never deletes a store.`,
  );
  console.log(`the next boot will re-apply CORE_DDL and say so. Fix the step before you re-run it.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
