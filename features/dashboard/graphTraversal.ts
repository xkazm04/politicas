/*
 * PROCHÁZENÍ GRAFU KLÁVESNICÍ — čisté pravidlo, žádný DOM.
 *
 * Plátno velína kreslí ~17 uzlů jako `<g role="button" tabIndex={0}>`. Do
 * 2026-08-05 to znamenalo SEDMNÁCT tabstopů: čtenář, který jede klávesnicí,
 * musel projít celý obrázek, aby se dostal na pás provozu pod ním — a mezi uzly
 * se nedalo pohybovat jinak než tabulátorem, tedy v pořadí, ve kterém je pole
 * náhodou složené, ne v pořadí, ve kterém graf drží pohromadě.
 *
 * ── PRAVIDLO ────────────────────────────────────────────────────────────────
 * Navigační mapou je SEZNAM HRAN, ne rozvržení. Šipka se ptá: „který z mých
 * SOUSEDŮ leží tím směrem?" — soused, ne libovolný uzel, protože graf je o
 * vazbách a skákat mezi nespojenými entitami by z obrázku dělalo mřížku.
 *
 *   1. kandidáti = sousedé uzlu (hrana v obou směrech), každý jednou;
 *   2. vyřadí se ti, kteří NEleží v poloprostoru šipky (skalární součin s jejím
 *      směrem musí být kladný) — šipka nikdy nesmí pohnout proti sobě;
 *   3. vyhraje nejmenší úhel od směru šipky (největší kosinus);
 *   4. shoda se rozhodne podle id vzestupně, aby byl krok deterministický
 *      (týž graf ⇒ táž cesta, i v testu).
 *
 * Když tím směrem soused není, vrací se `null` a KLÁVESA NIC NEUDĚLÁ. Zabalení
 * na druhý konec by čtenáře přeneslo na uzel, kterým šipka neukazuje — to není
 * navigace, to je teleport.
 *
 * Home/End skáčou na první a poslední uzel V POŘADÍ, V JAKÉM JE PLÁTNO KRESLÍ
 * (osy zleva doprava, shora dolů — viz stateSlice.ts), tedy v pořadí, které má
 * čtenář před očima; nic se nepřeřazuje podle metriky.
 *
 * Souřadnice jsou v soustavě SVG: y roste DOLŮ, takže „nahoru" je záporné y.
 */

export interface TraversalNode {
  id: string;
  x: number;
  y: number;
}

export interface TraversalEdge {
  from: string;
  to: string;
}

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export const ARROW_KEYS: readonly ArrowKey[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export const isArrowKey = (key: string): key is ArrowKey =>
  (ARROW_KEYS as readonly string[]).includes(key);

/** Jednotkový směr šipky v soustavě SVG (y dolů). */
const DIRECTION: Record<ArrowKey, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

/** id → sousedé (hrana v obou směrech, každý soused jednou). Deterministické. */
export function adjacency(edges: readonly TraversalEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = map.get(a);
    if (!list) map.set(a, [b]);
    else if (!list.includes(b)) list.push(b);
  };
  for (const e of edges) {
    if (e.from === e.to) continue; // smyčka není krok
    add(e.from, e.to);
    add(e.to, e.from);
  }
  return map;
}

/**
 * Soused, na který šipka ukazuje — nebo `null`, když tím směrem žádný není.
 *
 * @param from  id uzlu, na kterém stojí fokus
 */
export function neighbourStep(
  from: string,
  key: ArrowKey,
  nodes: readonly TraversalNode[],
  edges: readonly TraversalEdge[],
): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const origin = byId.get(from);
  if (!origin) return null;

  const dir = DIRECTION[key];
  let best: { id: string; cos: number } | null = null;

  for (const id of adjacency(edges).get(from) ?? []) {
    const n = byId.get(id);
    if (!n) continue; // hrana do uzlu, který plátno nekreslí, není cesta
    const dx = n.x - origin.x;
    const dy = n.y - origin.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue; // uzly na sobě — směr neexistuje
    const dot = dx * dir.dx + dy * dir.dy;
    if (dot <= 0) continue; // leží proti šipce nebo kolmo
    const cos = dot / len;
    // Shodu rozhoduje id vzestupně, ne pořadí v poli hran.
    if (best === null || cos > best.cos || (cos === best.cos && id < best.id)) {
      best = { id, cos };
    }
  }
  return best?.id ?? null;
}

/** První / poslední uzel v pořadí, v jakém plátno kreslí. `null` = prázdný graf. */
export const firstNodeId = (nodes: readonly TraversalNode[]): string | null => nodes[0]?.id ?? null;
export const lastNodeId = (nodes: readonly TraversalNode[]): string | null =>
  nodes[nodes.length - 1]?.id ?? null;

/**
 * Uzel, který drží JEDINÝ tabstop plátna (roving tabindex).
 *
 * Priorita: kde je klávesnice → co je vybráno → první uzel. Bez toho by se
 * tabulátorem vstupovalo pokaždé na začátek a čtenář by po každém návratu do
 * obrázku ztratil místo.
 */
export function rovingNodeId(
  focused: string | null,
  selected: string | null,
  nodes: readonly TraversalNode[],
): string | null {
  const has = (id: string | null) => id !== null && nodes.some((n) => n.id === id);
  if (has(focused)) return focused;
  if (has(selected)) return selected;
  return firstNodeId(nodes);
}
