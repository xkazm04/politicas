import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the evidence bulletin's loader (scan-sweep 2026-09-08, civic-chronicle). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the bulletin loader reads bill ids through the one bill-id codec", () => {
  it("getDukazyData imports tiskIdFromBillNodeId and keeps no `|| 0` fallback", () => {
    const s = src("features/dukazy/getDukazyData.ts");
    expect(s).toMatch(/import \{ tiskIdFromBillNodeId \} from "@\/features\/lawwatch\/billRef"/);
    expect(s).not.toMatch(/\|\| 0/);
    expect(s).not.toMatch(/\?\? "low"/);
  });
});
