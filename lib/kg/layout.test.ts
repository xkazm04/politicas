import { describe, expect, it } from "vitest";
import { forceLayout, hashId, layeredLayout, type LayoutEdge, type LayoutNode } from "./layout";

const nodes = (n: number): LayoutNode[] => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
const chain = (n: number): LayoutEdge[] =>
  Array.from({ length: Math.max(n - 1, 0) }, (_, i) => ({ src: `n${i}`, dst: `n${i + 1}` }));

const BOX = { width: 900, height: 600, iterations: 60 };
const inBox = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 600;
const rounded = (v: number) => v === Math.round(v * 100) / 100;

describe("forceLayout", () => {
  it("je deterministický — stejný vstup dvakrát dá bit po bitu stejné plátno", () => {
    // Celý smysl: sdílená adresa plátna musí u druhého člověka vykreslit totéž.
    const a = forceLayout(nodes(24), chain(24), BOX);
    const b = forceLayout(nodes(24), chain(24), BOX);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("nezávisí na pořadí uzlů na vstupu", () => {
    const straight = forceLayout(nodes(12), chain(12), BOX);
    const shuffled = forceLayout([...nodes(12)].reverse(), chain(12), BOX);
    for (const [id, p] of straight) expect(shuffled.get(id), id).toEqual(p);
  });

  it("drží uzly uvnitř plochy a zaokrouhlené na 2 desetinná místa", () => {
    // Nezaokrouhlené souřadnice driftují mezi serverem a prohlížečem.
    for (const p of forceLayout(nodes(40), chain(40), BOX).values()) {
      expect(inBox(p)).toBe(true);
      expect(rounded(p.x) && rounded(p.y)).toBe(true);
    }
  });

  it("nepokládá dva uzly na jedno místo", () => {
    const seen = new Set<string>();
    for (const p of forceLayout(nodes(30), [], BOX).values()) seen.add(`${p.x}:${p.y}`);
    expect(seen.size).toBe(30);
  });

  it("spojené uzly skončí blíž než nespojené", () => {
    // Dva trojúhelníky bez hrany mezi sebou: uvnitř skupiny blíž než napříč.
    const ns = ["a1", "a2", "a3", "b1", "b2", "b3"].map((id) => ({ id }));
    const es = [
      { src: "a1", dst: "a2" },
      { src: "a2", dst: "a3" },
      { src: "a3", dst: "a1" },
      { src: "b1", dst: "b2" },
      { src: "b2", dst: "b3" },
      { src: "b3", dst: "b1" },
    ];
    const p = forceLayout(ns, es, { width: 800, height: 800, iterations: 400 });
    const d = (x: string, y: string) => Math.hypot(p.get(x)!.x - p.get(y)!.x, p.get(x)!.y - p.get(y)!.y);
    const within = (d("a1", "a2") + d("a2", "a3") + d("a1", "a3")) / 3;
    const across = (d("a1", "b1") + d("a2", "b2") + d("a3", "b3")) / 3;
    expect(within).toBeLessThan(across);
  });

  it("zvládne prázdný vstup i jediný uzel", () => {
    expect(forceLayout([], [], BOX).size).toBe(0);
    expect(forceLayout(nodes(1), [], BOX).get("n0")).toEqual({ x: 450, y: 300 });
  });

  it("ignoruje hrany na neexistující uzly místo pádu", () => {
    const p = forceLayout(nodes(3), [{ src: "n0", dst: "chybi" }, { src: "n1", dst: "n1" }], BOX);
    expect(p.size).toBe(3);
  });
});

describe("layeredLayout", () => {
  const items = [
    { id: "p1", column: 0, order: 0 },
    { id: "p2", column: 0, order: 1 },
    { id: "p3", column: 0, order: 2 },
    { id: "c1", column: 1, order: 0 },
    { id: "l1", column: 2, order: 0 },
  ];

  it("sloupec = role: x roste se sloupcem, uvnitř sloupce stejné x", () => {
    const { positions, columnX } = layeredLayout(items);
    expect(positions.get("p1")!.x).toBe(positions.get("p3")!.x);
    expect(positions.get("p1")!.x).toBeLessThan(positions.get("c1")!.x);
    expect(positions.get("c1")!.x).toBeLessThan(positions.get("l1")!.x);
    expect(columnX).toHaveLength(3);
  });

  it("kratší sloupce se svisle centrují", () => {
    const { positions } = layeredLayout(items);
    const mid = (positions.get("p1")!.y + positions.get("p3")!.y) / 2;
    expect(positions.get("c1")!.y).toBeCloseTo(mid, 5);
  });

  it("svět obepne obsah a všechno je uvnitř", () => {
    const { positions, world } = layeredLayout(items);
    for (const p of positions.values()) {
      expect(p.x > 0 && p.x < world.width).toBe(true);
      expect(p.y > 0 && p.y < world.height).toBe(true);
    }
  });

  it("prázdný vstup nevyrobí NaN svět", () => {
    const { world, positions } = layeredLayout([]);
    expect(positions.size).toBe(0);
    expect(Number.isFinite(world.width) && Number.isFinite(world.height)).toBe(true);
  });
});

describe("hashId", () => {
  it("je stabilní a rozhází podobná id", () => {
    expect(hashId("psp:person:6202")).toBe(hashId("psp:person:6202"));
    expect(hashId("psp:person:6202")).not.toBe(hashId("psp:person:6203"));
  });
});
