/**
 * The detector, exercised over synthetic history.
 *
 * The point of these cases is the DISTINCTION test-harness/flake-lifecycle makes
 * and that a raw failure rate cannot: a consistently failing test is BROKEN, not
 * flaky, and the two need opposite responses. A transition count separates them —
 * FFFF scores zero, PFPF scores three — and this file pins that behaviour along
 * with the two refusals that keep the instrument honest: it will not compute a rate
 * over a dirty tree, and it will not compute one over too few runs.
 */

import { describe, expect, it } from "vitest";

import { detect } from "./detect";
import type { RunRecord } from "./history";

const run = (head: string, at: string, tests: Record<string, "passed" | "failed">, dirty = false): RunRecord => ({
  at,
  head,
  dirty,
  lane: "unit",
  tests: Object.fromEntries(Object.entries(tests).map(([k, s]) => [k, { s, d: 1 }])),
});

const H = "a".repeat(40);

describe("the transition detector", () => {
  it("refuses a verdict when every run was on a dirty tree", () => {
    const r = detect([
      run(H, "2026-08-24T01:00:00Z", { "a.test.ts > x": "passed" }, true),
      run(H, "2026-08-24T02:00:00Z", { "a.test.ts > x": "failed" }, true),
    ]);
    expect(r.candidates).toEqual([]);
    expect(r.reason).toContain("clean tree");
  });

  it("refuses a verdict on too few same-code runs, and says how few", () => {
    const r = detect([
      run(H, "2026-08-24T01:00:00Z", { "a.test.ts > x": "passed" }),
      run(H, "2026-08-24T02:00:00Z", { "a.test.ts > x": "failed" }),
    ]);
    expect(r.comparable).toBe(2);
    expect(r.reason).toContain("2 run(s)");
    expect(r.candidates).toEqual([]);
  });

  it("does NOT compare across different HEADs — that measures the product, not the test", () => {
    const B = "b".repeat(40);
    const r = detect([
      run(H, "2026-08-24T01:00:00Z", { "a.test.ts > x": "passed" }),
      run(B, "2026-08-24T02:00:00Z", { "a.test.ts > x": "failed" }),
      run(H, "2026-08-24T03:00:00Z", { "a.test.ts > x": "passed" }),
      run(B, "2026-08-24T04:00:00Z", { "a.test.ts > x": "failed" }),
    ]);
    // The largest same-code window is 2, not 4 — so no verdict, rather than a
    // fabricated "changed outcome 3 times".
    expect(r.comparable).toBe(2);
    expect(r.candidates).toEqual([]);
  });

  it("scores a FLAKY test by its outcome transitions", () => {
    const r = detect([
      run(H, "2026-08-24T01:00:00Z", { "a.test.ts > flaky": "passed" }),
      run(H, "2026-08-24T02:00:00Z", { "a.test.ts > flaky": "failed" }),
      run(H, "2026-08-24T03:00:00Z", { "a.test.ts > flaky": "passed" }),
      run(H, "2026-08-24T04:00:00Z", { "a.test.ts > flaky": "failed" }),
    ]);
    expect(r.comparable).toBe(4);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ key: "a.test.ts > flaky", transitions: 3, runs: 4 });
    expect(r.candidates[0].outcomes).toBe("PFPF");
  });

  it("does NOT flag a consistently failing test — that one is BROKEN, not flaky", () => {
    const r = detect([
      run(H, "2026-08-24T01:00:00Z", { "a.test.ts > broken": "failed" }),
      run(H, "2026-08-24T02:00:00Z", { "a.test.ts > broken": "failed" }),
      run(H, "2026-08-24T03:00:00Z", { "a.test.ts > broken": "failed" }),
      run(H, "2026-08-24T04:00:00Z", { "a.test.ts > broken": "failed" }),
    ]);
    expect(r.comparable).toBe(4);
    expect(r.candidates).toEqual([]);
  });

  it("ranks the most unstable test first", () => {
    const runs = ["passed", "failed", "passed", "failed", "passed"].map((s, i) =>
      run(H, `2026-08-24T0${i}:00:00Z`, {
        "a.test.ts > veryFlaky": s as "passed",
        "b.test.ts > slightlyFlaky": i === 2 ? "failed" : "passed",
        "c.test.ts > stable": "passed",
      }),
    );
    const r = detect(runs);
    expect(r.candidates.map((c) => c.key)).toEqual(["a.test.ts > veryFlaky", "b.test.ts > slightlyFlaky"]);
    expect(r.candidates[0].transitions).toBe(4);
    expect(r.candidates[1].transitions).toBe(2);
  });
});
