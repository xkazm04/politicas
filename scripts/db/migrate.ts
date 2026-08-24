/* Apply CORE_DDL the way a one-way door deserves: find out whether anything is
 * actually pending, take a VERIFIED snapshot first if it is, then apply.
 *
 *   npm run db:migrate                 # detect → snapshot → apply → re-check
 *   npm run db:migrate -- --dry-run    # detect and report; take nothing, apply nothing
 *   npm run db:migrate -- --keep=3     # how many pre-migration snapshots to retain
 *
 * WHY THIS SCRIPT OPENS THE STORE ITSELF rather than through `lib/db/pglite`'s
 * `open()`: `open()` applies CORE_DDL as part of opening. By the time it returns,
 * the door has already swung — there is no moment left in which to snapshot. So
 * this file holds the raw connection and does the three steps in the order the
 * technique states: after the decision, before the first step.
 *
 * WHAT IT REFUSES. If CORE_DDL ever grows a destructive statement, a failed or
 * unverifiable snapshot stops the run (exit 1) instead of proceeding: that is the
 * one case where an outage is cheaper than a one-way door with the net cut.
 * Today every step is additive, so a snapshot failure proceeds LOUDLY and names
 * itself in the output — the quiet middle (a failed copy logged at debug level
 * and a chain that runs as if protected) is the one behaviour with no defence.
 */
import { resolve } from "node:path";
import { pglitePath } from "@/lib/db/config";
import { CORE_DDL } from "@/lib/db/pglite/ddl";
import type { Pglite } from "@/lib/db/pglite/internals";
import { describePending, destructiveStatements, pendingSchemaObjects } from "@/lib/db/pglite/pending";
import { manifestPathFor, takePreMigrationSnapshot } from "@/lib/db/pglite/premigration";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);

async function main() {
  const dir = resolve(pglitePath());
  const dryRun = flag("dry-run");
  const keep = Number(arg("keep") ?? 2);
  if (!Number.isInteger(keep) || keep < 1) throw new Error("--keep must be a positive integer");

  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dir) as unknown as Pglite;
  await pg.waitReady;

  const pending = await pendingSchemaObjects(pg);
  console.log(`store: ${dir}`);
  console.log(`pending: ${describePending(pending)}`);

  const destructive = destructiveStatements();
  if (destructive.length > 0) {
    console.log(
      `CORE_DDL carries ${destructive.length} DESTRUCTIVE statement(s) — a snapshot failure will STOP this run.`,
    );
  }

  if (dryRun) {
    console.log(
      pending.count === 0
        ? `[dry-run] nothing to do: 0 steps pending means 0 snapshots, which is the design and not a skipped backup.`
        : `[dry-run] would snapshot ${dir}, verify the copy by reopening it, then apply CORE_DDL.`,
    );
    await pg.close();
    return;
  }

  let snapshotDir: string | null = null;
  if (pending.count > 0) {
    const snap = await takePreMigrationSnapshot({ pg, liveDir: dir, pending, keep });
    if (snap.taken) {
      snapshotDir = snap.dir;
      console.log(`kept snapshots: ${snap.kept?.join(", ") || "(none)"}`);
    } else if (snap.verification && !snap.verification.ok) {
      const line = `snapshot NOT taken: ${snap.reason}`;
      if (destructive.length > 0) {
        console.error(`${line} — refusing to apply a destructive migration unprotected.`);
        await pg.close();
        process.exit(1);
      }
      console.warn(`${line}. Proceeding because every pending step is additive — but UNPROTECTED, and this line is`);
      console.warn(`the record of that. If the apply below fails, there is no copy to go back to.`);
    } else {
      console.log(`snapshot not taken: ${snap.reason}`);
    }
  } else {
    console.log(`0 snapshots taken, as required: a ledger comparison that says nothing is pending must produce none.`);
  }

  const t0 = performance.now();
  await pg.exec(CORE_DDL);
  const ms = performance.now() - t0;

  const after = await pendingSchemaObjects(pg);
  console.log(`applied CORE_DDL in ${ms.toFixed(0)} ms; ${describePending(after)}`);
  if (after.count > 0) {
    console.error(
      `STILL PENDING after the apply — the DDL did not do what it declares. Nothing was rolled back; the store is ` +
        `as the DDL left it` + (snapshotDir ? `, and ${snapshotDir} holds the shape it had before.` : `.`),
    );
    await pg.close();
    process.exit(1);
  }

  if (snapshotDir) {
    console.log(`if this migration turns out to be the wrong one:`);
    console.log(`  npm run db:restore -- --from=${snapshotDir} --yes`);
    console.log(`  (${manifestPathFor(snapshotDir)} records exactly what that copy preserves)`);
  }
  await pg.close();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
