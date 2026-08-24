import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { copyStoreDir, dirShape, listByPrefix, rotateByPrefix } from "./storeCopy";

/*
 * The file-shuffling half of backup / pre-migration snapshots, tested over plain
 * directories: no WASM Postgres boots here, so it stays in the unit lane. The
 * half that needs a real engine (verifyStoreCopy) is exercised in
 * lib/db/pglite/premigration.test.ts.
 */

const root = mkdtempSync(join(tmpdir(), "politicas-storecopy-"));
const quiet = () => {};

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeStore(dir: string, files: Record<string, string>): string {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

/** Rotation is by age, and mtimes inside one test run are otherwise identical. */
function age(dir: string, secondsAgo: number): void {
  const t = new Date(Date.now() - secondsAgo * 1000);
  utimesSync(dir, t, t);
}

describe("copyStoreDir", () => {
  it("copies the file set and leaves the holder marker behind", async () => {
    const src = makeStore(join(root, "src"), {
      "PG_VERSION": "17",
      "postmaster.pid": "12345",
      "base/1/2345": "pages",
      "pg_wal/000000010000000000000001": "wal",
    });
    const dest = join(root, "dest");
    await copyStoreDir(src, dest);

    expect(existsSync(join(dest, "PG_VERSION"))).toBe(true);
    expect(existsSync(join(dest, "base/1/2345"))).toBe(true);
    expect(existsSync(join(dest, "pg_wal/000000010000000000000001"))).toBe(true);
    // A copy carrying postmaster.pid makes the next opener of the COPY see a
    // holder that does not exist.
    expect(existsSync(join(dest, "postmaster.pid"))).toBe(false);

    const shape = await dirShape(dest);
    expect(shape.files).toBe(3);
    expect(shape.bytes).toBe(statSync(join(dest, "PG_VERSION")).size + "pages".length + "wal".length);
  });
});

describe("rotateByPrefix", () => {
  const prefix = ".rot-";

  it("keeps the last N, removes the oldest first, and never touches another prefix", async () => {
    const bed = mkdtempSync(join(root, "bed-"));
    const ours: string[] = [];
    for (let i = 0; i < 4; i++) {
      const dir = makeStore(join(bed, `${prefix}${i}`), { "PG_VERSION": "17" });
      age(dir, 100 - i); // 0 is oldest
      ours.push(dir);
    }
    const theirs = makeStore(join(bed, ".someone-elses-copy"), { "PG_VERSION": "17" });
    const parked = makeStore(join(bed, ".rot-DIFFERENT-but-same-prefix"), { "PG_VERSION": "17" });
    age(parked, 200); // older than all of ours — and still ours by prefix

    const result = await rotateByPrefix(bed, prefix, 2, { log: quiet });
    expect(result.removed).toEqual([".rot-DIFFERENT-but-same-prefix", `${prefix}0`, `${prefix}1`]);
    expect(result.kept).toEqual([`${prefix}2`, `${prefix}3`]);
    expect(existsSync(ours[0]!)).toBe(false);
    expect(existsSync(ours[3]!)).toBe(true);
    // Not ours by prefix, so not ours to delete — someone parked it for autopsy.
    expect(existsSync(theirs)).toBe(true);
  });

  it("takes each copy's sidecars with it — half a rotated snapshot is a lie", async () => {
    const bed = mkdtempSync(join(root, "bed-side-"));
    for (let i = 0; i < 2; i++) {
      const dir = makeStore(join(bed, `${prefix}${i}`), { "PG_VERSION": "17" });
      writeFileSync(`${dir}.manifest.json`, "{}");
      age(dir, 100 - i);
    }
    await rotateByPrefix(bed, prefix, 1, { log: quiet, alsoRemove: (c) => [`${c.path}.manifest.json`] });
    expect(existsSync(join(bed, `${prefix}0.manifest.json`))).toBe(false);
    expect(existsSync(join(bed, `${prefix}1.manifest.json`))).toBe(true);
  });

  it("removes nothing in a dry run, and still says what it would remove", async () => {
    const bed = mkdtempSync(join(root, "bed-dry-"));
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      const dir = makeStore(join(bed, `${prefix}${i}`), { "PG_VERSION": "17" });
      age(dir, 100 - i);
    }
    const result = await rotateByPrefix(bed, prefix, 1, { dryRun: true, log: (l) => lines.push(l) });
    expect(result.removed).toEqual([`${prefix}0`, `${prefix}1`]);
    expect((await listByPrefix(bed, prefix)).map((c) => c.name)).toEqual([
      `${prefix}0`,
      `${prefix}1`,
      `${prefix}2`,
    ]);
    expect(lines.join("\n")).toContain("[dry-run] would remove");
  });

  it("says so when there is nothing to rotate", async () => {
    const bed = mkdtempSync(join(root, "bed-empty-"));
    const lines: string[] = [];
    const result = await rotateByPrefix(bed, prefix, 2, { log: (l) => lines.push(l) });
    expect(result).toEqual({ kept: [], removed: [] });
    expect(lines.join("\n")).toContain("nothing to rotate");
  });
});
