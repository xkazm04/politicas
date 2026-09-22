import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { batchFromSourceFile, PRIOR_PAIRS_BATCH, sourceMethodCs } from "./collisionBatch";

/* Which batch produced a close-read used to be looked up by PAIR ID through a ladder of
 * per-file id sets — but pair ids are NOT unique across payloads (the loader's own comment on
 * the Czech-rewrite key says so). Measured 2026-09-07 over the payload directory: 18 pair ids
 * occur in more than one file, and four rendered pairs carried the wrong batch badge and the
 * wrong method sentence (102-111 and 7-221 from batch 008 read as batch 009, 85-88 and 4-121
 * from batch 004 read as 009 and 005). The batch is a property of the ROW's file. */

describe("batchFromSourceFile", () => {
  it.each([
    ["collision-close-reads.json", 3],
    ["collision-close-reads-batch004.json", 4],
    ["collision-close-reads-batch005.json", 5],
    ["collision-close-reads-batch008.json", 8],
    ["collision-close-reads-batch009.json", 9],
    ["collision-close-reads-batch011-gA.json", 11],
    ["collision-close-reads-batch015-gB.json", 15],
  ])("%s → batch %i", (file, batch) => {
    expect(batchFromSourceFile(file)).toBe(batch);
  });

  it("refuses a file it cannot date rather than guessing", () => {
    expect(batchFromSourceFile("collision-close-reads-group1.json")).toBeNull();
    expect(batchFromSourceFile("something-else.json")).toBeNull();
  });

  it("the prior (narrated) pairs are batch 2, and every batch has a method sentence", () => {
    expect(PRIOR_PAIRS_BATCH).toBe(2);
    for (const b of [2, 3, 4, 5, 8, 9, 11, 12, 13, 14, 15]) expect(sourceMethodCs(b).length).toBeGreaterThan(20);
  });
});

describe("the real payloads: a pair id shared by two files gets two batches", () => {
  const dir = "docs/data-analysis/case-law/payloads";
  const files = readdirSync(dir).filter((f) => /^collision-close-reads(-batch\d+(-g[AB])?)?\.json$/.test(f));
  it("the directory carries the files the loader reads, and pair ids do repeat", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    const byId = new Map<string, Set<number>>();
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as { pairs?: { pairId: string }[] };
      const batch = batchFromSourceFile(f);
      expect(batch, f).not.toBeNull();
      for (const p of raw.pairs ?? []) byId.set(p.pairId, new Set([...(byId.get(p.pairId) ?? []), batch!]));
    }
    const shared = [...byId.entries()].filter(([, s]) => s.size > 1);
    // the measured defect: these ids exist in two batches and must not collapse to one
    expect(shared.length).toBeGreaterThanOrEqual(4);
    expect(byId.get("4-121")).toEqual(new Set([4, 5]));
    expect(byId.get("102-111")).toEqual(new Set([8, 9]));
  });
});

describe("getCollisionData.ts reads the batch from the row, not from a pair-id ladder", () => {
  const src = readFileSync("features/lawwatch/getCollisionData.ts", "utf8");
  it("imports collisionBatch and carries no per-batch id sets", () => {
    expect(src).toMatch(/from "\.\/collisionBatch"/);
    expect(src).not.toMatch(/batch\d+Ids/);
    expect(src).not.toMatch(/sourceBatchOf\(/);
  });
});
