import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the spis loader and page (scan-sweep 2026-09-07, mp-profile).
 * getProfileData.ts is `server-only` and cannot be imported here; what CAN be pinned is that
 * it reads through the repo's shared definitions instead of copies. */

const src = (p: string) => readFileSync(p, "utf8");

describe("getProfileData.ts resolves an ally's id through the strict shared parser", () => {
  const s = src("features/profile/getProfileData.ts");
  it("imports pspIdFromNodeId and carries no last-segment Number() read", () => {
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/Number\(otherId\.split\(":"\)\.pop\(\)\)/);
  });
});

describe("getProfileData.ts evaluates the whole spis against ONE Prague day", () => {
  const s = src("features/profile/getProfileData.ts");
  it("seatsAsOf is pragueDay(instant) and no UTC slice remains", () => {
    expect(s).toMatch(/const seatsAsOf = pragueDay\(new Date\(asOfMs\)\)/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
  it("the absence record is drawn against the same day, not a second clock read", () => {
    expect(s).toMatch(/buildAbsenceRecord\(rows, seatsAsOf\)/);
    expect(s).not.toMatch(/buildAbsenceRecord\(rows, pragueDay\(\)\)/);
  });
});

describe("profileMoney.ts does not re-run the plausibility bound", () => {
  const s = src("features/profile/profileMoney.ts");
  it("reads dateWithheldOn and imports no plausible-date", () => {
    expect(s).toMatch(/c\.dateWithheldOn != null/);
    expect(s).not.toMatch(/plausibleIsoDateOrNull/);
  });
});
