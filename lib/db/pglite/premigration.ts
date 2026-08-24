/**
 * Pre-migration snapshots: the undo a one-way door has to manufacture for
 * itself, plus the restore path that makes the copy safety rather than storage.
 *
 * WHY IT LOOKS LIKE THIS HERE. `open()` replays the whole `CORE_DDL` at every
 * boot behind `if not exists` guards, so there is no ledger and no "step 42 is
 * next". `pending.ts` recovers the missing signal from the catalog, which lets
 * this module obey the technique's central refinement rather than the fallback
 * it prescribes for ledger-less designs: **snapshot only when the pending work
 * is real**, never on every boot of a 2 GB store.
 *
 * The contract, in the order the steps happen:
 *
 *  1. AFTER THE DECISION, BEFORE THE FIRST STEP. Nothing pending ⇒ zero
 *     snapshots. A fresh store (none of the declared tables present) ⇒ zero
 *     snapshots either: applying the DDL there is a creation, and there is
 *     nothing to preserve.
 *  2. THE STORE IS A FILE SET. The caller holds the one connection, so the
 *     spelling used is quiesce-then-copy: CHECKPOINT, then copy the directory
 *     (minus the holder marker) through `storeCopy.ts`, the same door the
 *     on-demand backup uses.
 *  3. VERIFY AT CREATION, NOT AT RESTORE. The copy is REOPENED and read before
 *     the migration is allowed to proceed. A copy that cannot be opened is
 *     deleted and reported as not taken — a snapshot nobody has ever read is a
 *     gate that never looked at its target.
 *  4. NAME WHAT IT PRESERVES. The directory carries the date and the
 *     fingerprint of the schema shape it holds; the manifest beside it carries
 *     the same fingerprint in full, the exact objects that were pending, and
 *     what it took to verify the copy. `backup-final-2` is archaeology.
 *  5. ROTATION IS BY MIGRATION BOUNDARY, NOT BY DATE. Keep the last N
 *     pre-migration copies — one restore point per one-way door — and delete the
 *     WHOLE copy, manifest included.
 *
 * WHAT THIS MODULE REFUSES TO DECIDE. Whether a failed snapshot should stop the
 * migration is the caller's policy, because the honest answer keys on what is
 * pending: additive work proceeds loudly, destructive work refuses
 * (`destructiveStatements()` is here so the caller can tell which it has).
 * `scripts/db/migrate.ts` is where that policy is written down.
 */

import { createHash } from "node:crypto";
import { rename, rm, statfs, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Pglite } from "./internals";
import type { PendingSchema } from "./pending";
import {
  copyStoreDir,
  dirSize,
  listByPrefix,
  mbOf,
  rotateByPrefix,
  verifyStoreCopy,
  type CopyVerification,
} from "./storeCopy";

export const SNAPSHOT_PREFIX = ".pglite-premigration-";
export const DAMAGED_PREFIX = ".pglite-damaged-";
/** One restore point per one-way door, plus the one before it. */
export const DEFAULT_KEEP = 2;
/** A copying tool must not be the tool that fills the disk. */
export const HEADROOM = 1.1;

/* ── what kind of work is pending ──────────────────────────────────────────── */

/** Lives in `pending.ts` (which stays free of node-only imports so `open()` can
 *  reach it), re-exported here because this is where callers look for it. */
export { destructiveStatements } from "./pending";

/**
 * A stable id for the schema SHAPE a snapshot preserves — every public column and
 * index, sorted, hashed. It answers the question a restore actually has ("what
 * can open this file?") without inventing a version number that nothing else in
 * the repo would maintain.
 */
export async function schemaFingerprint(pg: Pglite): Promise<string> {
  const cols = await pg.query<{ t: unknown; c: unknown }>(
    `select table_name as t, column_name as c
       from information_schema.columns where table_schema = 'public'`,
  );
  const idx = await pg.query<{ i: unknown }>("select indexname as i from pg_indexes where schemaname = 'public'");
  const parts = [
    ...cols.rows.map((r) => `c:${String(r.t)}.${String(r.c)}`),
    ...idx.rows.map((r) => `i:${String(r.i)}`),
  ].sort();
  return createHash("sha256").update(parts.join("\n"), "utf8").digest("hex");
}

