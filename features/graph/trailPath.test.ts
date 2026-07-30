/*
 * Fixture testy „Spoj dva body" — přibíjejí přesně to, co UI čtenáři tiskne:
 * nejkratší cesta, hub za dva, ověřené bije čekající, pak peníze, pak abeceda.
 * A DETERMINISMUS: stejné hrany v jiném pořadí = bajtově stejný výsledek.
 */

import { describe, expect, it } from "vitest";
import {
  ALTERNATES,
  buildAdjacency,
  EXCLUDED_RELS,
  findEvidencePaths,
  HUB_DEGREE,
  MAX_COST,
  type PathEdge,
} from "./trailPath";

const edge = (src: string, dst: string, rel = "linked_to", over: Partial<PathEdge> = {}): PathEdge => ({
  src,
  dst,
  rel,
  weight: null,
  pending: false,
  ...over,
});

const nodeSeq = (r: ReturnType<typeof findEvidencePaths>) => r.paths.map((p) => p.nodeIds.join(">"));

describe("buildAdjacency", () => {
  it("vylučuje co_votes_with a smyčky, hrany čte obousměrně", () => {
    const adj = buildAdjacency([
      edge("a", "b"),
      edge("x", "y", "co_votes_with"),
      edge("s", "s"),
    ]);
    expect(EXCLUDED_RELS).toContain("co_votes_with");
    expect(adj.neighbours.has("x")).toBe(false);
    expect(adj.neighbours.has("s")).toBe(false);
    expect(adj.neighbours.get("b")?.[0]).toMatchObject({ other: "a", forward: false });
    expect(adj.degree.get("a")).toBe(1);
  });

  it("duplicitní hranu slučuje komutativně: ověřená vyhrává, váha vyšší", () => {
    const a = buildAdjacency([
      edge("a", "b", "supplies", { pending: true, weight: 5 }),
      edge("a", "b", "supplies", { pending: false, weight: 9 }),
    ]);
    const b = buildAdjacency([
      edge("a", "b", "supplies", { pending: false, weight: 9 }),
      edge("a", "b", "supplies", { pending: true, weight: 5 }),
    ]);
    expect(a.neighbours.get("a")).toEqual(b.neighbours.get("a"));
    expect(a.neighbours.get("a")?.[0]).toMatchObject({ pending: false, weight: 9 });
    expect(a.degree.get("a")).toBe(1);
  });
});

describe("findEvidencePaths — základ", () => {
  it("najde nejkratší cestu a kroky nesou orientaci uložené hrany", () => {
    // b→a uložené obráceně: cesta a→b musí projít s forward=false.
    const adj = buildAdjacency([edge("b", "a"), edge("b", "c"), edge("a", "d"), edge("d", "c")]);
    const r = findEvidencePaths(adj, "a", "c");
    expect(r.cost).toBe(2);
    expect(r.paths[0].nodeIds).toEqual(["a", "b", "c"]);
    expect(r.paths[0].hops[0]).toMatchObject({ from: "a", to: "b", forward: false });
    expect(r.paths[0].hops[1]).toMatchObject({ from: "b", to: "c", forward: true });
  });

  it("přímá hrana bije okliku; delší cesty se nevracejí jako alternativy", () => {
    const adj = buildAdjacency([edge("a", "c"), edge("a", "b"), edge("b", "c")]);
    const r = findEvidencePaths(adj, "a", "c");
    expect(r.cost).toBe(1);
    expect(nodeSeq(r)).toEqual(["a>c"]);
    expect(r.totalFound).toBe(1);
  });

  it("bez spojení vrací čestnou prázdnotu (paths=[], cost=null)", () => {
    const adj = buildAdjacency([edge("a", "b"), edge("x", "y")]);
    expect(findEvidencePaths(adj, "a", "y")).toEqual({ paths: [], totalFound: 0, capped: false, cost: null });
  });

  it("cesta delší než strop ceny neexistuje", () => {
    const chain: PathEdge[] = [];
    for (let i = 0; i < MAX_COST + 1; i++) chain.push(edge(`n${i}`, `n${i + 1}`));
    const adj = buildAdjacency(chain);
    expect(findEvidencePaths(adj, "n0", `n${MAX_COST + 1}`).cost).toBeNull();
    expect(findEvidencePaths(adj, "n0", `n${MAX_COST}`).cost).toBe(MAX_COST);
  });

  it("src === dst je mimo otázku — prázdný výsledek", () => {
    const adj = buildAdjacency([edge("a", "b")]);
    expect(findEvidencePaths(adj, "a", "a").paths).toEqual([]);
  });
});

