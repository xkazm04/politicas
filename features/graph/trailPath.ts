/*
 * „Spoj dva body" — čisté hledání důkazních cest v grafu.
 *
 * ŽÁDNÉ IMPORTY ZE SERVERU ANI Z REACTU — modul je čistá funkce nad hranami,
 * aby šel testovat na fixture grafu (trailPath.test.ts) a aby determinismus
 * nebyl slib, ale vlastnost: výsledek NESMÍ záviset na pořadí hran na vstupu.
 *
 * PRAVIDLO ŘAZENÍ (tiskne se čtenáři na výsledku — viz TrailFinder):
 *
 *   1. nejkratší cesta důkazními hranami — `co_votes_with` se nepoužívá
 *      (96 % hustoty párů: matice, ne síť) a uzel s ≥ HUB_DEGREE hranami se
 *      počítá za DVA kroky, jinak by přes strany a velké orgány vedla cesta
 *      odevšad všude a nic by neříkala;
 *   2. při stejné délce vyhrává cesta s MÉNĚ neověřenými hranami
 *      (review_state = pending_review) — ověřené bije návrh stroje;
 *   3. pak vyšší doložená částka (součet vah smluvních hran `supplies`);
 *   4. pak abeceda otisku cesty (id uzlů a relace) — poslední, čistě
 *      technický klíč, který zaručuje jednoznačné pořadí.
 *
 * Alternativy = DALŠÍ stejně krátké cesty v témže pořadí. Delší cesty se
 * nenabízejí: „existuje spojení přes víc kroků" je jiná otázka než „jaké je
 * nejkratší doložené spojení".
 *
 * Algoritmus: Dijkstra s celočíselnými náklady (přihrádky místo haldy) od
 * zdroje i od cíle, pak DFS výčet hran splňujících g[u] + cena(v) + h[v] =
 * = nejlepší — vyčíslí se tedy jen skutečné nejkratší cesty, nikdy celý
 * prostor. Graf je neorientovaný: hrana uložená B→A se projde i A→B a krok
 * si nese `forward`, aby klíč hrany (src|rel|dst) seděl na plátno.
 */

// ── Konstanty pravidla (UI je tiskne, testy je přibíjejí) ────────────────────

/** Relace, po kterých cesta nesmí vést. */
export const EXCLUDED_RELS: readonly string[] = ["co_votes_with"];
/** Od kolika důkazních hran se uzel počítá za dva kroky (hub). */
export const HUB_DEGREE = 120;
/** Strop ceny cesty — běžný uzel 1, hub 2; tedy nejvýše 6 běžných kroků. */
export const MAX_COST = 6;
/** Strop výčtu stejně krátkých cest (ochrana před kombinatorikou hubů). */
export const ENUM_CAP = 64;
/** Kolik nejlepších cest se vrací (vítěz + alternativy). */
export const ALTERNATES = 3;

// ── Tvary ────────────────────────────────────────────────────────────────────

export interface PathEdge {
  src: string;
  dst: string;
  rel: string;
  weight: number | null;
  /** Hrana čeká na lidskou kontrolu (review_state = pending_review). */
  pending: boolean;
}

interface AdjEntry {
  other: string;
  rel: string;
  weight: number | null;
  pending: boolean;
  /** true = hrana je uložená current→other; false = obráceně. */
  forward: boolean;
}

export interface Adjacency {
  neighbours: Map<string, AdjEntry[]>;
  /** Důkazní stupeň nad hranami, ze kterých se hledá (bez vyloučených relací). */
  degree: Map<string, number>;
}

export interface PathHop {
  /** Uzel, ze kterého krok vychází (ve směru čtení cesty). */
  from: string;
  to: string;
  rel: string;
  weight: number | null;
  pending: boolean;
  /** Orientace uložené hrany: true = uložená from→to. */
  forward: boolean;
}

export interface EvidencePath {
  /** Posloupnost uzlů od zdroje k cíli. */
  nodeIds: string[];
  hops: PathHop[];
  /** Cena podle pravidla (hub = 2) — všechny vrácené cesty ji mají shodnou. */
  cost: number;
  pendingCount: number;
  /** Součet vah smluvních hran (supplies) na cestě, v Kč. */
  moneyCzk: number;
}

export interface FindPathsOptions {
  maxCost?: number;
  hubDegree?: number;
  enumCap?: number;
  alternates?: number;
}

export interface FindPathsResult {
  /** Nejlepší cesty podle otištěného pravidla; prázdné = cesta neexistuje. */
  paths: EvidencePath[];
  /** Kolik stejně krátkých cest výčet našel (po strop enumCap). */
  totalFound: number;
  /** true = výčet narazil na strop; existují další stejně krátké cesty. */
  capped: boolean;
  /** Cena nejkratší cesty; null = žádná v limitu neexistuje. */
  cost: number | null;
}

// ── Stavba sousedství ────────────────────────────────────────────────────────

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const num = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Neorientované sousedství nad důkazními hranami. Duplicitní hrany
 * (src|rel|dst) se slučují komutativně — ověřená vyhrává, váha se bere vyšší —
 * a seznamy sousedů se řadí, takže výsledek nezávisí na pořadí vstupu.
 */
