/**
 * `pgliteFixtureDir(prefix)` — the one door a store-backed test walks through to
 * get its own isolated PGlite data directory.
 *
 * It replaces the two lines every such file used to open with:
 *
 *     const dataDir = mkdtempSync(join(tmpdir(), "politicas-x-"));
 *     process.env.PGLITE_PATH = dataDir;
 *
 * which cost 4,1–4,8 s per file because `new PGlite(<empty dir>)` runs a full
 * `initdb`. This hands back a COPY of the pre-provisioned template instead
 * (969–1 219 ms, measured 2026-08-24 — see lib/testing/pglite-template.ts for the
 * full decomposition and for why copying THIS store is safe when copying the live
 * one is not).
 *
 * It must be called at MODULE TOP LEVEL, before the dynamic import of anything
 * that calls `open()` — `pglitePath()` reads the env lazily but the connection is
 * memoised on globalThis, so the first caller wins.
 *
 * PRECONDITIONS ARE ASSERTED, NOT ASSUMED. The registry technique
 * (test-harness/isolation-lanes) is explicit that a launcher which silently falls
 * back to the real profile has inverted its purpose. So:
 *   • the returned directory is always under the OS temp dir and never inside the
 *     repo — a fixture that could resolve to the live `./.pglite` is refused outright;
 *   • the copy is structurally verified against the template (file count + byte
 *     total) before it is handed over, so a torn copy fails HERE, naming the
 *     fixture, instead of surfacing as an inexplicable assertion failure inside
 *     whichever test happened to read the data first;
 *   • running without a template (a bare `vitest run <one file>` outside the lane)
 *     is legal but ANNOUNCED, and it degrades to the old cold boot — the same
 *     world, only slower, never a different one.
 */

import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { dirShape, isTemplateReady } from "./pglite-template";

let announcedColdPath = false;

/**
 * Create an isolated PGlite data dir for this test file and point `PGLITE_PATH`
 * at it. Returns the directory so the caller can keep its own
 * `afterAll(() => rmSync(dir, { recursive: true, force: true }))` reaper — the
 * reaper stays visible in the test file on purpose.
 *
 * @param prefix `mkdtemp` prefix, e.g. `"politicas-graph-repo-"`.
 */
export function pgliteFixtureDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));

  // Refuse anything that is not demonstrably scratch. The live store lives in the
  // repo; a fixture that resolved there would let a test rewrite real data.
  const abs = resolve(dir);
  if (!abs.startsWith(resolve(tmpdir()) + sep)) {
    throw new Error(`[pglite-fixture] refusing a data dir outside the OS temp dir: ${abs}`);
  }

  const template = process.env.POLITICAS_PGLITE_TEMPLATE;
  if (template && isTemplateReady(template)) {
    cpSync(template, dir, { recursive: true });
    const want = dirShape(template);
    const got = dirShape(dir);
    if (got.files !== want.files || got.bytes !== want.bytes) {
      throw new Error(
        `[pglite-fixture] the template copy for "${prefix}" is TORN — template ${want.files} files / ` +
          `${want.bytes} B, copy ${got.files} files / ${got.bytes} B. A copy that does not match the ` +
          `template byte-for-byte must not reach a test (memory/robocopy-of-a-live-pglite-store-can-corrupt.md).`,
      );
    }
  } else if (!announcedColdPath) {
    announcedColdPath = true;
    console.info(
      `[pglite-fixture] no template available (POLITICAS_PGLITE_TEMPLATE ${template ? "not ready" : "unset"}) — ` +
        `falling back to a cold initdb per file, ~4,1–4,8 s each. Run this file through ` +
        `\`npm run test:pglite\` to get the template.`,
    );
  }

  process.env.PGLITE_PATH = dir;
  return dir;
}
