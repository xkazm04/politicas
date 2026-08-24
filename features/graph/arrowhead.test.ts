import { describe, expect, it } from "vitest";
import { arrowheadAt } from "./arrowhead";

const p = (x: number, y: number) => ({ x, y });

describe("arrowheadAt", () => {
  it("sits at the target node's border, not its center (horizontal edge)", () => {
    const head = arrowheadAt(p(0, 0), p(100, 0), 10, 8, 3.5);
    expect(head).not.toBeNull();
    expect(head!.tip).toEqual({ x: 90, y: 0 }); // 10px short of dst center = the border
  });

  it("is oriented along the final segment (vertical edge)", () => {
    const head = arrowheadAt(p(0, 0), p(0, 100), 10, 8, 3.5);
    expect(head!.tip.x).toBeCloseTo(0, 9);
    expect(head!.tip.y).toBeCloseTo(90, 9);
    // Base points sit symmetric around the shaft, perpendicular to travel.
    expect(head!.left.y).toBeCloseTo(head!.right.y, 9);
    expect(head!.left.x).toBeCloseTo(-head!.right.x, 9);
  });

  it("base points sit `length` back from the tip, `halfWidth` off the shaft", () => {
    const head = arrowheadAt(p(0, 0), p(100, 0), 0, 8, 3.5);
    expect(head!.left).toEqual({ x: 92, y: 3.5 });
    expect(head!.right).toEqual({ x: 92, y: -3.5 });
  });

  it("rotates correctly for a diagonal (45°) edge", () => {
    const head = arrowheadAt(p(0, 0), p(100, 100), 0, Math.SQRT2 * 10, 0);
    expect(head!.tip.x).toBeCloseTo(100, 9);
    expect(head!.tip.y).toBeCloseTo(100, 9);
    // length back along a 45° direction by 10*sqrt2 moves exactly (-10,-10).
    expect(head!.left.x).toBeCloseTo(90, 9);
    expect(head!.left.y).toBeCloseTo(90, 9);
    expect(head!.right.x).toBeCloseTo(90, 9);
    expect(head!.right.y).toBeCloseTo(90, 9);
  });

  it("returns null for a degenerate (zero-length) edge — nothing to orient along", () => {
    expect(arrowheadAt(p(5, 5), p(5, 5), 10, 8, 3.5)).toBeNull();
  });
});