/* ── taking one ────────────────────────────────────────────────────────────── */

export interface SnapshotManifest {
  schema: "politicas-premigration";
  schemaVersion: 1;
  takenAt: string;
  liveDir: string;
  snapshotDir: string;
  /** Fingerprint of the schema shape INSIDE the copy — what it preserves. */
  preservesFingerprint: string;
  /** What was about to be applied when it was taken. */
  pending: PendingSchema;
  /** Proof it was read back at creation. */
  verification: CopyVerification;
  bytes: number;
}

export interface SnapshotResult {
  taken: boolean;
  dir: string | null;
  manifestPath: string | null;
  verification: CopyVerification | null;
  /** Why nothing was taken, when nothing was. */
  reason?: string;
  kept?: string[];
}

export const manifestPathFor = (snapshotDir: string) => `${snapshotDir}.manifest.json`;

export interface SnapshotRequest {
  pg: Pglite;
  liveDir: string;
  pending: PendingSchema;
  keep?: number;
  log?: (line: string) => void;
  /** Test/ops seam: an alternative clock for the directory name. */
  now?: () => Date;
}

/**
 * Take one, verified, named, rotated. Returns `taken: false` with a reason when
 * the technique says not to take one at all — that is a SUCCESS, and the caller
 * must not read it as a failed backup.
 *
 * Throws only when the disk cannot hold the copy: proceeding to fill a user's
 * drive in the name of protecting their data is the one outcome nobody wants.
 */
export async function takePreMigrationSnapshot(req: SnapshotRequest): Promise<SnapshotResult> {
  const log = req.log ?? ((line: string) => console.log(line));
  const liveDir = resolve(req.liveDir);
  const root = resolve(liveDir, "..");
  const keep = req.keep ?? DEFAULT_KEEP;

  if (req.pending.count === 0) {
    return { taken: false, dir: null, manifestPath: null, verification: null, reason: "0 steps pending" };
  }
  if (req.pending.storeState === "fresh") {
    return {
      taken: false,
      dir: null,
      manifestPath: null,
      verification: null,
      reason: "fresh store — the DDL creates it, there is no earlier state to preserve",
    };
  }

  const bytes = await dirSize(liveDir);
  const fs = await statfs(root);
  const free = Number(fs.bavail) * Number(fs.bsize);
  if (free < bytes * HEADROOM) {
    throw new Error(
      `refusing to snapshot: ${mbOf(bytes)} store needs ~${mbOf(bytes * HEADROOM)} free and ${root} has ` +
        `${mbOf(free)}. The tool that protects the data must not be the tool that fills the disk.`,
    );
  }

  const fingerprint = await schemaFingerprint(req.pg);
  const at = (req.now ?? (() => new Date()))();
  const stamp = at.toISOString().slice(0, 10);
  let dir = join(root, `${SNAPSHOT_PREFIX}${stamp}-${fingerprint.slice(0, 8)}`);
  if ((await listByPrefix(root, SNAPSHOT_PREFIX)).some((c) => c.path === dir)) {
    // Same schema shape snapshotted twice in one day: keep both, because the
    // second one preserves data the first one does not.
    dir = `${dir}-${at.toISOString().slice(11, 19).replace(/:/g, "")}`;
  }

  // Quiesce, then copy. We hold the one connection, so "hold writers off" is
  // simply: issue no writes between here and the copy.
  log(`pre-migration snapshot: ${req.pending.count} object(s) pending, checkpointing ${mbOf(bytes)}…`);
  await req.pg.exec("CHECKPOINT");
  await copyStoreDir(liveDir, dir);

  const verification = await verifyStoreCopy(dir);
  if (!verification.ok) {
    await rm(dir, { recursive: true, force: true });
    return {
      taken: false,
      dir: null,
      manifestPath: null,
      verification,
      reason: `the copy did not verify and was removed: ${verification.error ?? "unknown"}`,
    };
  }

  const manifest: SnapshotManifest = {
    schema: "politicas-premigration",
    schemaVersion: 1,
    takenAt: at.toISOString(),
    liveDir,
    snapshotDir: dir,
    preservesFingerprint: fingerprint,
    pending: req.pending,
    verification,
    bytes: verification.bytes,
  };
  const manifestPath = manifestPathFor(dir);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log(
    `  took ${dir} (${mbOf(verification.bytes)}, ${verification.files} files), reopened and read ` +
      `${verification.tables} tables from it. Preserves schema ${fingerprint.slice(0, 8)}.`,
  );

  const rotated = await rotateByPrefix(root, SNAPSHOT_PREFIX, keep, {
    log,
    alsoRemove: (c) => [manifestPathFor(c.path)],
  });
  return { taken: true, dir, manifestPath, verification, kept: rotated.kept };
}

