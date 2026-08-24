/*
 * HROT ŠIPKY U KONCE HRANY — čisté odvození (doktrína viewCull.ts).
 *
 * /graf kreslil hrany bez šipky: směr `src → dst` nesl jen barvu při
 * najetí myší, na ploše, jejíž TÉMA jsou vztahy (ai-registry canvas-graph/
 * edge-management: „arrowheads sit at the anchor, outside the node
 * border, oriented along the final segment").
 *
 * Hrot je posazený PŘESNĚ na hranici cílového uzlu (poloměr od středu),
 * ne do jeho středu ani do vzduchu vedle něj — geometrie uzlu (`radius`)
 * je JEDINÝ vstup, žádná druhá kopie „kde uzel končí" (shared anchor
 * geometry, tamtéž). Volající dodává touž dvojici positions/radiusOf,
 * kterou už používá kreslení uzlů a hitTest — tenhle modul si nic
 * nedomýšlí, jen otáčí trojúhelník podle bodů, které dostane.
 *
 * Čistý modul bez DOM a bez plátna — testuje se na fixture ve
 * arrowhead.test.ts.
 */

import type { Point } from "@/lib/kg/layout";

export interface Arrowhead {
  tip: Point;
  left: Point;
  right: Point;
}

/**
 * Trojúhelník hrotu šipky pro hranu a→b, orientovaný podél úsečky a→b.
 * `radius` je poloměr CÍLOVÉHO uzlu (b) — hrot leží na jeho hranici, ne
 * v jeho středu. `length`/`halfWidth` jsou v týchž souřadnicích jako body
 * (volající je typicky dělí zoomem `k`, stejně jako šířku čáry — viz
 * `ctx.lineWidth = 1.3 / k` v GraphStage).
 *
 * Vrací `null` pro degenerovanou hranu (a === b) — není podél čeho hrot
 * natočit.
 */
export function arrowheadAt(
  a: Point,
  b: Point,
  radius: number,
  length: number,
  halfWidth: number,
): Arrowhead | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const tip: Point = { x: b.x - ux * radius, y: b.y - uy * radius };
  const backX = tip.x - ux * length;
  const backY = tip.y - uy * length;
  const px = -uy; // kolmice k směru hrany — základna trojúhelníku
  const py = ux;
  return {
    tip,
    left: { x: backX + px * halfWidth, y: backY + py * halfWidth },
    right: { x: backX - px * halfWidth, y: backY - py * halfWidth },
  };
}
