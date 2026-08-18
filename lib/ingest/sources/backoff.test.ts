import { describe, expect, it } from "vitest";
import { backoffCeilingMs, backoffDelayMs } from "./backoff";

/* Probe for `backoff-without-jitter` (bound-the-blast-radius). A plain
 * min(cap, base*2**attempt) backoff retries in lockstep, so colliding callers
 * re-collide at every identical delay. Full jitter samples uniformly from
 * [0, ceiling], de-synchronising them. */

describe("backoffCeilingMs", () => {
  it("grows exponentially then clamps at the cap", () => {
    expect(backoffCeilingMs(0, 500, 15_000)).toBe(500);
    expect(backoffCeilingMs(1, 500, 15_000)).toBe(1000);
    expect(backoffCeilingMs(3, 500, 15_000)).toBe(4000);
    expect(backoffCeilingMs(10, 500, 15_000)).toBe(15_000); // clamped
  });
});

describe("backoffDelayMs (full jitter)", () => {
  it("scales the ceiling by the random draw — NOT a fixed delay", () => {
    // the defect: without jitter attempt 3 always returns exactly 4000. With
    // full jitter, a draw of 0.5 must halve it.
    expect(backoffDelayMs(3, 500, 15_000, () => 0.5)).toBe(2000);
    expect(backoffDelayMs(3, 500, 15_000, () => 0)).toBe(0);
    expect(backoffDelayMs(3, 500, 15_000, () => 1)).toBe(4000);
  });

  it("stays within [0, ceiling] across the random range", () => {
    for (const r of [0, 0.13, 0.5, 0.87, 0.999]) {
      const d = backoffDelayMs(5, 400, 8_000, () => r);
      const ceiling = backoffCeilingMs(5, 400, 8_000);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(ceiling);
    }
  });

  it("two callers with distinct draws get distinct delays (de-synchronised)", () => {
    const a = backoffDelayMs(2, 500, 4_000, () => 0.2);
    const b = backoffDelayMs(2, 500, 4_000, () => 0.9);
    expect(a).not.toBe(b);
  });
});
