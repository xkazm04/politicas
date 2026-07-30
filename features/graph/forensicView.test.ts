import { describe, expect, it } from "vitest";
import { edgeKey, forensicEdges, hoverCardModel, MAX_ROWS } from "./forensicView";
import type { GraphEdge, GraphNode } from "./graphTypes";

const edge = (src: string, dst: string, rel: string, pending: boolean): GraphEdge => ({
  src,
  dst,
  rel,
  weight: null,
  pending,
});

const node = (id: string): GraphNode => ({ id, kind: "person", label: `uzel ${id}`, degree: 0 });

const FIXTURE: GraphEdge[] = [
  edge("a", "b", "supplies", false),
  edge("a", "c", "supplies", true),
  edge("b", "c", "sponsors", false),
  edge("c", "d", "linked_to", true),
  edge("a", "d", "linked_to", true),
];

describe("forensicEdges — výchozí forenzní pohled: jen ověřené hrany", () => {
  it("čekající hrany odfiltruje a spočítá — nemizí mlčky", () => {
    const v = forensicEdges(FIXTURE);
    expect(v.edges.map(edgeKey)).toEqual(["a|supplies|b", "b|sponsors|c"]);
    expect(v.hiddenPending).toBe(3);
    expect(v.keptPending).toBe(0);
  });

  it("ověřené hrany projdou beze změny a v původním pořadí", () => {
    const v = forensicEdges(FIXTURE);
    expect(v.edges[0]).toBe(FIXTURE[0]);
    expect(v.edges[1]).toBe(FIXTURE[2]);
  });

  it("hrany vyžádané čočky se drží — vyžádaná odpověď se nefiltruje", () => {
    const keep = new Set([edgeKey(FIXTURE[1])]);
    const v = forensicEdges(FIXTURE, keep);
    expect(v.edges.map(edgeKey)).toEqual(["a|supplies|b", "a|supplies|c", "b|sponsors|c"]);
    expect(v.keptPending).toBe(1);
    expect(v.hiddenPending).toBe(2);
  });

  it("graf bez čekajících hran projde celý", () => {
    const clean = FIXTURE.filter((e) => !e.pending);
    const v = forensicEdges(clean);
    expect(v.edges).toHaveLength(clean.length);
    expect(v.hiddenPending).toBe(0);
    expect(v.keptPending).toBe(0);
  });
});

describe("hoverCardModel — stavy kontroly bez klikání", () => {
  it("počítá ověřené a čekající hrany uzlu z NEfiltrovaného seznamu", () => {
    const m = hoverCardModel(node("a"), FIXTURE);
    expect(m.verified).toBe(1);
    expect(m.pending).toBe(2);
  });

  it("rozpad po relacích: sestupně podle objemu, remíza abecedně — deterministicky", () => {
    const m = hoverCardModel(node("a"), FIXTURE);
    // supplies: 1 ověřená + 1 čekající (2) > linked_to: 1 čekající (1)
    expect(m.rows).toEqual([
      { rel: "supplies", verified: 1, pending: 1 },
      { rel: "linked_to", verified: 0, pending: 1 },
    ]);
    expect(m.more).toBe(0);
  });

  it("remíza v objemu se láme abecedně podle relace", () => {
    const edges = [edge("x", "y", "sponsors", false), edge("x", "z", "amends", false)];
    const m = hoverCardModel(node("x"), edges);
    expect(m.rows.map((r) => r.rel)).toEqual(["amends", "sponsors"]);
  });

  it("víc relací než MAX_ROWS se ořízne a přizná v `more`", () => {
    const rels = ["r1", "r2", "r3", "r4", "r5", "r6"];
    const edges = rels.map((rel, i) => edge("x", `y${i}`, rel, false));
    const m = hoverCardModel(node("x"), edges);
    expect(m.rows).toHaveLength(MAX_ROWS);
    expect(m.more).toBe(rels.length - MAX_ROWS);
  });

  it("uzel bez hran: prázdný rozpad, nuly — karta nelže", () => {
    const m = hoverCardModel(node("nikde"), FIXTURE);
    expect(m.verified).toBe(0);
    expect(m.pending).toBe(0);
    expect(m.rows).toEqual([]);
    expect(m.more).toBe(0);
  });

  it("hrana se počítá uzlu na OBOU koncích", () => {
    const m = hoverCardModel(node("c"), FIXTURE);
    expect(m.verified).toBe(1); // b→c sponsors
    expect(m.pending).toBe(2); // a→c supplies, c→d linked_to
  });
});
