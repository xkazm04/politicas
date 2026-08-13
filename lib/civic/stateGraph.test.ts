import { describe, expect, it } from "vitest";
import { EVENTS, ROLL_CALLS } from "./data";
import {
  buildStateGraph,
  companyId,
  degreeOf,
  FEATURED_VOTES,
  lawId,
  moneyId,
  neighbourhood,
  nodesForRefs,
  partyId,
  personId,
  type StateNodeKind,
  voteId,
} from "./stateGraph";

describe("buildStateGraph — topologie", () => {
  it("žádná hrana nevisí do prázdna a id uzlů se neopakují", () => {
    const graph = buildStateGraph();
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(graph.nodes.length);
    for (const e of graph.edges) {
      expect(ids.has(e.from), `${e.from} -> ${e.to}`).toBe(true);
      expect(ids.has(e.to), `${e.from} -> ${e.to}`).toBe(true);
    }
  });

  it("souřadnice jsou v rozsahu 0..100 a zaokrouhlené na 2 desetinná místa", () => {
    const graph = buildStateGraph();
    for (const n of graph.nodes) {
      expect(n.x, n.id).toBeGreaterThanOrEqual(0);
      expect(n.x, n.id).toBeLessThanOrEqual(100);
      expect(n.y, n.id).toBeGreaterThanOrEqual(0);
      expect(n.y, n.id).toBeLessThanOrEqual(100);
      // SVG souřadnice z výpočtu jinak driftují mezi SSR a CSR a rozbíjejí
      // hydrataci (viz hlavička stateGraph.ts a Hemicycle.tsx).
      expect(n.x, n.id).toBe(Math.round(n.x * 100) / 100);
      expect(n.y, n.id).toBe(Math.round(n.y * 100) / 100);
    }
  });

  it("obsahuje všech šest druhů uzlů — graf slibuje, že se v něm potkává všech pět modulů", () => {
    const graph = buildStateGraph();
    const kinds = new Set(graph.nodes.map((n) => n.kind));
    const expected: StateNodeKind[] = ["person", "company", "money", "party", "vote", "law"];
    for (const k of expected) expect(kinds.has(k), k).toBe(true);
  });

  it("dárcovská hrana vede na skutečnou stranu a zákonná hrana na skutečnou novelu", () => {
    const graph = buildStateGraph();
    const ids = new Set(graph.nodes.map((n) => n.id));
    // MONEY_TIES[1] (Agrofond) je jediná vazba s donorParty — dárce ANO 2011.
    expect(ids.has(partyId("ano"))).toBe(true);
    // h-412 je featured a LAW_CHANGES lc1 na něj odkazuje.
    expect(ids.has(lawId("lc1"))).toBe(true);
  });

  it("hrana z neověřené vazby MONEY_TIES je verified: false, z ověřené je verified: true", () => {
    const graph = buildStateGraph();
    // MONEY_TIES[2] (DK Stav, dvorak-m) je v datech verified: false.
    const unverified = graph.edges.find((e) => e.from === personId("dvorak-m") && e.to === companyId(2));
    expect(unverified?.verified).toBe(false);
    // MONEY_TIES[0] (Silnice MSK, hruska-k) je v datech verified: true.
    const verified = graph.edges.find((e) => e.from === personId("hruska-k") && e.to === companyId(0));
    expect(verified?.verified).toBe(true);
  });

  it("FEATURED_VOTES jsou skutečná hlasování a každé má v grafu aspoň jednu incidentní hranu", () => {
    const graph = buildStateGraph();
    const rcIds = new Set(ROLL_CALLS.map((r) => r.id));
    for (const id of FEATURED_VOTES) {
      expect(rcIds.has(id), id).toBe(true);
      const node = voteId(id);
      const incident = graph.edges.filter((e) => e.from === node || e.to === node);
      expect(incident.length, id).toBeGreaterThan(0);
    }
  });
});

