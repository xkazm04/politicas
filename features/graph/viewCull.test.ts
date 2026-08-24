import { describe, expect, it } from "vitest";
import { pointInRect, segmentCrossesRect, type ViewRect } from "./viewCull";

const RECT: ViewRect = { x0: 0, y0: 0, x1: 100, y1: 100 };
const p = (x: number, y: number) => ({ x, y });

describe("pointInRect", () => {
  it("bod uvnitř i na hranici je vidět", () => {
    expect(pointInRect(p(50, 50), RECT)).toBe(true);
    expect(pointInRect(p(0, 0), RECT)).toBe(true);
    expect(pointInRect(p(100, 100), RECT)).toBe(true);
  });

  it("bod venku není vidět", () => {
    expect(pointInRect(p(-1, 50), RECT)).toBe(false);
    expect(pointInRect(p(50, 101), RECT)).toBe(false);
  });
});

describe("segmentCrossesRect — hrana je vidět, když ji výřez protne", () => {
  // Toto je celý důvod modulu: OBA konce venku, hrana přes střed výřezu.
  it("protíná i když jsou OBA konce daleko venku (vodorovně)", () => {
    expect(segmentCrossesRect(p(-500, 50), p(500, 50), RECT)).toBe(true);
  });

  it("protíná i když jsou OBA konce daleko venku (svisle)", () => {
    expect(segmentCrossesRect(p(50, -500), p(50, 500), RECT)).toBe(true);
  });

  it("protíná i když jsou OBA konce daleko venku (šikmo přes roh)", () => {
    expect(segmentCrossesRect(p(-200, -200), p(300, 300), RECT)).toBe(true);
  });

  it("hrana s jedním koncem uvnitř je vidět", () => {
    expect(segmentCrossesRect(p(50, 50), p(900, 900), RECT)).toBe(true);
    expect(segmentCrossesRect(p(-900, -900), p(1, 1), RECT)).toBe(true);
  });

  it("hrana celá uvnitř je vidět", () => {
    expect(segmentCrossesRect(p(10, 10), p(90, 90), RECT)).toBe(true);
  });

  it("hrana celá mimo pás výřezu vidět není", () => {
    expect(segmentCrossesRect(p(-500, 200), p(500, 200), RECT)).toBe(false);
    expect(segmentCrossesRect(p(200, -500), p(200, 500), RECT)).toBe(false);
  });

  it("šikmá hrana, která obalovým obdélníkem projde, ale výřez mine", () => {
    // Přímka x+y = −50: obal [−150..100]² výřez překrývá, ale úsečka projde
    // pod levým dolním rohem (v x=0 je y=−50, v y=0 je x=−50).
    expect(segmentCrossesRect(p(-150, 100), p(100, -150), RECT)).toBe(false);
    // Táž přímka posunutá na x+y = 150 už výřez protne (v x=100 je y=50) —
    // záporný případ výše tedy není vakuový.
    expect(segmentCrossesRect(p(-50, 200), p(200, -50), RECT)).toBe(true);
  });

  it("dotyk hranice se počítá jako viditelný", () => {
    expect(segmentCrossesRect(p(-50, 0), p(50, 0), RECT)).toBe(true);
    expect(segmentCrossesRect(p(100, -50), p(100, 50), RECT)).toBe(true);
  });

  it("degenerovaná hrana (a === b) spadne na test bodu", () => {
    expect(segmentCrossesRect(p(50, 50), p(50, 50), RECT)).toBe(true);
    expect(segmentCrossesRect(p(500, 500), p(500, 500), RECT)).toBe(false);
  });

  it("je symetrická v pořadí konců", () => {
    const a = p(-300, 20);
    const b = p(300, 80);
    expect(segmentCrossesRect(a, b, RECT)).toBe(segmentCrossesRect(b, a, RECT));
  });

  it("nikdy neubere proti starému ořezu podle konců", () => {
    // Vlastnost, kterou oprava slibuje: co prošlo endpoint testem, projde i teď.
    const pts = [-200, -50, 0, 37, 100, 260];
    for (const ax of pts)
      for (const ay of pts)
        for (const bx of pts)
          for (const by of pts) {
            const a = p(ax, ay);
            const b = p(bx, by);
            if (pointInRect(a, RECT) || pointInRect(b, RECT)) {
              expect(segmentCrossesRect(a, b, RECT)).toBe(true);
            }
          }
  });
});
