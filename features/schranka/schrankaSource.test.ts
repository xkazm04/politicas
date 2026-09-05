import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the schránka (scan-sweep 2026-09-07, schranka-notifications):
 * the parts that touch the request or the clock read through the repo's shared definitions. */

const src = (p: string) => readFileSync(p, "utf8");

describe("feedRequest.ts builds the request origin through lib/routing/liveUrl", () => {
  const s = src("features/schranka/feedRequest.ts");
  it("imports liveUrl and carries no host + x-forwarded-proto copy", () => {
    expect(s).toMatch(/import \{ liveUrl \} from "@\/lib\/routing\/liveUrl"/);
    expect(s).not.toMatch(/x-forwarded-proto/);
    expect(s).not.toMatch(/from "next\/headers"/);
  });
});

describe("the schránka reads its days on the Prague calendar, like the server's builtOn", () => {
  it("useToday derives today with pragueDay(), not a UTC slice", () => {
    const s = src("features/schranka/useToday.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
  it("visitWindow stamps the visit day with pragueDay(instant)", () => {
    const s = src("features/schranka/visitWindow.ts");
    expect(s).toMatch(/pragueDay\(new Date\(now\)\)/);
    expect(s).not.toMatch(/now\.slice\(0, 10\)/);
  });
  it("deriveDeltas.dayOf maps an instant to its Prague day", () => {
    const s = src("features/schranka/deriveDeltas.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
  });
});
