import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the money triage scripts (scan-sweep 2026-09-07). The scripts run
 * against a PGlite copy and cannot be unit-tested without one; what CAN be pinned is that they
 * read through the shared definitions the rest of the repo already has - the cap, the id
 * parser, the period parser - instead of carrying copies that drift. */

const src = (f: string) => readFileSync(`scripts/case-loops/money/${f}`, "utf8");

const LIVE = [
  "triage.ts",
  "agrofert-sweep.ts",
  "dataor-corroborate.ts",
  "indirect-ownership-breadth2.ts",
  "indirect-ownership-exposure.ts",
  "kiosek-watch.ts",
  "reachable-metric-audit.ts",
  "supplies-coverage-audit.ts",
  "contract-corpus-snapshot.ts",
  "validate-payloads.ts",
];

describe("every whole-relation read uses KG_READ_CAP (lib/db/readCap.ts)", () => {
  /* Until 2026-09-07 triage.ts and both indirect-ownership passes read contracts and supplies
   * at `limit: 100_000` against a corpus of 152 702 contract nodes / 153 634 supplies edges
   * (batch 012) - an ORDERED read, so every late-sorting company lost all of its contracts
   * silently, exactly the failure readCap.ts's own header describes. */
  it.each(LIVE)("%s carries no literal limit", (f) => {
    expect(src(f)).not.toMatch(/limit:\s*\d[\d_]*/);
  });
  it.each(LIVE.filter((f) => f !== "agrofert-sweep.ts"))("%s imports the shared cap", (f) => {
    expect(src(f)).toMatch(/import \{ KG_READ_CAP \} from "@\/lib\/db\/readCap"/);
  });
});

describe("triage.ts reads its helpers from the shared modules its own header names", () => {
  it("period parsing and the near-threshold rule come from features/money/reviewTypes", () => {
    const s = src("triage.ts");
    expect(s).toMatch(/import \{[^}]*\bparsePeriod\b[^}]*\} from "@\/features\/money\/reviewTypes"/);
    expect(s).toMatch(/import \{[^}]*\bnearThresholdCount\b[^}]*\} from "@\/features\/money\/reviewTypes"/);
    expect(s).not.toMatch(/^function parsePeriod\b/m);
    expect(s).not.toMatch(/^const NEAR_THRESHOLDS\b/m);
  });
  it("the shared parsePeriod accepts the hyphen the triage copy rejected", async () => {
    // The copy matched only an en-dash between the dates; the shared parser matches both, so a
    // provenance string written with "-" parsed in the app and read as "no period" in triage.
    const { parsePeriod } = await import("@/features/money/reviewTypes");
    expect(parsePeriod("hlidac:osoby/x · 2015-03-01-ongoing")).toEqual({ from: "2015-03-01", to: null });
    expect(parsePeriod("hlidac:osoby/x · 2013-06-10–2017-02-02")).toEqual({ from: "2013-06-10", to: "2017-02-02" });
  });
  it.each(["triage.ts", "dataor-corroborate.ts"])("%s takes pspIdFromNodeId from lib/ingest/changeEvents", (f) => {
    const s = src(f);
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/^function pspIdFromNodeId\b/m);
  });
});

describe("triage.ts keeps the review-state vocabulary", () => {
  it("a stored `rejected` state is written to the ledger as rejected, not as pending_review", () => {
    const s = src("triage.ts");
    expect(s).toMatch(/satisfies readonly ReviewState\[\]/);
    expect(s).not.toMatch(/rawState === "verified" \? "verified" : "pending_review"/);
  });
});

describe("reachable-metric-audit.ts publishes what it measures", () => {
  it("topNonAttributable is computed, not an always-empty slice", () => {
    const s = src("reachable-metric-audit.ts");
    expect(s).not.toMatch(/\.slice\(0, 0\)/);
    expect(s).toMatch(/topNonAttributable:/);
    expect(s).toMatch(/czkByCompany/);
  });
});
