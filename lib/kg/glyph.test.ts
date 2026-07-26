import { describe, expect, it } from "vitest";
import { ALL_GLYPH_SHAPES, glyphPath, traceGlyph } from "./glyph";

/** Falešný kontext, který si jen zapisuje, co se na něm zavolalo. */
function recordingCtx() {
  const calls: Array<{ fn: string; args: number[] }> = [];
  const rec = (fn: string) => (...args: number[]) => {
    calls.push({ fn, args });
  };
  const ctx = {
    beginPath: rec("beginPath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arc: rec("arc"),
    rect: rec("rect"),
    closePath: rec("closePath"),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("traceGlyph — kontrakt dávkového kreslení", () => {
  it("NIKDY nezavolá beginPath", () => {
    // Regrese 2026-07-26: beginPath uvnitř značky mazal celou rozpracovanou
    // dávku, takže se z každého kbelíku vyplnil jen POSLEDNÍ uzel. Plátno
    // vypadalo prázdné, ale uzly na něm šly pořád kliknout.
    for (const shape of ALL_GLYPH_SHAPES) {
      const { ctx, calls } = recordingCtx();
      traceGlyph(ctx, shape, 8);
      expect(
        calls.filter((c) => c.fn === "beginPath"),
        `${shape} nesmí otevírat vlastní cestu`,
      ).toEqual([]);
    }
  });

  it("každý tvar si otevře vlastní podcestu (moveTo nebo rect)", () => {
    // Bez toho canvas spojí značku čárou s předchozí — falešné hrany.
    for (const shape of ALL_GLYPH_SHAPES) {
      const { ctx, calls } = recordingCtx();
      traceGlyph(ctx, shape, 8);
      expect(calls.length, shape).toBeGreaterThan(0);
      expect(["moveTo", "rect"], `${shape} začíná ${calls[0].fn}`).toContain(calls[0].fn);
    }
  });

  it("kruh má moveTo před arc, jinak ho canvas spojí s předchozím", () => {
    const { ctx, calls } = recordingCtx();
    traceGlyph(ctx, "circle", 9);
    const names = calls.map((c) => c.fn);
    expect(names.indexOf("moveTo")).toBeLessThan(names.indexOf("arc"));
  });

  it("dva tvary za sebou vyrobí dvě podcesty, ne jednu spojenou", () => {
    const { ctx, calls } = recordingCtx();
    traceGlyph(ctx, "triangle", 7);
    const first = calls.length;
    traceGlyph(ctx, "triangle", 7);
    expect(calls.slice(first)[0].fn).toBe("moveTo");
  });

  it("každý tvar kreslí kolem počátku, ne někam mimo", () => {
    // Volající značku posouvá translatem; kdyby si tvar nesl vlastní offset,
    // uzly by se rozjely proti hranám a proti hit-testu.
    for (const shape of ALL_GLYPH_SHAPES) {
      const { ctx, calls } = recordingCtx();
      const r = 8;
      traceGlyph(ctx, shape, r);
      for (const c of calls) {
        for (const v of c.args.slice(0, 2)) {
          expect(Math.abs(v), `${shape}/${c.fn}`).toBeLessThanOrEqual(r * 1.3);
        }
      }
    }
  });
});

describe("glyphPath", () => {
  it("vrací neprázdnou uzavřenou cestu pro každý tvar", () => {
    for (const shape of ALL_GLYPH_SHAPES) {
      const d = glyphPath(shape, 9);
      expect(d.startsWith("M"), shape).toBe(true);
      expect(d.trimEnd().endsWith("Z"), shape).toBe(true);
      expect(d, shape).not.toContain("NaN");
    }
  });

  it("souřadnice jsou zaokrouhlené — SSR a CSR musí vyjít stejně", () => {
    for (const shape of ["pentagon", "hexagon"] as const) {
      for (const n of glyphPath(shape, 9).match(/-?\d+\.\d+/g) ?? []) {
        expect(n.split(".")[1].length, `${shape}: ${n}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
