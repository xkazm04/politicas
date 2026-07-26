import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// First direct test of a get*Data.ts loader (architect 2026-07-26,
// docs/architect/decisions/2026-07-26-loader-test-coverage.md). Lib-hosted
// because vitest's include glob covers lib/** only; the subject under test
// lives in features/ — same cross-boundary pattern as
// lib/db/pglite/repositories/review.test.ts.
//
// Isolated PGlite data dir — NEVER point at ./.pglite (the live directory).
// Set BEFORE importing anything that calls open(): pglitePath() reads
// process.env.PGLITE_PATH lazily but open() memoises on globalThis.
const dataDir = mkdtempSync(join(tmpdir(), "politicas-leaderboard-"));
process.env.PGLITE_PATH = dataDir;
// This test seeds 3 persons on purpose — bypass the cardinality-floor gate
// (lib/db/readiness.ts), which is exercised by its own test.
process.env.KG_READINESS_OFF = "1";

const { open } = await import("../db/pglite/internals");
const { getLeaderboardData, buildLeaderboard } = await import("../../features/civicscore/getLeaderboardData");

// Minimal person props the loader decomposes: stored score + the raw counters
// componentPoints() re-derives the six components from.
function personProps(score: number) {
  return {
    contribution_score: score,
    participation_rate: 0.9,
    absence_rate: 0.1,
    committee_count: 2,
    leadership_count: 1,
    bills_authored: 1,
    interpellations: 1,
    speech_turns: 10,
    contribution_provenance: { pass: 30 },
  };
}

describe("getLeaderboardData against a seeded store", () => {
  // 30s: the first test in the file pays the PGlite WASM boot, which contends
  // when several PGlite test files run in parallel workers.
  it("returns null while the graph holds no persons (empty ≠ crash)", { timeout: 30_000 }, async () => {
    // Runs BEFORE the seed below — PGlite creates an empty schema on open.
    expect(await getLeaderboardData()).toBeNull();
  });

  it("ranks by score desc with cs-locale name tiebreak and builds real aggregates", async () => {
    const pg = await open();
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ('psp:person:1', 'person', 'Beneš Bohumil', $1::jsonb, 1, '{}'::jsonb),
        ('psp:person:2', 'person', 'Adamec Alois', $2::jsonb, 1, '{}'::jsonb),
        ('psp:person:3', 'person', 'Cimrman Jára', $3::jsonb, 1, '{}'::jsonb)`,
      [
        JSON.stringify(personProps(72.3)),
        JSON.stringify(personProps(72.3)),
        JSON.stringify(personProps(55.5)),
      ],
    );

    const built = await buildLeaderboard();
    expect(built).not.toBeNull();
    const { data, directory } = built!;

    // Rank: 72.3 ties break by Czech collation — Adamec before Beneš.
    expect(data.entries.map((e) => [e.rank, e.name, e.score])).toEqual([
      [1, "Adamec Alois", 72.3],
      [2, "Beneš Bohumil", 72.3],
      [3, "Cimrman Jára", 55.5],
    ]);

    // No mandates seeded → no club can be claimed, never a fabricated one.
    expect(data.entries.every((e) => e.clubAbbrev === "—")).toBe(true);
    expect(data.clubs).toEqual([]);

    // Aggregates come from the real rows, not a mock.
    expect(data.summary.count).toBe(3);
    expect(data.summary.median).toBe(72.3);
    expect(data.provenancePass).toBe(30);

    // Histogram bands span the real score range in 5-pt steps: 55..75.
    expect(data.histogram[0].from).toBe(55);
    expect(data.histogram.at(-1)!.from).toBe(70);
    expect(data.histogram.reduce((s, h) => s + h.count, 0)).toBe(3);

    // The six components decompose to finite points for every entry.
    for (const e of data.entries) {
      for (const [key, pts] of Object.entries(e.components)) {
        expect(Number.isFinite(pts), `component ${key}`).toBe(true);
      }
    }

    expect(directory.nameByPspId.get(2)).toBe("Adamec Alois");
  });
});

afterAll(async () => {
  const pg = await open();
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});
