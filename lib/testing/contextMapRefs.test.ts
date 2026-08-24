/*
 * DRIFT CHECK FOR A GENERATED ARTIFACT: context-map.json must not name files
 * that do not exist.
 *
 * `context-map.json` (48 contexts, 10 groups, ~915 path-shaped refs) is written
 * by an EXTERNAL scanner. Nothing in this repo verified it afterwards — and the
 * 2026-08-24 registry audit found 65 stale refs by hand, 61 of them pointing at
 * pre-`archive/` locations of scripts that had moved and 4 at files that were
 * genuinely deleted. A generated artifact nobody checks is a document that
 * decays silently: every reader who trusts it (an agent picking files to read,
 * a human orienting in an unfamiliar area) is sent to a path that is not there,
 * and concludes the tree is wrong rather than the map.
 *
 * Direction of the check, deliberately ONE-WAY: every path the map NAMES must
 * exist. The reverse — every file in the tree appearing in the map — is the
 * GENERATOR's coverage claim, not this test's; a file added between two rescans
 * is normal and asserting on it would make this fail for a reason nobody can
 * fix here. Naming a file that is gone is never normal.
 *
 * Gate liveness: the walk asserts its own denominator before asserting the
 * finding. A refactor of the map's shape that makes the walk enumerate nothing
 * would otherwise pass as "0 dangling refs" — the classic empty-success, where
 * "I found nothing wrong" and "I could not look" print identically.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import contextMap from "../../context-map.json";

/** A string that is shaped like a repo-relative source path. Deliberately
 *  narrow: the map also carries prose, table names and API surfaces, and
 *  treating those as paths would manufacture dangling refs out of sentences. */
const PATH_SHAPED = /^[\w.@-]+(\/[\w.@ -]+)*\.(ts|tsx|mjs|cjs|json|css|md|sql)$/;

/** The refs enumerated by the audit that motivated this test. If the walk ever
 *  collects far fewer than this, it has stopped seeing the map, not the map's
 *  refs. */
const MIN_EXPECTED_REFS = 700;

const ROOT = join(import.meta.dirname, "..", "..");

function collectRefs(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectRefs(v, out);
    return;
  }
  if (typeof value === "string" && PATH_SHAPED.test(value)) out.add(value);
}

describe("context-map.json — a generated map may not name files that are gone", () => {
  const refs = new Set<string>();
  collectRefs(contextMap, refs);

  it("enumerates a plausible number of path refs (the walk still sees the map)", () => {
    expect(refs.size).toBeGreaterThanOrEqual(MIN_EXPECTED_REFS);
  });

  it("every named path resolves on disk", () => {
    const dangling = [...refs].filter((p) => !existsSync(join(ROOT, p))).sort();
    // The message carries the denominator: a reader of a failure should see
    // what the number was measured over, not just the numerator.
    expect(dangling, `${dangling.length} dangling of ${refs.size} path refs`).toEqual([]);
  });
});
