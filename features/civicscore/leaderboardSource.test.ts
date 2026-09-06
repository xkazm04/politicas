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
