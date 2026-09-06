import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the leaderboard's own files (scan-sweep 2026-09-08, civicscore-leaderboard). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the chamber pass reads the person id with the tree's strict parser", () => {
  it("getLeaderboardData imports pspIdFromNodeId and keeps no split-pop parse", () => {
    const s = src("features/civicscore/getLeaderboardData.ts");
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/Number\(p\.id\.split\(":"\)\.pop\(\)\)/);
  });
});

describe("every count the table and histogram render goes through lib/format", () => {
  it("LeaderboardTable prints club seats, filter counts and the shown/total pair through f.int", () => {
    const s = src("features/civicscore/components/LeaderboardTable.tsx");
    expect(s).not.toMatch(/· \{c\.seats\}/);
    expect(s).not.toMatch(/· \{workhorseCounts\[flav\]\}/);
    expect(s).not.toMatch(/· \{dossierCount\}/);
    expect(s).not.toMatch(/count: rows\.length, total: entries\.length/);
    expect(s).toMatch(/count: f\.int\(rows\.length\), total: f\.int\(entries\.length\)/);
  });
  it("ScoreHistogram hands the tooltip count to the catalog already formatted", () => {
    const s = src("features/civicscore/components/ScoreHistogram.tsx");
    expect(s).not.toMatch(/value: Number\(value\)/);
    expect(s).toMatch(/value: f\.int\(Number\(value\)\)/);
  });
});

describe("the table's per-component median is lib/analysis/score-legibility's, not a second copy", () => {
  it("LeaderboardTable imports median and spells no sort-and-pick of its own", () => {
    const s = src("features/civicscore/components/LeaderboardTable.tsx");
    expect(s).toMatch(/import \{ median \} from "@\/lib\/analysis\/score-legibility"/);
    expect(s).not.toMatch(/vals\[n \/ 2 - 1\]/);
  });
});