/* ── using one ─────────────────────────────────────────────────────────────── */

export interface RestoreResult {
  restoredFrom: string;
  /** Where the store that was there went. Never deleted — it is evidence. */
  movedAsideTo: string | null;
  verification: CopyVerification;
}

/**
 * Put a snapshot's file set back in place.
 *
 * MECHANICS, in the technique's order: verify the snapshot FIRST (restoring an
 * unreadable copy over a damaged store loses both), move the damaged store aside
 * rather than deleting it (sometimes the failed migration is the recoverable
 * one), copy the snapshot in, and verify what now sits at the live path.
 *
 * SEMANTICS: restoring discards everything written after the snapshot. This
 * function does not decide that anybody's delta is expendable — the caller
 * (`scripts/db/restore.ts`) requires an explicit affirmative, because outside the
 * one window where the loss is provably empty, restore is a consented act.
 *
 * The caller must also ensure NOTHING holds the store: this copies over the
 * directory, and PGlite allows exactly one holder.
 */
export async function restoreFromSnapshot(opts: {
  snapshotDir: string;
  liveDir: string;
  log?: (line: string) => void;
  now?: () => Date;
}): Promise<RestoreResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const snapshotDir = resolve(opts.snapshotDir);
  const liveDir = resolve(opts.liveDir);

  const pre = await verifyStoreCopy(snapshotDir);
  if (!pre.ok) {
    throw new Error(`refusing to restore: ${snapshotDir} did not verify (${pre.error ?? "unknown"})`);
  }
  log(`restoring from ${snapshotDir} (${mbOf(pre.bytes)}, ${pre.files} files, ${pre.tables} tables read back)`);

  let movedAsideTo: string | null = null;
  let livePresent = true;
  try {
    await dirSize(liveDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    livePresent = false;
    log(`  nothing at ${liveDir} to move aside`);
  }
  if (livePresent) {
    const stamp = (opts.now ?? (() => new Date()))().toISOString().replace(/[:.]/g, "-");
    movedAsideTo = join(resolve(liveDir, ".."), `${DAMAGED_PREFIX}${stamp}`);
    try {
      await rename(liveDir, movedAsideTo);
    } catch (err) {
      // A directory something still has open cannot be renamed on Windows. That
      // is a REFUSAL, not a reason to copy over the store in place: copying over
      // a held store is the corruption this repo has a memo about. Nothing has
      // been changed at this point, and the message says so.
      throw new Error(
        `refusing to restore: ${liveDir} could not be moved aside (${String(err)}). Something is still holding it — ` +
          `stop every process that opened this store and retry. NOTHING has been changed.`,
      );
    }
    log(`  the store that was there is NOT deleted — moved to ${movedAsideTo}`);
  }

  await copyStoreDir(snapshotDir, liveDir);
  const verification = await verifyStoreCopy(liveDir);
  if (!verification.ok) {
    throw new Error(
      `restored ${liveDir} but it did not verify (${verification.error ?? "unknown"}). The previous store is ` +
        `still at ${movedAsideTo ?? "(nothing was moved aside)"} — nothing has been deleted.`,
    );
  }
  log(`  restored and verified: ${verification.tables} tables readable at ${liveDir}.`);
  return { restoredFrom: snapshotDir, movedAsideTo, verification };
}