describe("findEvidencePaths — hub za dva kroky", () => {
  /** Hvězda kolem `hub`, aby jeho stupeň přesáhl práh. */
  const star = (hub: string, n: number) =>
    Array.from({ length: n }, (_, i) => edge(hub, `${hub}-sat${i}`));

  it("uzel s ≥ hubDegree hranami prodraží cestu přes sebe", () => {
    const edges = [
      edge("a", "hub"),
      edge("hub", "b"),
      edge("a", "m1"),
      edge("m1", "m2"),
      edge("m2", "b"),
      ...star("hub", 6),
    ];
    const viaHub = findEvidencePaths(buildAdjacency(edges), "a", "b", { hubDegree: 6 });
    // hub: 1(vstup hub=2)… cesta a>hub>b = 2+1 = 3; a>m1>m2>b = 1+1+1 = 3 — remíza.
    expect(viaHub.cost).toBe(3);
    expect(nodeSeq(viaHub)).toEqual(["a>hub>b", "a>m1>m2>b"]);
    // Bez penalizace (práh nedosažen) vyhrává hub o krok.
    const cheap = findEvidencePaths(buildAdjacency(edges), "a", "b", { hubDegree: HUB_DEGREE });
    expect(cheap.cost).toBe(2);
    expect(nodeSeq(cheap)).toEqual(["a>hub>b"]);
  });

  it("penalizace se netýká koncových bodů — K hubu cesta vede za 1", () => {
    const edges = [edge("a", "hub"), ...star("hub", 6)];
    const r = findEvidencePaths(buildAdjacency(edges), "a", "hub", { hubDegree: 6 });
    expect(r.cost).toBe(1);
    expect(nodeSeq(r)).toEqual(["a>hub"]);
  });
});

describe("findEvidencePaths — pořadí při stejné délce (otištěné pravidlo)", () => {
  it("1. méně čekajících hran, 2. vyšší supplies částka, 3. abeceda otisku", () => {
    const adj = buildAdjacency([
      // p — čekající hrana; q — ověřeno + peníze; r — ověřeno bez peněz.
      edge("a", "p", "linked_to", { pending: true }),
      edge("p", "b"),
      edge("a", "q"),
      edge("q", "b", "supplies", { weight: 1_000_000 }),
      edge("a", "r"),
      edge("r", "b"),
    ]);
    const r = findEvidencePaths(adj, "a", "b");
    expect(nodeSeq(r)).toEqual(["a>q>b", "a>r>b", "a>p>b"]);
    expect(r.paths[0].moneyCzk).toBe(1_000_000);
    expect(r.paths[0].pendingCount).toBe(0);
    expect(r.paths[2].pendingCount).toBe(1);
  });

  it("úplná remíza padá na abecedu id — jednoznačně a stabilně", () => {
    const adj = buildAdjacency([
      edge("a", "z"),
      edge("z", "b"),
      edge("a", "k"),
      edge("k", "b"),
      edge("a", "m"),
      edge("m", "b"),
    ]);
    expect(nodeSeq(findEvidencePaths(adj, "a", "b"))).toEqual(["a>k>b", "a>m>b", "a>z>b"]);
  });

  it("vrací nejvýš `alternates` cest, totalFound hlásí všechny nalezené", () => {
    const edges: PathEdge[] = [];
    for (let i = 0; i < 5; i++) edges.push(edge("a", `v${i}`), edge(`v${i}`, "b"));
    const r = findEvidencePaths(buildAdjacency(edges), "a", "b");
    expect(r.paths).toHaveLength(ALTERNATES);
    expect(r.totalFound).toBe(5);
    expect(r.capped).toBe(false);
  });

  it("strop výčtu hlásí capped a nezalže v počtu", () => {
    const edges: PathEdge[] = [];
    for (let i = 0; i < 6; i++) edges.push(edge("a", `v${i}`), edge(`v${i}`, "b"));
    const r = findEvidencePaths(buildAdjacency(edges), "a", "b", { enumCap: 4 });
    expect(r.capped).toBe(true);
    expect(r.totalFound).toBe(4);
  });
});

describe("determinismus", () => {
  it("pořadí hran na vstupu nesmí změnit ani bajt výsledku", () => {
    const edges: PathEdge[] = [
      edge("a", "p", "linked_to", { pending: true }),
      edge("p", "b"),
      edge("q", "a"), // schválně obráceně uložené
      edge("q", "b", "supplies", { weight: 500 }),
      edge("a", "r"),
      edge("r", "b"),
      edge("b", "c"),
      edge("x", "y", "co_votes_with"),
    ];
    const baseline = findEvidencePaths(buildAdjacency(edges), "a", "b");
    const reversed = findEvidencePaths(buildAdjacency([...edges].reverse()), "a", "b");
    // Deterministický „zamíchaný" řez: sudé indexy, pak liché.
    const interleaved = findEvidencePaths(
      buildAdjacency([...edges.filter((_, i) => i % 2 === 0), ...edges.filter((_, i) => i % 2 === 1)]),
      "a",
      "b",
    );
    expect(reversed).toEqual(baseline);
    expect(interleaved).toEqual(baseline);
    expect(nodeSeq(baseline)).toEqual(["a>q>b", "a>r>b", "a>p>b"]);
  });
});
