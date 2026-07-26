// Rozmístění uzlů grafu — čistá geometrie, žádný DOM, žádné plátno.
//
// DETERMINISMUS JE ZÁMĚR, ne náhoda. Nikde v tomhle souboru není `Math.random`:
// počáteční pozice se odvozují z hashe id uzlu. Tři důvody:
//   1. stejný výběr uzlů dá vždycky stejný obrázek — čtenář si ho pamatuje
//      a může ho někomu popsat („ta firma vpravo dole"),
//   2. sdílená adresa plátna vykreslí u druhého člověka totéž,
//   3. testy můžou tvrdit něco o výsledku.
//
// Souřadnice se zaokrouhlují na 2 desetinná místa — stejná disciplína jako
// u SVG v Hemicycle.tsx; drift ve float mezi během na serveru a v prohlížeči
// jinak rozbíjí hydrataci.

export interface LayoutNode {
  id: string;
}

export interface LayoutEdge {
  src: string;
  dst: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutBox {
  width: number;
  height: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** FNV-1a — stabilní hash id na 32 bitů. Levný a rozhází podobná id daleko. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash → hodnota v <0,1). */
const unit = (id: string, salt = "") => hashId(`${salt}${id}`) / 0x100000000;

/**
 * Jádro simulace (Fruchterman–Reingold): odpudivost mezi všemi dvojicemi,
 * přitažlivost po hranách, chladnutí teploty. Umí připnuté uzly (nehýbou se,
 * ale síly vyvíjejí) — dnes nevyužité, drží dveře inkrementálním layoutům.
 *
 * O(n²) na iteraci — vědomě. Stovky uzlů na serveru a desítky na klientu jsou
 * zlomky sekundy; kdo potřebuje víc, potřebuje agregaci, ne Barnes-Hut.
 */
function simulate(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  xs: Float64Array,
  ys: Float64Array,
  pinned: ReadonlySet<string>,
  width: number,
  height: number,
  iterations: number,
  tempScale: number,
): void {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const isPinned = nodes.map((n) => pinned.has(n.id));
  const k = Math.sqrt((width * height) / nodes.length) * 0.62;
  const links = edges
    .map((e) => [idx.get(e.src), idx.get(e.dst)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined && p[0] !== p[1]);

  const dx = new Float64Array(nodes.length);
  const dy = new Float64Array(nodes.length);

  for (let step = 0; step < iterations; step++) {
    dx.fill(0);
    dy.fill(0);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let vx = xs[i] - xs[j];
        let vy = ys[i] - ys[j];
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) {
          // Dokonalý překryv nemá směr — odstrč deterministicky podle indexu.
          vx = ((i % 7) - 3) * 0.5 || 0.5;
          vy = ((j % 5) - 2) * 0.5 || 0.5;
          d2 = vx * vx + vy * vy;
        }
        const force = (k * k) / d2;
        const fx = vx * force;
        const fy = vy * force;
        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }

    for (const [a, b] of links) {
      const vx = xs[a] - xs[b];
      const vy = ys[a] - ys[b];
      const d = Math.sqrt(vx * vx + vy * vy) || 0.01;
      const force = (d * d) / k / d;
      const fx = vx * force;
      const fy = vy * force;
      dx[a] -= fx;
      dy[a] -= fy;
      dx[b] += fx;
      dy[b] += fy;
    }

    // Teplota klesá lineárně — poslední kroky už jen dolaďují.
    const temp = ((1 - step / iterations) * Math.min(width, height) * 0.08 + 0.5) * tempScale;
    const pad = 26;
    for (let i = 0; i < nodes.length; i++) {
      if (isPinned[i]) continue;
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      xs[i] += (dx[i] / d) * Math.min(d, temp);
      ys[i] += (dy[i] / d) * Math.min(d, temp);
      xs[i] = Math.max(pad, Math.min(width - pad, xs[i]));
      ys[i] = Math.max(pad, Math.min(height - pad, ys[i]));
    }
  }
}

const EMPTY_PIN: ReadonlySet<string> = new Set();

/** Silový layout z hashových startů — pro plátno skládané od nuly. */
export function forceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: Partial<LayoutBox> & { iterations?: number; seed?: string } = {},
): Map<string, Point> {
  const width = opts.width ?? 1000;
  const height = opts.height ?? 700;
  const iterations = opts.iterations ?? 260;
  const seed = opts.seed ?? "";
  const out = new Map<string, Point>();
  if (nodes.length === 0) return out;
  if (nodes.length === 1) {
    out.set(nodes[0].id, { x: r2(width / 2), y: r2(height / 2) });
    return out;
  }

  const xs = new Float64Array(nodes.length);
  const ys = new Float64Array(nodes.length);

  // Start na kružnici podle hashe — rozházené, ale reprodukovatelné.
  const r0 = Math.min(width, height) * 0.35;
  nodes.forEach((n, i) => {
    const a = unit(n.id, seed) * Math.PI * 2;
    const rad = r0 * (0.35 + 0.65 * unit(n.id, `${seed}r`));
    xs[i] = width / 2 + Math.cos(a) * rad;
    ys[i] = height / 2 + Math.sin(a) * rad;
  });

  simulate(nodes, edges, xs, ys, EMPTY_PIN, width, height, iterations, 1);
  nodes.forEach((n, i) => out.set(n.id, { x: r2(xs[i]), y: r2(ys[i]) }));
  return out;
}

// ── Sloupcová sazba pro trasy ────────────────────────────────────────────────

export interface LayeredItem {
  id: string;
  /** Index sloupce zleva. */
  column: number;
  /** Pořadí ve sloupci shora (volající řadí podle peněz/stupně). */
  order: number;
}

export interface LayeredResult {
  positions: Map<string, Point>;
  world: LayoutBox;
  /** X souřadnice sloupců — pro titulky sloupců na plátně. */
  columnX: number[];
}

/**
 * Sloupce jako v účetní knize: role = sloupec, pořadí = řádek. Žádná
 * simulace — trasa je argument a argument má mít pevnou sazbu, ne náhodný
 * tvar. Kratší sloupce se svisle centrují, aby hrany netáhly do rohu.
 */
export function layeredLayout(
  items: LayeredItem[],
  opts: { colGap?: number; rowGap?: number; padX?: number; padY?: number } = {},
): LayeredResult {
  const colGap = opts.colGap ?? 480;
  const rowGap = opts.rowGap ?? 68;
  const padX = opts.padX ?? 170;
  const padY = opts.padY ?? 110;

  const positions = new Map<string, Point>();
  if (items.length === 0) {
    return { positions, world: { width: 800, height: 500 }, columnX: [] };
  }

  const cols = Math.max(...items.map((i) => i.column)) + 1;
  const rowsIn = Array.from({ length: cols }, (_, c) => items.filter((i) => i.column === c).length);
  const maxRows = Math.max(...rowsIn, 1);

  const world = {
    width: padX * 2 + colGap * Math.max(cols - 1, 0),
    height: Math.max(padY * 2 + rowGap * (maxRows - 1), 460),
  };
  const columnX = Array.from({ length: cols }, (_, c) => r2(padX + c * colGap));

  for (const item of items) {
    const centerOffset = ((maxRows - rowsIn[item.column]) * rowGap) / 2;
    positions.set(item.id, {
      x: columnX[item.column],
      y: r2(padY + centerOffset + item.order * rowGap),
    });
  }
  return { positions, world, columnX };
}