export function buildAdjacency(edges: PathEdge[]): Adjacency {
  const dedup = new Map<string, PathEdge>();
  for (const e of edges) {
    if (EXCLUDED_RELS.includes(e.rel)) continue;
    if (e.src === e.dst) continue;
    const key = `${e.src}|${e.rel}|${e.dst}`;
    const prev = dedup.get(key);
    if (!prev) {
      dedup.set(key, { src: e.src, dst: e.dst, rel: e.rel, weight: e.weight, pending: e.pending });
    } else {
      prev.pending = prev.pending && e.pending;
      prev.weight = num(prev.weight) >= num(e.weight) ? prev.weight : e.weight;
    }
  }

  const neighbours = new Map<string, AdjEntry[]>();
  const degree = new Map<string, number>();
  const push = (id: string, entry: AdjEntry) => {
    const list = neighbours.get(id);
    if (list) list.push(entry);
    else neighbours.set(id, [entry]);
    degree.set(id, (degree.get(id) ?? 0) + 1);
  };
  for (const e of dedup.values()) {
    push(e.src, { other: e.dst, rel: e.rel, weight: e.weight, pending: e.pending, forward: true });
    push(e.dst, { other: e.src, rel: e.rel, weight: e.weight, pending: e.pending, forward: false });
  }
  for (const list of neighbours.values()) {
    list.sort((a, b) => cmp(a.other, b.other) || cmp(a.rel, b.rel) || Number(a.forward) - Number(b.forward));
  }
  return { neighbours, degree };
}

// ── Hledání ──────────────────────────────────────────────────────────────────

/** Dijkstra přihrádkami: dist = cena vstupu do uzlu (zdroj 0). */
function distances(
  adj: Adjacency,
  start: string,
  stepCost: (id: string) => number,
  maxCost: number,
): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const buckets: string[][] = [[start]];
  for (let d = 0; d <= maxCost; d++) {
    const bucket = buckets[d];
    if (!bucket) continue;
    for (const u of bucket) {
      if (dist.get(u) !== d) continue; // zastaralý zápis v přihrádce
      for (const entry of adj.neighbours.get(u) ?? []) {
        const nd = d + stepCost(entry.other);
        if (nd > maxCost) continue;
        const cur = dist.get(entry.other);
        if (cur !== undefined && cur <= nd) continue;
        dist.set(entry.other, nd);
        (buckets[nd] ??= []).push(entry.other);
      }
    }
  }
  return dist;
}

/** Otisk cesty — poslední, abecední klíč řazení. */
const signatureOf = (hops: PathHop[]) => hops.map((h) => `${h.from}>${h.rel}>${h.to}`).join("|");

/**
 * Najdi nejkratší důkazní cesty mezi dvěma uzly podle otištěného pravidla.
 * Deterministické: stejné hrany (v libovolném pořadí) → stejný výsledek.
 */
export function findEvidencePaths(
  adj: Adjacency,
  src: string,
  dst: string,
  opts: FindPathsOptions = {},
): FindPathsResult {
  const maxCost = opts.maxCost ?? MAX_COST;
  const hubDegree = opts.hubDegree ?? HUB_DEGREE;
  const enumCap = opts.enumCap ?? ENUM_CAP;
  const alternates = opts.alternates ?? ALTERNATES;

  const none: FindPathsResult = { paths: [], totalFound: 0, capped: false, cost: null };
  if (src === dst) return none;
  if (!adj.neighbours.has(src) || !adj.neighbours.has(dst)) return none;

  // Cena VSTUPU do uzlu: koncové body za 1 vždy — penalizace hubů má bránit
  // cestám PŘES největší uzly, ne cestám K nim.
  const stepCost = (id: string): number =>
    id === src || id === dst ? 1 : (adj.degree.get(id) ?? 0) >= hubDegree ? 2 : 1;

  const g = distances(adj, src, stepCost, maxCost); // cena src → uzel
  const best = g.get(dst);
  if (best === undefined) return none;
  const h = distances(adj, dst, stepCost, best); // cena uzel → dst (symetrické: graf i cena jsou neorientované)

  // DFS jen po hranách, které leží na NĚJAKÉ nejkratší cestě. Pozor na
  // účetnictví: h[v] je cena zpáteční chůze dst→v, takže UŽ obsahuje cenu
  // vstupu do v a NEobsahuje cenu vstupu do dst (ta je vždy 1). Dopředná
  // cesta přes hranu u→v proto stojí přesně d(u) + h[v] + 1 — sčítat
  // stepCost(v) podruhé by huby na cestě diskvalifikovalo dvakrát.
  const found: EvidencePath[] = [];
  let capped = false;
  const hops: PathHop[] = [];
  const seq: string[] = [src];

  const walk = (u: string, d: number): void => {
    if (capped) return;
    if (u === dst) {
      let pendingCount = 0;
      let moneyCzk = 0;
      for (const hop of hops) {
        if (hop.pending) pendingCount++;
        if (hop.rel === "supplies") moneyCzk += num(hop.weight);
      }
      found.push({ nodeIds: [...seq], hops: [...hops], cost: best, pendingCount, moneyCzk });
      if (found.length >= enumCap) capped = true;
      return;
    }
    for (const entry of adj.neighbours.get(u) ?? []) {
      const rest = h.get(entry.other);
      if (rest === undefined || d + rest + 1 !== best) continue;
      hops.push({
        from: u,
        to: entry.other,
        rel: entry.rel,
        weight: entry.weight,
        pending: entry.pending,
        forward: entry.forward,
      });
      seq.push(entry.other);
      walk(entry.other, d + stepCost(entry.other));
      seq.pop();
      hops.pop();
      if (capped) return;
    }
  };
  walk(src, 0);

  found.sort(
    (a, b) =>
      a.pendingCount - b.pendingCount ||
      b.moneyCzk - a.moneyCzk ||
      cmp(signatureOf(a.hops), signatureOf(b.hops)),
  );

  return { paths: found.slice(0, alternates), totalFound: found.length, capped, cost: best };
}
