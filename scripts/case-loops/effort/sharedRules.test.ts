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

describe("the loop imports the formula's saturation caps and the tenure vocabulary (2026-09-06, parity-auditor)", () => {
  it("triage.ts takes the three caps from lib/analysis/contribution, not from three literals", () => {
    const src = read("triage.ts");
    expect(src).not.toMatch(/COMMITTEE_SAT = 3/);
    expect(src).toMatch(/import \{ COMMITTEE_SATURATION, LEGISLATIVE_SATURATION, SPEECH_SATURATION \} from "@\/lib\/analysis\/contribution"/);
  });

  it("triage.ts, tenure.ts and extract-dossiers.ts spell the tenure class through TenureClass, not a hand-typed union", () => {
    for (const f of ["triage.ts", "tenure.ts", "extract-dossiers.ts"]) {
      const src = read(f);
      expect(src, f).toMatch(/import type \{ TenureClass \} from "@\/lib\/analysis\/tenure-copy"/);
      expect(src, f).not.toMatch(/"full_term" \| "replacement" \| "departed" \| "never_seated"/);
    }
    // the two-class union extract-dossiers still carried was the batch-003 shape
    expect(read("extract-dossiers.ts")).not.toMatch(/tenureClass\?: "full_term" \| "replacement";/);
  });
});

describe("tenure days are measured to a stated reference date, not a date frozen in July (2026-09-06, bounty-hunter)", () => {
  it("tenure.ts and triage.ts take --reference=YYYY-MM-DD and default to today", () => {
    for (const f of ["tenure.ts", "triage.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/new Date\("2026-07-24T00:00:00\.000Z"\)/);
      expect(src, f).toMatch(/referenceDate\(\)/);
    }
    expect(read("shared-reference-date.ts")).toMatch(/--reference=/);
  });
});
