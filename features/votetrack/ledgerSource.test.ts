import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the /hlasovani ledger (scan-sweep 2026-09-07, votetrack-ledger). */

const src = (p: string) => readFileSync(p, "utf8");

describe("every surface that prints a vote outcome reads record/outcome", () => {
  for (const f of ["RealVoteLedger.tsx", "RealChamberDetail.tsx", "VoteThemeFilter.tsx"]) {
    it(`${f} imports the shared vocabulary and carries no two-way outcome ternary`, () => {
      const s = src(`features/votetrack/components/${f}`);
      expect(s).toMatch(/from "\.\.\/record\/outcome"/);
      expect(s).not.toMatch(/=== "accepted" \? tcom\("voteResult\.accepted"\) : tcom\("voteResult\.rejected"\)/);
      expect(s).not.toMatch(/const KNOWN_RESULT/);
    });
  }
});

describe("the ledger's ratio bar draws absent MPs in a colour that exists on its track", () => {
  it("RatioBar paints the away segment bg-steel, never the bg-hairline of the track behind it", () => {
    const s = src("features/votetrack/components/RealVoteLedger.tsx");
    const bar = /function RatioBar[\s\S]*?\n\}/.exec(s)?.[0] ?? "";
    expect(bar).toMatch(/total\.away > 0 && <span className="h-full bg-steel"/);
    expect(bar).not.toMatch(/total\.away > 0 && <span className="h-full bg-hairline"/);
  });
});

describe("the record's published counts go through f.int like every other figure", () => {
  it("disciplineNote / ledgerFootnote / methodSource format valid, voided and window", () => {
    expect(src("features/votetrack/components/RealVoteTrack.tsx")).toMatch(
      /t\("record\.disciplineNote", \{ valid: f\.int\(record\.coverage\.valid\) \}\)/,
    );
    const board = src("features/votetrack/components/RealDisciplineBoard.tsx");
    expect(board).toMatch(/t\("record\.disciplineNote", \{ valid: f\.int\(data\.coverage\.valid\) \}\)/);
    expect(board).toMatch(/valid: f\.int\(data\.coverage\.valid\),\s*voided: f\.int\(data\.coverage\.voided\),/);
    expect(src("features/votetrack/components/RealVoteLedger.tsx")).toMatch(
      /t\("record\.ledgerFootnote", \{ window: f\.int\(ledgerWindow\), valid: f\.int\(validTotal\) \}\)/,
    );
  });
});
