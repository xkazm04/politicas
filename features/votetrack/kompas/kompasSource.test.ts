import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the kompas (scan-sweep 2026-09-07, votetrack-kompas). */

const src = (p: string) => readFileSync(p, "utf8");

describe("getKompas reads the MP's club as of the Prague day", () => {
  it("imports pragueDay and holds no UTC slice", () => {
    const s = src("features/votetrack/getKompas.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});
