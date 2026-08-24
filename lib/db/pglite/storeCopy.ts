/**
 * Copying a PGlite store, and the rules that make a copy trustworthy — ONE
 * implementation, shared by `scripts/db/backup.ts` (the on-demand backup) and
 * `lib/db/pglite/premigration.ts` (the pre-migration snapshot).
 *
 * These rules were paid for once already and must not be re-derived per caller:
 *
 *   • `postmaster.pid` is the holder marker of the process taking the copy. A
 *     copy that carries it makes the next opener of the COPY see a phantom
 *     holder, so it is filtered out — never "cleaned up later".
 *   • The store is a FILE SET, not a file: between checkpoints, committed data
 *     lives only in `pg_wal`. Every caller CHECKPOINTs before copying (they hold
 *     the connection, so they can) and copies the whole directory.
 *   • A bytewise copy of a store another process holds is torn by construction
 *     (memory/robocopy-of-a-live-pglite-store-can-corrupt.md,
 *     memory/held-store-mimics-corruption.md). Callers copy only a store they
 *     themselves hold.
 *   • Rotation deletes the WHOLE copy and only copies carrying the caller's own
 *     prefix — someone's `.pglite-damaged-…` parked for autopsy is not ours.
 */

import { cp, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import type { Pglite } from "./internals";

const MB = 1_048_576;
export const mbOf = (bytes: number) => `${Math.round(bytes / MB).toLocaleString("cs-CZ")} MB`;

export async function dirSize(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}

/** File count + byte total — the cheap structural check a copy must match. */
export async function dirShape(path: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) {
      const sub = await dirShape(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files++;
      bytes += (await stat(p)).size;
    }
  }
  return { files, bytes };
}

/** Copy a data dir the caller holds, without the holder marker. */
export async function copyStoreDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true, filter: (from) => !from.endsWith("postmaster.pid") });
}

export interface StoreCopyEntry {
  name: string;
  path: string;
  mtimeMs: number;
}

/** Copies carrying `prefix`, oldest first. */
export async function listByPrefix(root: string, prefix: string): Promise<StoreCopyEntry[]> {
  const out: StoreCopyEntry[] = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    if (!e.isDirectory() || !e.name.startsWith(prefix)) continue;
    const path = join(root, e.name);
    out.push({ name: e.name, path, mtimeMs: (await stat(path)).mtimeMs });
  }
  return out.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

export interface RotateResult {
  kept: string[];
  removed: string[];
}

/**
 * Keep the last `keep` copies carrying `prefix`, oldest removed first, printing
 * what goes before it goes. Creation names the reaper: every caller that makes a
 * copy automatically calls this, or user disks fill with copies of their own data
 * and the eventual "fix" is someone deleting all of them.
 */
export async function rotateByPrefix(
  root: string,
  prefix: string,
  keep: number,
  opts: { dryRun?: boolean; log?: (line: string) => void; alsoRemove?: (dir: StoreCopyEntry) => string[] } = {},
): Promise<RotateResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const copies = await listByPrefix(root, prefix);
  const excess = copies.slice(0, Math.max(0, copies.length - keep));
  const removed: string[] = [];
  if (excess.length === 0) {
    log(`copies matching ${prefix}: ${copies.length}, cap ${keep} — nothing to rotate`);
  } else {
    log(`copies matching ${prefix}: ${copies.length}, cap ${keep} — rotating out ${excess.length}:`);
    for (const c of excess) {
      log(`  ${opts.dryRun ? "[dry-run] would remove" : "removing"} ${c.name} (${mbOf(await dirSize(c.path))})`);
      if (!opts.dryRun) {
        await rm(c.path, { recursive: true, force: true });
        // Sidecars (a manifest written beside the copy) go with it: half a
        // rotated snapshot is a file that describes something that is gone.
        for (const extra of opts.alsoRemove?.(c) ?? []) await rm(extra, { force: true });
      }
      removed.push(c.name);
    }
  }
  const left = await listByPrefix(root, prefix);
  return { kept: left.map((c) => c.name), removed };
}

export interface CopyVerification {
  ok: boolean;
  /** Public tables the copy could be read for. -1 when it could not be opened. */
  tables: number;
  files: number;
  bytes: number;
  error?: string;
}

/**
 * Open the copy and read from it. An unverified backup is a gate that never
 * looked at its target: the thing being gated is RECOVERABILITY, and only
 * opening the copy observes it. Structural checks (files/bytes) come first
 * because a zero-file "copy" should not cost a WASM boot to reject.
 *
 * "IT OPENED" IS NOT THE CHECK — measured 2026-08-24, and this is the trap this
 * function exists to avoid. Given a directory it cannot read as a store, PGlite
 * does not fail: it INITIALIZES A NEW ONE THERE. Deleting `global/pg_control`
 * from a 19 MB provisioned copy, and deleting `base/` outright, both produced a
 * connection that opened cleanly and answered queries — with ZERO tables. A
 * verifier that only asked "did it open" would have called both of those
 * recoverable. So the copy must come back carrying tables; a copy of a store
 * that HAS no tables is not a thing this repo ever snapshots (see
 * premigration.ts: a fresh store is never snapshotted).
 *
 * The copy is opened directly, never through `open()` — that memoises a
 * connection on `globalThis` and would leave the verifier's handle where the
 * application expects the live store.
 */
export async function verifyStoreCopy(dir: string): Promise<CopyVerification> {
  let shape = { files: 0, bytes: 0 };
  try {
    shape = await dirShape(dir);
  } catch (err) {
    return { ok: false, tables: -1, files: 0, bytes: 0, error: `cannot read the copy: ${String(err)}` };
  }
  if (shape.files === 0 || shape.bytes === 0) {
    return { ok: false, tables: -1, ...shape, error: "the copy is empty" };
  }
  let pg: { waitReady: Promise<unknown>; close(): Promise<void> } | null = null;
  try {
    const { PGlite } = await import("@electric-sql/pglite");
    pg = new PGlite(dir);
    await pg.waitReady;
    const r = await (pg as unknown as Pglite).query<{ n: unknown }>(
      "select count(*)::int as n from pg_tables where schemaname = 'public'",
    );
    await pg.close();
    pg = null;
    const tables = Number(r.rows[0]?.n ?? 0);
    if (tables === 0) {
      return {
        ok: false,
        tables,
        ...shape,
        error:
          "the copy opened but carries no tables — PGlite initializes a new store in a directory it cannot read, " +
          "so this is what a torn or gutted copy looks like from the outside",
      };
    }
    return { ok: true, tables, ...shape };
  } catch (err) {
    return { ok: false, tables: -1, ...shape, error: String(err) };
  } finally {
    // A verification that fails must not leave the directory open: on Windows an
    // open handle makes the very next step of a restore (renaming the damaged
    // store aside) fail with EPERM, i.e. the recovery path defeated by its own
    // check. Closing can itself fail on a store that never came up — that is
    // said out loud rather than swallowed.
    if (pg) {
      await pg
        .close()
        .catch((closeErr: unknown) =>
          console.warn(`[db] could not close an unverifiable copy at ${dir}: ${String(closeErr)}`),
        );
    }
  }
}
