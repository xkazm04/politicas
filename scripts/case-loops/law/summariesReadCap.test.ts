// build-bill-summaries.ts runs main() on import, so the instrument is the text
// (2026-09-09, scan-sweep law-triage-batch, parity-auditor).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("build-bill-summaries reads bill nodes under KG_READ_CAP", () => {
  it("imports the repo's read cap instead of the literal 100_000", () => {
    // lib/db/readCap.ts names the literal cap as the class of bug it ends; 141 bills fit
    // under 100 000 today, and "fits today" is how every silently truncated read began.
    const src = readFileSync("scripts/case-loops/law/build-bill-summaries.ts", "utf8");
    expect(src).toMatch(/import \{ KG_READ_CAP \} from "@\/lib\/db\/readCap"/);
    expect(src).toMatch(/limit: KG_READ_CAP/);
    expect(src).not.toMatch(/limit: 100_000/);
  });
});
