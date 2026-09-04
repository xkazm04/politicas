// Rozdíl dvou verzí citovaného pohledu — fixture nad KANONICKÝM obsahem,
// tedy nad tím, co hashuje `hashViewContent`. Testy drží čtyři pravidla, na
// kterých rozdíl stojí: hrana se pozná podle klíče (ne podle pořadí), váhy se
// nezaokrouhlují, chybějící není nula, a nesrovnatelné verze se přiznají místo
// aby vrátily prázdno.

import { describe, expect, it } from "vitest";
import { diffViews, edgeKey } from "./diffViews";
import type { GraphEdge } from "./graphTypes";

const e = (src: string, dst: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  src,
  dst,
  rel: "linked_to",
  weight: 0.87,
  pending: false,
  ...over,
});

const trasa = (edges: GraphEdge[], nodeIds: string[] = []) => ({
  kind: "trasa",
  trail: { key: "t", columns: [], nodes: nodeIds.map((id) => ({ id })), edges },
});

const cesta = (path: { nodeIds: string[]; edges: GraphEdge[] } | null) => ({
  kind: "cesta",
  from: "a",
  to: "z",
  path,
});

const uzel = (facts: Array<{ label: string; value: string }>) => ({
  kind: "uzel",
  detail: { node: { id: "n1" }, facts },
});

describe("diffViews — trasa", () => {
  it("stejný obsah v jiném pořadí NENÍ změna: hrana se pozná podle klíče", () => {
    const a = trasa([e("a", "b"), e("b", "c")], ["a", "b", "c"]);
    const b = trasa([e("b", "c"), e("a", "b")], ["c", "b", "a"]);
    const d = diffViews(a, b);
    expect(d.identical).toBe(true);
    expect(d.incomparable).toBe(false);
  });

  it("přibylá a ubylá hrana se pojmenují, ne spočítají", () => {
    const d = diffViews(trasa([e("a", "b")]), trasa([e("a", "b"), e("b", "c")]));
    expect(d.addedEdges.map((x) => x.key)).toEqual([edgeKey(e("b", "c"))]);
    expect(d.removedEdges).toEqual([]);
    expect(d.identical).toBe(false);

    const back = diffViews(trasa([e("a", "b"), e("b", "c")]), trasa([e("a", "b")]));
    expect(back.removedEdges.map((x) => x.key)).toEqual([edgeKey(e("b", "c"))]);
  });

  it("překlopení lidské brány je vlastní zjištění, ne změna váhy", () => {
    const d = diffViews(trasa([e("a", "b", { pending: true })]), trasa([e("a", "b", { pending: false })]));
    expect(d.changedEdges).toHaveLength(1);
    expect(d.changedEdges[0].gateFlipped).toBe(true);
    expect(d.changedEdges[0].weightChanged).toBe(false);
    // obě strany zůstávají čitelné — verdikt „moved" musí unést screenshot
    expect(d.changedEdges[0].then.pending).toBe(true);
    expect(d.changedEdges[0].now.pending).toBe(false);
  });

  it("váhy se NEZAOKROUHLUJÍ: 0,87 → 0,88 je rozdíl", () => {
    const d = diffViews(trasa([e("a", "b", { weight: 0.87 })]), trasa([e("a", "b", { weight: 0.88 })]));
    expect(d.changedEdges[0].weightChanged).toBe(true);
    expect(d.changedEdges[0].then.weight).toBe(0.87);
    expect(d.changedEdges[0].now.weight).toBe(0.88);
  });

  it("chybějící váha proti číslu JE rozdíl (missing is not zero)", () => {
    const d = diffViews(trasa([e("a", "b", { weight: null })]), trasa([e("a", "b", { weight: 0 })]));
    expect(d.changedEdges[0].weightChanged).toBe(true);
  });

  it("uzly, které přibyly a zmizely, se jmenují", () => {
    const d = diffViews(trasa([], ["a", "b"]), trasa([], ["b", "c"]));
    expect(d.addedNodes).toEqual(["c"]);
    expect(d.removedNodes).toEqual(["a"]);
  });
});

describe("diffViews — cesta", () => {
  it("jiná POSLOUPNOST kroků je přesměrování, i když je množina uzlů táž", () => {
    const d = diffViews(
      cesta({ nodeIds: ["a", "m", "z"], edges: [] }),
      cesta({ nodeIds: ["a", "z", "m"], edges: [] }),
    );
    expect(d.pathRerouted).toBe(true);
    expect(d.identical).toBe(false);
  });

  it("táž cesta beze změn není přesměrování", () => {
    const path = { nodeIds: ["a", "m", "z"], edges: [e("a", "m"), e("m", "z")] };
    expect(diffViews(cesta(path), cesta({ ...path })).identical).toBe(true);
  });

  it("cesta, kterou dnešní graf pod tímtéž indexem nedokládá, je přesměrování s pojmenovanou ztrátou", () => {
    const d = diffViews(cesta({ nodeIds: ["a", "z"], edges: [e("a", "z")] }), cesta(null));
    expect(d.pathRerouted).toBe(true);
    expect(d.removedEdges.map((x) => x.key)).toEqual([edgeKey(e("a", "z"))]);
    expect(d.removedNodes).toEqual(["a", "z"]);
    expect(d.addedEdges).toEqual([]);
  });
});

describe("diffViews — uzel", () => {
  it("přepsaný fakt nese obě strany; nový a zmizelý fakt se rozliší od změny", () => {
    const d = diffViews(
      uzel([
        { label: "IČO", value: "123" },
        { label: "Zanikl", value: "ano" },
      ]),
      uzel([
        { label: "IČO", value: "456" },
        { label: "Nový", value: "x" },
      ]),
    );
    const byLabel = Object.fromEntries(d.changedFacts.map((f) => [f.label, f]));
    expect(byLabel["IČO"]).toEqual({ label: "IČO", then: "123", now: "456" });
    expect(byLabel["Nový"]).toEqual({ label: "Nový", then: null, now: "x" });
    expect(byLabel["Zanikl"]).toEqual({ label: "Zanikl", then: "ano", now: null });
  });
});

describe("diffViews — co se porovnat nedá", () => {
  it("chybějící tehdejší verze je `incomparable`, NIKDY prázdný rozdíl", () => {
    // Tohle je celý smysl toho pole: „nic se nezměnilo" a „tehdejší verzi
    // neumíme přehrát" se nesmějí sázet stejně.
    const d = diffViews(null, trasa([e("a", "b")]));
    expect(d.incomparable).toBe(true);
    expect(d.identical).toBe(false);
  });

  it("dva různé druhy pohledu se neporovnávají", () => {
    const d = diffViews(uzel([]), trasa([]));
    expect(d.incomparable).toBe(true);
    expect(d.addedEdges).toEqual([]);
  });
});
