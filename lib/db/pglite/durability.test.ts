import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../testing/pglite-fixture";

// Isolated data dir — NEVER the live ./.pglite.
const dataDir = pgliteFixtureDir("politicas-durability-");

const { open } = await import("./internals");
const { DURABILITY_CONTRACT, assertDurabilityContract, checkDurability, durabilityReport, survivalSentence } =
  await import("./durability");
const { verifyStoreCopy } = await import("./storeCopy");

/*
 * The durability contract, TESTED rather than cited — which the technique is
 * explicit is the test nobody writes, because the engine is "known reliable".
 * The engine is; what is under test is this application's use of it.
 */

const scratch: string[] = [];
afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

describe("the recorded contract", () => {
  it("is what the engine actually reports", async () => {
    const pg = await open();
    const check = await checkDurability(pg);
    expect(check.mismatches).toEqual([]);
    for (const r of check.readings) expect(r.effective).toBe(DURABILITY_CONTRACT[r.setting]);

    // fsync is not a default here — PGlite sets it on the postgres command line,
    // which is why this repo cannot simply choose otherwise.
    expect(check.readings.find((r) => r.setting === "fsync")?.source).toBe("command line");
    expect(check.survives).toContain("NOT a power cut");
  });

  it("derives what the store survives from what was READ, not from the comment", () => {
    const base = (over: Record<string, string>) =>
      Object.entries({ ...DURABILITY_CONTRACT, ...over }).map(([setting, effective]) => ({
        setting,
        effective,
        expected: DURABILITY_CONTRACT[setting]!,
        source: "test",
        matches: effective === DURABILITY_CONTRACT[setting],
      }));
    expect(survivalSentence(base({ fsync: "on" }))).toContain("a power cut, up to the last committed transaction");
    expect(survivalSentence(base({ fsync: "on", synchronous_commit: "off" }))).toContain("had not yet been flushed");
    expect(survivalSentence(base({ wal_level: "minimal" }))).toContain("NOTHING is guaranteed");
  });

  it("says loudly what the store promises instead, when a setting has moved", async () => {
    const pg = await open();
    const warnings: string[] = [];
    const original = DURABILITY_CONTRACT.wal_level;
    try {
      // Move the CONTRACT, not the engine: the same mismatch a silently
      // downgraded store would produce, without pretending to reconfigure one.
      (DURABILITY_CONTRACT as Record<string, string>).wal_level = "logical";
      const check = await assertDurabilityContract(pg, (l) => warnings.push(l));
      expect(check.mismatches.map((m) => m.setting)).toEqual(["wal_level"]);
      expect(warnings.join("\n")).toContain('wal_level is "replica"');
      expect(warnings.join("\n")).toContain("What it survives NOW");
    } finally {
      (DURABILITY_CONTRACT as Record<string, string>).wal_level = original!;
    }
    // And it is silent when the contract holds.
    const quiet: string[] = [];
    await assertDurabilityContract(pg, (l) => quiet.push(l));
    expect(quiet).toEqual([]);
  });

  it("reports the file-set clause with the settings", async () => {
    const pg = await open();
    const text = durabilityReport(await checkDurability(pg));
    expect(text).toContain("main files PLUS pg_wal");
    expect(text).toContain("never forced to stable storage");
  });
});

describe("the crash the contract claims to survive", () => {
  it("recovers a commit made by a process that died without closing", async () => {
    const store = mkdtempSync(join(tmpdir(), "politicas-crash-"));
    scratch.push(store);
    const template = process.env.POLITICAS_PGLITE_TEMPLATE;
    if (template) cpSync(template, store, { recursive: true });

    // A separate process commits and exits without close() — no clean shutdown,
    // no shutdown checkpoint. This is the crash, not a metaphor for one.
    execFileSync(process.execPath, [resolve("lib/testing/crash-writer.mjs"), store, "survived"], { stdio: "pipe" });
    // The holder marker left behind is itself evidence of the unclean exit.
    expect(existsSync(join(store, "postmaster.pid"))).toBe(true);

    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(store);
    await pg.waitReady;
    const rows = await pg.query<{ id: string }>("select id from crash_probe");
    await pg.close();

    // Recovery replayed the journal: the committed row is there.
    expect(rows.rows.map((r) => r.id)).toEqual(["survived"]);
    // What this does NOT prove is the power-cut case — fsync is off on this
    // substrate, so none of those journal writes were forced to the disk.
  });

  it("detects a copy taken without the journal instead of accepting it", async () => {
    // The file-set clause, from the failure side: a "backup" that grabs the main
    // files and leaves pg_wal behind is the classic silent data-loss copy. It
    // must be REJECTED at verification, not discovered on restore day.
    const partial = mkdtempSync(join(tmpdir(), "politicas-nowal-"));
    scratch.push(partial);
    cpSync(dataDir, partial, { recursive: true, filter: (src) => !src.includes("pg_wal") });
    expect(existsSync(join(partial, "pg_wal"))).toBe(false);

    const v = await verifyStoreCopy(partial);
    expect(v.ok).toBe(false);
  });
});
