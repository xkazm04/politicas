import { describe, expect, it } from "vitest";
import { MAX_K, MIN_K, centerOn, clampK, fitRect, toScreen, toWorld, zoomAtPoint, type View } from "./viewTransform";

const VIEWS: View[] = [
  { x: 0, y: 0, k: 1 },
  { x: 120, y: -40, k: 2.5 },
  { x: -300, y: 800, k: 0.4 },
  { x: 5.5, y: -5.5, k: 9 },
];
const POINTS = [
  { x: 0, y: 0 },
  { x: 500, y: 500 },
  { x: -120, y: 37 },
  { x: 12345.25, y: -6789.75 },
];

describe("toWorld / toScreen — round trip (raison d'être of the module)", () => {
  it("toWorld(toScreen(p)) === p for every view × point fixture", () => {
    for (const view of VIEWS) {
      for (const p of POINTS) {
        const roundTripped = toWorld(view, toScreen(view, p));
        expect(roundTripped.x).toBeCloseTo(p.x, 9);
        expect(roundTripped.y).toBeCloseTo(p.y, 9);
      }
    }
  });

  it("toScreen(toWorld(p)) === p for every view × point fixture", () => {
    for (const view of VIEWS) {
      for (const p of POINTS) {
        const roundTripped = toScreen(view, toWorld(view, p));
        expect(roundTripped.x).toBeCloseTo(p.x, 9);
        expect(roundTripped.y).toBeCloseTo(p.y, 9);
      }
    }
  });

  it("identity view (no pan, k=1) is a pass-through", () => {
    const view: View = { x: 0, y: 0, k: 1 };
    expect(toScreen(view, { x: 42, y: -7 })).toEqual({ x: 42, y: -7 });
    expect(toWorld(view, { x: 42, y: -7 })).toEqual({ x: 42, y: -7 });
  });
});

describe("clampK", () => {
  it("holds the range and passes through inside it", () => {
    expect(clampK(0.001)).toBe(MIN_K);
    expect(clampK(1000)).toBe(MAX_K);
    expect(clampK(1.5)).toBe(1.5);
  });
});

describe("zoomAtPoint — zoom-to-point pins the anchor", () => {
  it("the world point under the anchor stays under the anchor after zoom", () => {
    const view: View = { x: 10, y: -20, k: 1 };
    const anchor = { x: 300, y: 150 };
    const worldUnderAnchorBefore = toWorld(view, anchor);
    const next = zoomAtPoint(view, anchor, 2);
    const worldUnderAnchorAfter = toWorld(next, anchor);
    expect(worldUnderAnchorAfter.x).toBeCloseTo(worldUnderAnchorBefore.x, 9);
    expect(worldUnderAnchorAfter.y).toBeCloseTo(worldUnderAnchorBefore.y, 9);
  });

  it("clamps the resulting scale to [MIN_K, MAX_K]", () => {
    const view: View = { x: 0, y: 0, k: 1 };
    expect(zoomAtPoint(view, { x: 0, y: 0 }, 0.0001).k).toBe(MIN_K);
    expect(zoomAtPoint(view, { x: 0, y: 0 }, 100).k).toBe(MAX_K);
  });
});

describe("centerOn", () => {
  it("centers the given world point in the viewport at the given scale", () => {
    const viewport = { w: 800, h: 600 };
    const view = centerOn(2, { x: 100, y: 50 }, viewport);
    expect(view.k).toBe(2);
    // The world point must land exactly on the viewport's own center.
    const screen = toScreen(view, { x: 100, y: 50 });
    expect(screen.x).toBeCloseTo(viewport.w / 2, 9);
    expect(screen.y).toBeCloseTo(viewport.h / 2, 9);
  });
});

describe("fitRect — fit-to-content transform", () => {
  it("frames a rect exactly (no padding, viewport aspect matches content)", () => {
    const rect = { x0: 0, y0: 0, x1: 1000, y1: 500 };
    const viewport = { w: 400, h: 200 };
    const view = fitRect(rect, viewport);
    expect(view.k).toBeCloseTo(0.4, 9);
    // Content center (500,250) must land on viewport center.
    const screen = toScreen(view, { x: 500, y: 250 });
    expect(screen.x).toBeCloseTo(viewport.w / 2, 9);
    expect(screen.y).toBeCloseTo(viewport.h / 2, 9);
  });

  it("respects padding and maxK", () => {
    const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };
    const viewport = { w: 1000, h: 1000 };
    // Without a maxK cap this would zoom in far past what a trail-path fit
    // should ever reach; the option exists precisely to prevent that.
    const view = fitRect(rect, viewport, { padding: 90, maxK: 1.4 });
    expect(view.k).toBe(1.4);
  });

  it("minExtent guards a degenerate (point-like) rect from a division blow-up", () => {
    const rect = { x0: 10, y0: 10, x1: 10, y1: 10 };
    const viewport = { w: 800, h: 600 };
    const view = fitRect(rect, viewport, { minExtent: 60, maxK: 9 });
    expect(Number.isFinite(view.k)).toBe(true);
    expect(view.k).toBeGreaterThan(0);
  });
});
