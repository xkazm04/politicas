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
