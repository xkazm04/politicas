import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Regression test for the memoised-rejection bug (architect 2026-07-26,
// docs/architect/decisions/2026-07-26-memoised-rejection-open.md): a failed
// FIRST open() used to stay cached on globalThis forever, so getStore()'s
// retry-after-failure received the same rejection until process restart.
//
// Failure is induced for real: PGLITE_PATH points UNDER a plain file, so the
// data-dir mkdir cannot succeed. Runs in its own vitest worker — the globalThis
// memo does not leak into the other PGlite test files (they isolate the same way).
const baseDir = mkdtempSync(join(tmpdir(), "politicas-open-retry-"));
const blockerFile = join(baseDir, "blocker");
writeFileSync(blockerFile, "");
process.env.PGLITE_PATH = join(blockerFile, "nested");

const internals = await import("./internals");
const { open, PGLITE_KEY } = internals;

describe("open() retry after a failed first open", () => {
  it("rejects on an unusable data dir and clears the globalThis memo", async () => {
    await expect(open()).rejects.toThrow();
    expect((globalThis as Record<string, unknown>)[PGLITE_KEY]).toBeUndefined();
  });

  it("a subsequent open() attempts fresh and succeeds", async () => {
    process.env.PGLITE_PATH = join(baseDir, "data");
    const pg = await open();
    const r = await pg.query<{ one: number }>("select 1 as one");
    expect(r.rows[0].one).toBe(1);
  });
});

afterAll(async () => {
  const g = globalThis as Record<string, unknown>;
  if (g[PGLITE_KEY]) await (g[PGLITE_KEY] as Promise<{ close(): Promise<void> }>).then((pg) => pg.close());
  rmSync(baseDir, { recursive: true, force: true });
});
