import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Cardinality-floor gate (architect 2026-07-26,
// docs/architect/decisions/2026-07-26-ingest-readiness-guard.md): a store
// below its floors must read as NOT ready so public loaders fall back instead
// of rendering a half-ingested graph as truth.
const dataDir = mkdtempSync(join(tmpdir(), "politicas-readiness-"));
process.env.PGLITE_PATH = dataDir;
delete process.env.KG_READINESS_OFF;

const { open } = await import("./pglite/internals");
const { getStore } = await import("./store");
const { storeReady, CARDINALITY_FLOORS } = await import("./readiness");

describe("storeReady", () => {
  // 30s: the first test in the file pays the PGlite WASM boot, which contends
  // when several PGlite test files run in parallel workers.
  it("an empty (freshly created) store is NOT ready", { timeout: 30_000 }, async () => {
    const store = await getStore();
    expect(store).not.toBeNull();
    expect(await storeReady(store!, ["person"])).toBe(false);
  });

  it("KG_READINESS_OFF=1 bypasses the gate (test escape hatch)", async () => {
    const store = await getStore();
    process.env.KG_READINESS_OFF = "1";
    try {
      expect(await storeReady(store!, ["person"])).toBe(true);
    } finally {
      delete process.env.KG_READINESS_OFF;
    }
  });

  it("a store at the floor is ready; one row below is not", async () => {
    const floor = CARDINALITY_FLOORS.person;
    const pg = await open();
    const values: string[] = [];
    const params: unknown[] = [];
    for (let i = 0; i < floor; i++) {
      values.push(`($${i * 2 + 1}, 'person', $${i * 2 + 2}, '{}'::jsonb, 1, '{}'::jsonb)`);
      params.push(`psp:person:${1000 + i}`, `Osoba ${1000 + i}`);
    }
    // floor − 1 rows first: still below.
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance) values ${values.slice(0, floor - 1).join(",")}`,
      params.slice(0, (floor - 1) * 2),
    );
    const store = await getStore();
    expect(await storeReady(store!, ["person"])).toBe(false);

    // The last row tips it to ready.
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance) values ($1, 'person', $2, '{}'::jsonb, 1, '{}'::jsonb)`,
      params.slice((floor - 1) * 2),
    );
    expect(await storeReady(store!, ["person"])).toBe(true);

    // Other kinds stay below their floors → mixed request is not ready.
    expect(await storeReady(store!, ["person", "bill"])).toBe(false);
  });
});

afterAll(async () => {
  const pg = await open();
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});
