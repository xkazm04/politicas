import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the velín's loader and exhibit (scan-sweep 2026-09-08, dashboard-instruments). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the velín's build day is the PRAGUE day", () => {
  it("getDashboardData stamps builtOn with pragueDay(), never the UTC day of toISOString()", () => {
    const s = src("features/dashboard/getDashboardData.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).toMatch(/const builtOn = pragueDay\(\)/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});
