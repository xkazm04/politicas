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

describe("useNews does not keep a refused (non-2xx) response in its TTL cache", () => {
  it("evicts the query on !res.ok exactly as it does on a thrown failure", () => {
    const s = src("features/schranka/useNews.ts");
    const then = /\.then\(async \(res\) => \{[\s\S]*?\}\)/.exec(s)?.[0] ?? "";
    expect(then).toMatch(/if \(!res\.ok\) \{[\s\S]*cache\.delete\(query\);[\s\S]*return null;/);
  });
});
