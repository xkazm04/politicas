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
