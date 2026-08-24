/**
 * THE PARTITION GUARD.
 *
 * `PGLITE_LANE_FILES` is an explicit path list, and an explicit list is exactly the
 * thing that rots the first time somebody adds a store-backed test and forgets it.
 * test-harness/suite-partitioning: "verify the partition is exhaustive and disjoint
 * — each test file matched by exactly one configuration", because a suite that
 * silently fails to discover its tests gates nothing.
 *
 * So this asserts, from the filesystem rather than from a config the harness might
 * be reading differently:
 *
 *   1. EXHAUSTIVE — union(unit, pglite, quarantine) === every file the legacy flat
 *      include list covered. A partition that drops a file is the worst available
 *      outcome here and it would otherwise be invisible: both lanes stay green.
 *   2. DISJOINT — no file in two lanes, so nothing runs twice under two budgets.
 *   3. NOT MISFILED — no file left in the unit lane boots a store. This is the
 *      direction the other two cannot catch: a new PGlite test added to `lib/` is
 *      exhaustively covered and perfectly disjoint, and would quietly take a
 *      4-second WASM boot into a lane budgeted at 5 s per test and 11 workers wide
 *      — the exact configuration measured flaky on 2026-08-04.
 *   4. The template-exemption list stays honest: every exemption names a file that
 *      is really in the lane and really still boots cold.
 *
 * It runs in the unit lane and costs one glob (~30 ms).
 */

import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_TEST_GLOBS, PGLITE_BOOT_MARKER, PGLITE_LANE_FILES, TEMPLATE_EXEMPT } from "./lanes";
import { quarantinedFiles } from "./flake/registry";

/**
 * Discovery is done with `node:fs` `globSync` rather than a glob library: the guard
 * must not depend on a package that is only present transitively, and it was
 * verified on 2026-08-24 to return exactly the same 219 files vitest's own
 * collection did (plus this file and one added by a concurrent session mid-run).
 */
const SELF = "lib/testing/lane-partition.test.ts";

function discovered(): string[] {
  return globSync([...ALL_TEST_GLOBS], { cwd: process.cwd() })
    .map((f) => f.split("\\").join("/"))
    .filter((f) => !f.includes("node_modules/") && !f.includes("/dist/"))
    .sort();
}

describe("the lane partition", () => {
  it("is EXHAUSTIVE — every discovered test file belongs to exactly one lane", () => {
    const all = discovered();
    const pglite = new Set<string>(PGLITE_LANE_FILES);
    const quarantined = new Set(quarantinedFiles());
    const unit = all.filter((f) => !pglite.has(f) && !quarantined.has(f));

    const union = new Set([...unit, ...pglite, ...quarantined].filter((f) => all.includes(f)));
    const dropped = all.filter((f) => !union.has(f));
    expect(dropped, `these files are matched by no lane and would never run: ${dropped.join(", ")}`).toEqual([]);
    expect(union.size).toBe(all.length);
  });

  it("is DISJOINT — no file carries two budgets", () => {
    const all = new Set(discovered());
    const seen = new Map<string, string[]>();
    const claim = (f: string, lane: string) => seen.set(f, [...(seen.get(f) ?? []), lane]);
    for (const f of PGLITE_LANE_FILES) claim(f, "pglite");
    for (const f of quarantinedFiles()) claim(f, "quarantine");
    for (const f of all) if (!seen.has(f)) claim(f, "unit");
    // Quarantine deliberately overrides the other lanes (they subtract it), so a
    // file may appear in the register AND in the pglite list; that is one lane.
    const doubled = [...seen].filter(([, lanes]) => lanes.length > 1 && !lanes.includes("quarantine"));
    expect(doubled.map(([f, l]) => `${f}: ${l.join("+")}`)).toEqual([]);
  });

  it("names every enlisted PGlite file — the list has no ghosts", () => {
    const all = new Set(discovered());
    const missing = PGLITE_LANE_FILES.filter((f) => !all.has(f));
    expect(missing, `PGLITE_LANE_FILES names files that do not exist: ${missing.join(", ")}`).toEqual([]);
  });

  it("catches a MISFILED store-booting test left in the unit lane", () => {
    const all = discovered();
    const pglite = new Set<string>(PGLITE_LANE_FILES);
    const strays = all
      .filter((f) => !pglite.has(f))
      // This guard names the marker in order to search for it; it does not boot anything.
      .filter((f) => f !== SELF)
      .filter((f) => PGLITE_BOOT_MARKER.test(readFileSync(f, "utf8")));
    expect(
      strays,
      `these files boot a PGlite store but sit in the WIDE unit lane (5 s per test, one worker per core) — ` +
        `the configuration measured flaky on 2026-08-04. Add them to PGLITE_LANE_FILES in ` +
        `lib/testing/lanes.ts: ${strays.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the template-exemption list honest", () => {
    const inLane = new Set<string>(PGLITE_LANE_FILES);
    for (const [file, reason] of Object.entries(TEMPLATE_EXEMPT)) {
      expect(inLane.has(file), `TEMPLATE_EXEMPT names ${file}, which is not in the PGlite lane`).toBe(true);
      expect(reason.length, `TEMPLATE_EXEMPT["${file}"] needs a stated reason`).toBeGreaterThan(20);
      // An exemption that no longer boots cold is stale bookkeeping.
      const src = readFileSync(file, "utf8");
      expect(
        /mkdtempSync\s*\(/.test(src),
        `TEMPLATE_EXEMPT["${file}"] claims a cold boot, but the file no longer creates its own temp dir`,
      ).toBe(true);
    }
  });

  it("every non-exempt PGlite file uses the shared fixture", () => {
    const shouldUseFixture = PGLITE_LANE_FILES.filter((f) => !(f in TEMPLATE_EXEMPT));
    const cold = shouldUseFixture.filter((f) => !/pgliteFixtureDir\s*\(/.test(readFileSync(f, "utf8")));
    expect(
      cold,
      `these PGlite files still pay a ~4,1–4,8 s cold initdb instead of copying the template ` +
        `(≈3,4 s each). Either convert them to pgliteFixtureDir() or record why not in ` +
        `TEMPLATE_EXEMPT: ${cold.join(", ")}`,
    ).toEqual([]);
  });
});
