/**
 * `getStore()` keeps a cache of its own, ABOVE the connection memo in
 * lib/db/pglite/internals.ts, and the two must move in lockstep. store.ts wraps
 * the driver's close() to clear its own cache first — because a caller that does
 * getStore() → close() → getStore() in one process used to get back the SAME
 * resolved Store whose methods closed over a `pg` handle that had just been closed,
 * failing every call with no clue why (the comment in store.ts records this).
 *
 * That contract had no test (docs/architect/decisions/2026-07-26-loader-test-coverage.md,
 * "getStore() reset semantics"; lib/db/pglite/open-retry.test.ts covers only the
 * failed-FIRST-open path). This file pins the three moves:
 *   1. concurrent cold-start callers share ONE promise (single-connection safety),
 *   2. close() clears BOTH memos and the next getStore() is a fresh, working store,
 *   3. resetStoreCache() forgets the wrapper but not the connection — the next
 *      getStore() is a new object over the same live connection.
 *
 * Runs in the PGlite lane (lib/testing/lanes.ts); isolated data dir via the fixture.
 */
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

import { pgliteFixtureDir } from "../testing/pglite-fixture";

// Set BEFORE importing anything that calls open(): the connection is memoised on globalThis.
const dataDir = pgliteFixtureDir("politicas-store-lockstep-");

const { getStore, resetStoreCache } = await import("./store");
const { PGLITE_KEY } = await import("./pglite/internals");

const memo = () => (globalThis as Record<string, unknown>)[PGLITE_KEY];

describe("getStore() and the connection memo move in lockstep", () => {
  // 30s: the first test in a PGlite file pays the WASM boot.
  it("two concurrent cold-start callers share one promise and one Store", { timeout: 30_000 }, async () => {
    const [a, b] = await Promise.all([getStore(), getStore()]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(memo()).toBeDefined();
    // The store works before anything is closed.
    expect(await a!.listPersons({ limit: 1 })).toEqual([]);
  });

  it("close() clears BOTH memos, and the next getStore() is a fresh store that works", async () => {
    const first = (await getStore())!;
    await first.close();
    expect(memo(), "connection memo after close()").toBeUndefined();

    const second = (await getStore())!;
    expect(second).not.toBe(first);
    // The regression this pins: a stale wrapper over a closed handle fails every call.
    expect(await second.listPersons({ limit: 1 })).toEqual([]);
    expect(memo(), "connection memo after re-open").toBeDefined();
  });

  it("resetStoreCache() forgets the wrapper but keeps the live connection", async () => {
    const before = (await getStore())!;
    const conn = memo();
    resetStoreCache();
    const after = (await getStore())!;
    expect(after).not.toBe(before);
    expect(memo(), "the connection memo is untouched by a cache reset").toBe(conn);
    expect(await after.listPersons({ limit: 1 })).toEqual([]);
  });
});

afterAll(async () => {
  const store = await getStore();
  if (store) await store.close();
  rmSync(dataDir, { recursive: true, force: true });
});
