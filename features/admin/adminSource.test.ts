import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for /admin (scan-sweep 2026-09-07, admin-control, second sweep). */

const src = (p: string) => readFileSync(p, "utf8");

describe("getAdminData classifies a tie's review state through reviewStateOf", () => {
  it("imports reviewStateOf and spells no verified/rejected ladder of its own", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).toMatch(/reviewStateOf/);
    expect(s).not.toMatch(/rawState === "verified"\) verified\+\+/);
  });
});

describe("the admin loaders read at the one app cap, never an ad-hoc literal", () => {
  it("getTripwireData lists vote events at KG_READ_CAP", () => {
    const s = src("features/admin/getTripwireData.ts");
    expect(s).toMatch(/listVoteEvents\(\{ termCode: TERM, limit: KG_READ_CAP \}\)/);
    expect(s).not.toMatch(/limit: 100_000/);
  });
  it("getAdminData names its audit cap and warns when a read fills it", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).toMatch(/const AUDIT_READ_CAP = 10_000;/);
    expect(s).toMatch(/listReviewAudit\(\{ limit: AUDIT_READ_CAP \}\)/);
    expect(s).toMatch(/rows\.length >= AUDIT_READ_CAP/);
  });
});

describe("getAdminData never swallows a read failure without a trace", () => {
  it("every catch in the loader reports through reportLoaderFailure", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).not.toMatch(/\} catch \{/);
  });
});

describe("a forensic verdict without a stored severity is not filed under low", () => {
  it("getAdminData buckets a missing severity as neuvedeno, never as low", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).toMatch(/const sev = severity \?\? "neuvedeno";/);
    expect(s).not.toMatch(/severity \?\? "low"/);
  });
});

describe("every count on the review hub and the progress tile goes through czechInt", () => {
  it("ReviewHubSection prints bySeverity / byDecision / byReviewer counts formatted", () => {
    const s = src("features/admin/components/ReviewHubSection.tsx");
    expect(s).not.toMatch(/\{sev\} · \{n\}/);
    expect(s).not.toMatch(/\{d\} · \{n\}/);
    expect(s).not.toMatch(/\{r\} · \{n\}/);
    expect(s.match(/· \{czechInt\(n\)\}/g)?.length).toBe(3);
  });
  it("LoopProgressGrid prints the batch number formatted", () => {
    expect(src("features/admin/components/LoopProgressGrid.tsx")).toMatch(/`dávka \$\{czechInt\(p\.batchesCompleted\)\}`/);
  });
});

describe("LoopMissionControl dates ISO instants on the Prague day", () => {
  it("every czechDate over an instant goes through a Prague-day helper; STALENESS_CLS is closed", () => {
    const s = src("features/admin/components/LoopMissionControl.tsx");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).toMatch(/const dayCs = /);
    expect(s).not.toMatch(/czechDate\((loop|item|alert)\./);
    expect(s).toMatch(/satisfies Record<LoopStaleness, string>/);
  });
});
