// The effort loop's scripts must READ the shared rules, never re-declare them: the
// loop's own history (batch 005/006/010) is three forks of a shared rule that
// diverged and shipped a defect. Source grep — the scripts run main() on import,
// so their text is the instrument (vzor features/civicscore/formattedNumbers.test.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(`scripts/case-loops/effort/${f}`, "utf8");

describe("gate.ts reads the low-score vocabulary from lib/analysis (2026-09-06, parity-auditor)", () => {
  it("has no local copy of the twelve reasons and validates through isLowScoreReason", () => {
    const src = read("gate.ts");
    expect(src).not.toMatch(/const LOW_SCORE_REASONS = new Set\(/);
    expect(src).toMatch(/import \{ isLowScoreReason \} from "@\/lib\/analysis\/low-score-reason"/);
    expect(src).toMatch(/!isLowScoreReason\(reason\)/);
  });
});
