import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the contract-ingest scripts (scan-sweep 2026-09-07, money-contract-
 * ingest). They run against a PGlite copy or the live registries and cannot be unit-tested
 * here; what CAN be pinned is that they read through the repo's shared definitions - the cap,
 * the id and period parsers, ONE ARES-VR matcher, ONE retry rule - instead of copies that drift. */

const src = (f: string) => readFileSync(`scripts/case-loops/${f}`, "utf8");

const LIVE = [
  "money/harvest-contract-dumps.ts",
  "money/persist-contract-harvest.ts",
  "money/canonicalize-ico-nodes.ts",
  "money/company-contract-sweep.ts",
  "money/parent-contract-sweep.ts",
  "money/reconcile-ares-vr.ts",
  "money/reverify-open-vs-live-ares-vr.ts",
  "money/prak-repoint.ts",
  "money/purge-osvc.ts",
  "money/migrate-review-audit-check.ts",
  "sources/kiosek-slice.ts",
  "sources/kiosek-build-payload.ts",
  "sources/kiosek-validate.ts",
];
const GRAPH_READERS = [
  "money/harvest-contract-dumps.ts",
  "money/persist-contract-harvest.ts",
  "money/canonicalize-ico-nodes.ts",
  "money/parent-contract-sweep.ts",
  "money/reconcile-ares-vr.ts",
  "money/reverify-open-vs-live-ares-vr.ts",
  "money/prak-repoint.ts",
  "money/purge-osvc.ts",
];

describe("every whole-relation read uses KG_READ_CAP (lib/db/readCap.ts)", () => {
  /* reconcile-ares-vr.ts - the MAIN writer of tie_class / temporal_status - read contracts and
   * supplies at `limit: 100_000` against 152 702 contract nodes / 153 634 supplies edges
   * (batch 012), so late-sorting companies had no money and their ties were classified
   * "historical-no-money". parent-contract-sweep.ts built its "never queried" population from
   * the same truncated supplies read. */
  it.each(LIVE)("%s carries no literal limit", (f) => {
    expect(src(f)).not.toMatch(/limit:\s*\d[\d_]*/);
  });
  it.each(GRAPH_READERS)("%s imports the shared cap", (f) => {
    expect(src(f)).toMatch(/import \{ KG_READ_CAP \} from "@\/lib\/db\/readCap"/);
  });
});

describe("the ARES-VR scripts read their parsers from the shared modules", () => {
  it.each(["money/reconcile-ares-vr.ts", "money/reverify-open-vs-live-ares-vr.ts"])("%s imports pspIdFromNodeId", (f) => {
    const s = src(f);
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/function pspIdFromNodeId/);
  });
  it("reconcile-ares-vr.ts takes parsePeriod from features/money/reviewTypes (hyphen AND en-dash)", () => {
    const s = src("money/reconcile-ares-vr.ts");
    expect(s).toMatch(/import \{[^}]*\bparsePeriod\b[^}]*\} from "@\/features\/money\/reviewTypes"/);
    expect(s).not.toMatch(/function parsePeriod/);
  });
});

describe("ONE ARES-VR matcher (aresVrMatch.ts) for both reconciliation scripts", () => {
  it.each(["money/reconcile-ares-vr.ts", "money/reverify-open-vs-live-ares-vr.ts"])("%s imports it and carries no copy", (f) => {
    const s = src(f);
    expect(s).toMatch(/from "\.\/aresVrMatch"/);
    expect(s).not.toMatch(/function findMatches/);
    expect(s).not.toMatch(/interface VrZaznam/);
  });
});

describe("ONE retry rule for the Registr smluv sweeps (smlouvyRetry.ts)", () => {
  it.each(["money/company-contract-sweep.ts", "money/parent-contract-sweep.ts"])("%s imports withBackoff and carries no copy", (f) => {
    const s = src(f);
    expect(s).toMatch(/import \{ withBackoff \} from "\.\/smlouvyRetry"/);
    expect(s).not.toMatch(/async function withBackoff/);
    expect(s).not.toMatch(/includes\("429"\)/);
  });
});

describe("parent-contract-sweep.ts: a failed query is an UNMEASURED parent, never a zero", () => {
  it("records contracts: null on the error row (the company sweep already does)", () => {
    const s = src("money/parent-contract-sweep.ts");
    expect(s).toMatch(/contracts: number \| null;/);
    expect(s).toMatch(/contracts: null, truncated: false/);
    expect(s).not.toMatch(/contracts: 0, truncated: false/);
  });
});