describe("nodesForRefs", () => {
  it("vrací jen id, která graf skutečně kreslí", () => {
    const graph = buildStateGraph();
    // h-391 je platné ROLL_CALLS id, ale FEATURED_VOTES bere jen první tři
    // ve výchozím pořadí (h-412, h-409, h-398) — h-391 do výřezu nepatří,
    // takže uzel v postaveném grafu neexistuje.
    expect(FEATURED_VOTES).not.toContain("h-391");
    expect(nodesForRefs({ rollCalls: ["h-391"] }, graph)).toEqual([]);
  });

  it("pro undefined refs vrací []", () => {
    const graph = buildStateGraph();
    expect(nodesForRefs(undefined, graph)).toEqual([]);
  });

  it("deduplikuje opakované odkazy na stejný uzel", () => {
    const graph = buildStateGraph();
    const out = nodesForRefs({ mps: ["hruska-k", "hruska-k"], ties: [0, 0] }, graph);
    expect(out).toEqual([personId("hruska-k"), companyId(0), moneyId(0)]);
  });

  it("každá událost s refs se namapuje na aspoň jeden uzel v grafu", () => {
    const graph = buildStateGraph();
    for (const e of EVENTS) {
      if (!e.refs) continue;
      const nodes = nodesForRefs(e.refs, graph);
      // e4 odkazuje mimo jiné na rollCalls: ["h-391"], které leží mimo výřez
      // FEATURED_VOTES (viz test výše) — řádek přesto zůstává napojený, protože
      // refs.mps: ["novakova-p"] vždy resolvuje na uzel osoby (osoby jsou v grafu
      // nepodmíněně všechny). Žádná událost ve vzorku neodkazuje POUZE mimo výřez.
      expect(nodes.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe("neighbourhood a degreeOf", () => {
  it("okolí p:hruska-k obsahuje jeho samotného a přímé sousedy, ne uzel o dva kroky dál", () => {
    const graph = buildStateGraph();
    const center = personId("hruska-k");
    const n = neighbourhood(center, graph.edges);
    expect(n.has(center)).toBe(true);
    expect(n.has(companyId(0))).toBe(true); // Silnice MSK — přímá vazba
    expect(n.has(companyId(1))).toBe(true); // Agrofond — přímá vazba
    expect(n.has(voteId("h-412"))).toBe(true); // proti přijatému návrhu
    expect(n.has(voteId("h-409"))).toBe(true); // rebelie
    expect(n.has(voteId("h-398"))).toBe(true); // proti přijatému návrhu
    expect(n.size).toBe(6);
    // m:0 (peníze za Silnice MSK) visí až za firmou c:0 — dva kroky od osoby.
    expect(n.has(moneyId(0))).toBe(false);
  });

  it("degreeOf p:hruska-k odpovídá ručně spočtenému počtu hran (2 peněžní vazby + 3 hlasování)", () => {
    const graph = buildStateGraph();
    expect(degreeOf(personId("hruska-k"), graph.edges)).toBe(5);
  });
});

describe("vzorek nerazí adresu entity", () => {
  // Protějšek k features/dashboard/stateSlice.test.ts („odkazy vedou na reálné
  // cíle"). Ten pin drží REÁLNÝ výřez; tady se drží ta opačná — a stejně
  // důležitá — půlka: vzorkový graf nesmí nabídnout adresu konkrétní entity,
  // protože jeho ids jsou vymyšlená. Vzorek se kreslí právě tehdy, když je
  // store nedostupný, takže mrtvý odkaz by dopadl na čtenáře v tu nejhorší
  // chvíli. StateGraphCanvas navíc `href` vykresluje BEZ `rule` brány (na
  // rozdíl od deníku a sledování hned vedle), takže tenhle test je jediné
  // místo, kde se to dá uhlídat.
  const MODULE_INDEXES = new Set([
    "/zebricek",
    "/penize",
    "/hlasovani",
    "/zakony",
  ]);

  it("každý odkaz míří na plochu modulu, žádný na konkrétní entitu", () => {
    const graph = buildStateGraph();
    const hrefs = graph.nodes.map((n) => n.href).filter((h): h is string => Boolean(h));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(MODULE_INDEXES.has(href)).toBe(true);
    }
  });

  it("žádný odkaz nenese id vzorkového uzlu — /poslanec/<slug> by skončil na notFound()", () => {
    const graph = buildStateGraph();
    for (const n of graph.nodes) {
      if (!n.href) continue;
      // Segment navíc za plochou modulu = adresa entity.
      expect(n.href.split("/").filter(Boolean)).toHaveLength(1);
      if (n.kind === "person" && "mpId" in n && n.mpId) {
        expect(n.href).not.toContain(n.mpId);
      }
    }
  });
});
