import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the budget mirror's own files (scan-sweep 2026-09-08, budget-mirror). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the live tie layer reads the one review-state ladder", () => {
  it("getSupplierTies imports reviewStateOf and spells no ladder of its own", () => {
    const s = src("features/budget/getSupplierTies.ts");
    expect(s).toMatch(/import \{ reviewStateOf \} from "@\/features\/money\/reviewTypes"/);
    expect(s).not.toMatch(/=== "verified" \? "verified"/);
    expect(s).not.toMatch(/rawState === "rejected"/);
  });
});
