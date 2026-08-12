import { describe, expect, it } from "vitest";
import { GRAPH_EDGES, GRAPH_NODES } from "@/lib/civic/data";
import { neighbourStep, rovingNodeId } from "@/features/dashboard/graphTraversal";
import { degreeOf, moneyNodeHref, traversalEdges, traversalNodes } from "./graphNav";

describe("moneyNodeHref — adresa spisu jen z TVARU id", () => {
  it("uzel poslance vede do jeho peněžního spisu", () => {
    expect(moneyNodeHref("psp:person:6881")).toBe("/penize/6881");
  });

  it("uzel firmy vede do spisu firmy, IČO se kanonizuje na osm číslic", () => {
    expect(moneyNodeHref("company:ico:46347534")).toBe("/penize/firma/46347534");
    // Nekanonické id z dřívějšího ingestu (memory/ico-node-id-canonical-form.md):
    // adresa se skládá z KANONICKÉHO tvaru, ne z toho, co v id náhodou stojí.
    expect(moneyNodeHref("company:ico:2867681")).toBe("/penize/firma/02867681");
  });

  it("ODMÍTÁ vše, co nemá známý tvar — vymyšlená entita nesmí razit adresu", () => {
    for (const id of [
      undefined,
      null,
      "",
      "mp", // vzorkový uzel
      "co1",
      "k2",
      "person", // layoutové id reálného obrázku
      "c0",
      "m1",
      "psp:person:abc",
      "company:ico:123456789", // devět číslic není IČO
      "psp:organ:172",
      "/penize/6881",
    ]) {
      expect(moneyNodeHref(id), String(id)).toBeNull();
    }
  });

  it("KAŽDÝ uzel označeného vzorku dostane null — refusal by shape, ne větev v renderu", () => {
    for (const n of GRAPH_NODES) expect(moneyNodeHref(n.id), n.id).toBeNull();
  });
});

describe("adaptér na sdílené pravidlo procházení", () => {
  it("ořezává uzel na {id,x,y} a zachovává pořadí kreslení", () => {
    const nav = traversalNodes(GRAPH_NODES);
    expect(nav).toHaveLength(GRAPH_NODES.length);
    expect(nav.map((n) => n.id)).toEqual(GRAPH_NODES.map((n) => n.id));
    expect(Object.keys(nav[0]).sort()).toEqual(["id", "x", "y"]);
  });

  it("ořezává hranu na {from,to} — popisek ani „trail\" do navigace nevstupují", () => {
    const nav = traversalEdges(GRAPH_EDGES);
    expect(nav).toHaveLength(GRAPH_EDGES.length);
    expect(Object.keys(nav[0]).sort()).toEqual(["from", "to"]);
  });

  it("po ořezu chodí IMPORTOVANÉ pravidlo po hranách vzorkového grafu", () => {
    const nodes = traversalNodes(GRAPH_NODES);
    const edges = traversalEdges(GRAPH_EDGES);
    // „mp" (10,46) má sousedy co1 (38,22) a co2 (38,72) — vpravo nahoru a vpravo dolů.
    expect(neighbourStep("mp", "ArrowUp", nodes, edges)).toBe("co1");
    expect(neighbourStep("mp", "ArrowDown", nodes, edges)).toBe("co2");
    // Vlevo od poslance není nic — klávesa nesmí nic udělat (žádné zabalení).
    expect(neighbourStep("mp", "ArrowLeft", nodes, edges)).toBeNull();
    // …a krok se vrací po téže hraně zpět.
    expect(neighbourStep("co1", "ArrowLeft", nodes, edges)).toBe("mp");
  });

  it("tabstop drží paměť, jinak první uzel v pořadí kreslení", () => {
    const nodes = traversalNodes(GRAPH_NODES);
    expect(rovingNodeId(null, null, nodes)).toBe(GRAPH_NODES[0].id);
    expect(rovingNodeId("k2", null, nodes)).toBe("k2");
    // Uzel, který obrázek nekreslí, tabstop nedostane.
    expect(rovingNodeId("neexistuje", null, nodes)).toBe(GRAPH_NODES[0].id);
  });
});

describe("degreeOf — stupeň z hran, které obrázek OPRAVDU kreslí", () => {
  it("počítá obě orientace hrany", () => {
    const edges = traversalEdges(GRAPH_EDGES);
    expect(degreeOf("mp", edges)).toBe(2); // mp→co1, mp→co2
    expect(degreeOf("co2", edges)).toBe(3); // mp→co2, co2→k2, co2→party
    expect(degreeOf("neexistuje", edges)).toBe(0);
  });
});
