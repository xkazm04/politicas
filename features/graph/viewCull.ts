/*
 * OŘEZ VÝŘEZEM — čisté odvození (doktrína trailPath.ts / forensicView.ts).
 *
 * Proč vlastní modul a ne dvě podmínky v jeviště: jeviště hrany ořezávalo
 * podle KONCŮ — „ani jeden konec není vidět, tedy hranu nekresli". To je
 * pojmenovaný anti-vzor (ai-registry canvas-graph/render-budget, rung 2):
 *
 *   „Hrana je viditelná, když její geometrii protne výřez, i když jsou OBA
 *    konce daleko venku. Ořez podle viditelnosti konců maže právě ty dlouhé
 *    spoje přes celý graf, které čtenář sleduje."
 *
 * Na /graf, jehož tématem JSOU vazby, to mizely přesně ty hrany, kvůli
 * kterým se člověk přiblížil. Správný test je úsečka×obdélník; oprava může
 * jen přikreslit, nikdy ubrat.
 *
 * Čistý modul bez DOM a bez plátna — testuje se na fixture ve viewCull.test.ts.
 */

import type { Point } from "@/lib/kg/layout";

/** Výřez světa viditelný na obrazovce (včetně rezervy na popisky). */
export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bod uvnitř výřezu (hranice včetně) — ořez uzlů. */
export const pointInRect = (p: Point, r: ViewRect): boolean =>
  p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

/**
 * Protne úsečka a→b výřez? Liang–Barsky bez počítání průsečíku: parametr `t`
 * se postupně zužuje čtyřmi polorovinami obdélníku; když interval nezmizí,
 * část úsečky uvnitř leží.
 *
 * Dotyk hranice se počítá jako viditelný (raději o hranu víc než míň) a
 * degenerovaná úsečka (a === b) spadne na test bodu.
 */
export function segmentCrossesRect(a: Point, b: Point, r: ViewRect): boolean {
  // Levný předřez podle obalového obdélníku — většinu hran vyřídí bez dělení.
  if (Math.max(a.x, b.x) < r.x0 || Math.min(a.x, b.x) > r.x1) return false;
  if (Math.max(a.y, b.y) < r.y0 || Math.min(a.y, b.y) > r.y1) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return pointInRect(a, r);

  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0; // rovnoběžně s hranou: buď celá uvnitř pásu, nebo venku
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };

  return (
    clip(-dx, a.x - r.x0) && clip(dx, r.x1 - a.x) && clip(-dy, a.y - r.y0) && clip(dy, r.y1 - a.y)
  );
}
