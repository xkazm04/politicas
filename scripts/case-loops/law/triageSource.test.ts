import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* triage.ts is the batch-001 bootstrap that WRITES ledger.json wholesale. Every later batch
 * merge-writes (retriage-009 / update-ledger-011) precisely because a wholesale write erases
 * the accumulated totals.* blocks — the P44/D1 durability rule this case named for itself. The
 * bootstrap had no guard against being re-run over the live ledger, and its recorded
 * `triageFormula` string described weights (1e9 / 5e6 / 2e6 / 2.5e8) the code has not used
 * since the log-scaled bands were introduced. */

const src = readFileSync("scripts/case-loops/law/triage.ts", "utf8");

describe("build-bill-summaries.ts — one cache path", () => {
  it("imports CACHE_DIR from collision-core instead of spelling the path", () => {
    const s = readFileSync("scripts/case-loops/law/build-bill-summaries.ts", "utf8");
    expect(s).toMatch(/import \{ CACHE_DIR \} from "\.\/collision-core"/);
    expect(s).not.toMatch(/^const CACHE_DIR = /m);
  });
});

describe("triage.ts — the bootstrap protects the ledger it bootstraps", () => {
  it("refuses to overwrite an existing ledger.json unless --replace is passed", () => {
    expect(src).toMatch(/existsSync\(LEDGER_PATH\)/);
    expect(src).toMatch(/--replace/);
    expect(src).toMatch(/REFUSED/);
  });

  it("scores and records the formula from ONE set of band constants", () => {
    expect(src).toMatch(/const BANDS = \{/);
    expect(src).not.toMatch(/sev\*1e9/);
    // every band is read from BANDS both where the score is computed and where it is described
    for (const k of ["sev", "churn", "moneyLog", "amends", "route"]) {
      expect((src.match(new RegExp(`BANDS\\.${k}\\b`, "g")) ?? []).length, k).toBeGreaterThanOrEqual(2);
    }
  });
});
