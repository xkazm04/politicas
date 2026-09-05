import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* /penize/firma/[ico] asserts a signature-plausibility bound against "today" and derived it
 * from the UTC clock. Prague is UTC+1/+2, so between midnight and 01:00/02:00 Prague the UTC
 * day is still yesterday and a contract signed today in Prague reads as signed in the future -
 * a data fault the page would print. features/denik/pragueDay.ts exists for exactly this
 * (the deník loader made the same UTC mistake). */

describe("/penize/firma/[ico] dates its plausibility bound in Prague", () => {
  const src = readFileSync("app/penize/firma/[ico]/page.tsx", "utf8");
  it("calls pragueDay() and no longer slices the UTC ISO string", () => {
    expect(src).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(src).toMatch(/const todayIso = pragueDay\(\)/);
    expect(src).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});
