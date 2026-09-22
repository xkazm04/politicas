/*
 * [G5] THE SENTINEL'S OUTBOX, on a real store copy.
 *
 * The guarantee under test is the one the whole lane is built on: the sentinel
 * audits a COPY and never opens the live handle, so its verdict travels as a
 * file and lands on the next live open. What must hold:
 *
 *   • replaying a queue file cannot duplicate a verdict (id = content hash),
 *   • a half-written line is COUNTED, never repaired into a verdict,
 *   • the certification join is EXACT on the manifest hash — a "nearest run"
 *     would certify a release the sentinel never saw, which is precisely the
 *     "never ran rendered as passed" failure the third verdict state abolishes.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { pgliteFixtureDir } from "@/lib/testing/pglite-fixture";

const dataDir = pgliteFixtureDir("politicas-g5-queue-");
process.env.PGLITE_PATH = dataDir;
const queueRoot = mkdtempSync(join(tmpdir(), "politicas-g5-outbox-"));
const queuePath = join(queueRoot, "sentinel-queue.jsonl");
process.env.SENTINEL_QUEUE_PATH = queuePath;

const { open, PGLITE_KEY } = await import("./internals");
const {
  drainSentinelQueue,
  enqueueSentinelRun,
  readNewestCertification,
  readSentinelQueue,
  sentinelQueueDisplayPath,
  sentinelQueueEntry,
} = await import("./sentinelQueue");

const report = (over: Partial<{ manifestHash: string | null; ranAt: string; verdict: "ok" | "violation" | "unevaluable" }> = {}) => ({
  manifestHash: "abc12345",
  ranAt: "2026-09-04T06:00:00.000Z",
  verdict: "ok" as const,
  ...over,
});

beforeEach(async () => {
  writeFileSync(queuePath, "", "utf8");
  const pg = await open();
  await pg.query(`delete from sentinel_run`);
});

afterAll(async () => {
  const g = globalThis as Record<string, unknown>;
  const held = g[PGLITE_KEY] as Promise<{ close(): Promise<void> }> | undefined;
  if (held) await held.then((pg) => pg.close());
  delete g[PGLITE_KEY];
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(queueRoot, { recursive: true, force: true });
});

describe("the outbox file", () => {
  it("keys an entry by the content of the report, not by when it was written", () => {
    expect(sentinelQueueEntry(report()).id).toBe(sentinelQueueEntry(report()).id);
    expect(sentinelQueueEntry(report()).id).not.toBe(
      sentinelQueueEntry(report({ verdict: "violation" })).id,
    );
  });

  it("appends rather than replaces — two runs in a day are two verdicts", () => {
    enqueueSentinelRun(report());
    enqueueSentinelRun(report({ ranAt: "2026-09-04T18:00:00.000Z" }));
    expect(readSentinelQueue(queuePath).entries).toHaveLength(2);
    expect(readFileSync(queuePath, "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("counts a half-written line instead of turning it into a verdict", () => {
    enqueueSentinelRun(report());
    writeFileSync(queuePath, `${readFileSync(queuePath, "utf8")}{"id":"trunca`, "utf8");
    const read = readSentinelQueue(queuePath);
    expect(read.entries).toHaveLength(1);
    expect(read.malformed).toBe(1);
  });

  it("admits its own path, portably", () => {
    expect(sentinelQueueDisplayPath()).not.toContain("\\");
  });
});

describe("draining into the store", () => {
  it("applies each verdict once, however many times the file is replayed", async () => {
    const pg = await open();
    enqueueSentinelRun(report());
    expect(await drainSentinelQueue(pg, queuePath)).toEqual({
      applied: 1,
      alreadyPresent: 0,
      malformed: 0,
    });
    // The queue is emptied only after everything landed.
    expect(readFileSync(queuePath, "utf8")).toBe("");

    // A crash mid-drain leaves the file intact; replaying it must be a no-op.
    enqueueSentinelRun(report());
    expect(await drainSentinelQueue(pg, queuePath)).toEqual({
      applied: 0,
      alreadyPresent: 1,
      malformed: 0,
    });
    const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from sentinel_run`);
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("drains nothing, loudly, from an empty outbox", async () => {
    const pg = await open();
    expect(await drainSentinelQueue(pg, queuePath)).toEqual({
      applied: 0,
      alreadyPresent: 0,
      malformed: 0,
    });
  });
});

describe("the certification join", () => {
  it("returns the NEWEST verdict over exactly this manifest hash", async () => {
    const pg = await open();
    enqueueSentinelRun(report({ ranAt: "2026-09-01T06:00:00.000Z", verdict: "violation" }));
    enqueueSentinelRun(report({ ranAt: "2026-09-04T06:00:00.000Z", verdict: "ok" }));
    await drainSentinelQueue(pg, queuePath);
    const cert = await readNewestCertification(pg, "abc12345");
    expect(cert).toMatchObject({ verdict: "ok", ranAt: "2026-09-04T06:00:00.000Z" });
  });

  it("returns null for a hash nobody audited — never the nearest run", async () => {
    const pg = await open();
    enqueueSentinelRun(report());
    await drainSentinelQueue(pg, queuePath);
    expect(await readNewestCertification(pg, "abc1234")).toBeNull(); // a PREFIX, not the hash
    expect(await readNewestCertification(pg, "deadbeef")).toBeNull();
  });

  it("counts how many invariants held, from the report it stored", async () => {
    const pg = await open();
    const full = {
      ...report(),
      checks: [{ status: "ok" }, { status: "ok" }, { status: "unevaluable" }],
    };
    enqueueSentinelRun(full);
    await drainSentinelQueue(pg, queuePath);
    const cert = await readNewestCertification(pg, "abc12345");
    // 2 of 3 — "not evaluated" is never folded into a pass count.
    expect(cert).toMatchObject({ checksHeld: 2, checksTotal: 3 });
  });

  it("a report that carried no checks yields null counts, not zero", async () => {
    const pg = await open();
    enqueueSentinelRun(report({ manifestHash: "nochecks" }));
    await drainSentinelQueue(pg, queuePath);
    const cert = await readNewestCertification(pg, "nochecks");
    expect(cert).toMatchObject({ checksHeld: null, checksTotal: null });
  });
});
