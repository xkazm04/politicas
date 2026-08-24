/*
 * PŘEVOD SVĚT↔OBRAZOVKA — JEDNA AUTORITA (doktrína viewCull.ts / trailPath.ts).
 *
 * Proč vlastní modul a ne čtyři kopie v GraphStage.tsx: `draw()` měl vlastní
 * `screen()`, `hitTest()` vlastní inverzi, `zoomAt` vlastní přepočet a
 * `fitView`/`fitBounds` vlastní verzi „srovnej pohled na obsah" — funkčně
 * shodné, napsané čtyřikrát. Souběh držel jen to, že šlo o jeden soubor;
 * první vráska (ořez měřítka, korekce pro device pixel ratio, posun kvůli
 * fit marginu) by dopadla jen do jedné kopie a zbylé tři by tiše zůstaly
 * pozadu (ai-registry canvas-graph/viewport-transform: „one-authority-
 * per-vocabulary" aplikovaná na geometrii).
 *
 * Pohled (View) je dvojice (posun, měřítko) nad souřadnicemi PLÁTNA v CSS
 * pixelech (ne klientských — volající si `clientX - rect.left` odečte sám,
 * stejně jako dřív). `toWorld` a `toScreen` jsou navzájem inverzní; ořez
 * měřítka žije JEN tady (`clampK`), aby dělení škálou nešlo přičíst nikde
 * mimo tento soubor.
 *
 * Čistý modul bez DOM a bez plátna — testuje se na fixture ve
 * viewTransform.test.ts, včetně round-trip vlastnosti toWorld∘toScreen = id.
 */

import type { Point } from "@/lib/kg/layout";

export interface View {
  x: number;
  y: number;
  k: number;
}

/** Rozsah měřítka — jediné místo ořezu (ai-registry: „Clamp the scale in
 *  the authority, not at call sites"). */
export const MIN_K = 0.1;
export const MAX_K = 9;

export const clampK = (k: number): number => Math.max(MIN_K, Math.min(MAX_K, k));

/** Bod plátna (CSS px) → svět. */
export function toWorld(view: View, p: Point): Point {
  return { x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k };
}

/** Bod světa → plátno (CSS px). */
export function toScreen(view: View, p: Point): Point {
  return { x: p.x * view.k + view.x, y: p.y * view.k + view.y };
}

/**
 * Přiblížení PŘIPÍCHNUTÉ k bodu `anchor` (souřadnice plátna): svět pod
 * ukazatelem před zoomem zůstane pod ukazatelem po zoomu. Tři řádky změny
 * báze (ai-registry viewport-transform „Zoom-to-point") a jediné místo, kde
 * se `factor` aplikuje — kolečko myši i tlačítka +/− volají tutéž funkci,
 * liší se jen tím, který bod připíchnou.
 */
export function zoomAtPoint(view: View, anchor: Point, factor: number): View {
  const k = clampK(view.k * factor);
  return {
    k,
    x: anchor.x - ((anchor.x - view.x) / view.k) * k,
    y: anchor.y - ((anchor.y - view.y) / view.k) * k,
  };
}

/** Pohled vystředěný na bod světa `center` při daném měřítku `k` — základ
 *  pro `fitRect` i pro „najet na uzel beze změny přiblížení" (focusId). */
export function centerOn(k: number, center: Point, viewport: { w: number; h: number }): View {
  return { k, x: viewport.w / 2 - center.x * k, y: viewport.h / 2 - center.y * k };
}

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Pohled, který obdélník světa `rect` vystředí a orámuje do `viewport` s
 * rezervou `padding` na každou stranu, ne blíž než `maxK`. `minExtent`
 * chrání degenerovaný (bodový/čárový) obdélník — bez něj by dělení nulovým
 * rozměrem poslalo měřítko do nekonečna.
 */
export function fitRect(
  rect: WorldRect,
  viewport: { w: number; h: number },
  opts: { padding?: number; maxK?: number; minExtent?: number } = {},
): View {
  const padding = opts.padding ?? 0;
  const maxK = opts.maxK ?? MAX_K;
  const minExtent = opts.minExtent ?? 0;
  const w = Math.max(rect.x1 - rect.x0, minExtent);
  const h = Math.max(rect.y1 - rect.y0, minExtent);
  const k = clampK(Math.min((viewport.w - padding * 2) / w, (viewport.h - padding * 2) / h, maxK));
  return centerOn(k, { x: rect.x0 + w / 2, y: rect.y0 + h / 2 }, viewport);
}
