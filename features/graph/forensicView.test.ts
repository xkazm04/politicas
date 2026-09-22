import { describe, expect, it } from "vitest";
import { edgeKey, forensicEdges, hoverCardModel, MAX_ROWS } from "./forensicView";
import type { GateStatus, GraphEdge, GraphNode } from "./graphTypes";

/** `pending` je ODVOZENÉ z brány — fixture ho nesmí umět nastavit nezávisle,
 *  jinak by testovala tvar, který loader nikdy nevyrobí. */
const gated = (src: string, dst: string, rel: string, gate: GateStatus | null): GraphEdge => ({
  src,
  dst,
  rel,
  weight: null,
  pending: gate === "pending_review",
  gate,
  provenance: null,
});

const edge = (src: string, dst: string, rel: string, pending: boolean): GraphEdge =>
  gated(src, dst, rel, pending ? "pending_review" : "verified");

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
    expect(v.hiddenRejected).toBe(0);
    expect(v.keptRejected).toBe(0);
  });
});

/*
 * TŘETÍ KOŠ (2026-09-04) — tenhle blok před opravou PADAL.
 *
 * Zamítnutá hrana nesla `pending: false`, takže „jen ověřená" forenzní krajina
 * ji propouštěla jako ověřenou: režim, jehož jediný smysl je ukázat prokázané
 * vazby, ukazoval to jediné tvrzení, o kterém víme, že neplatí.
 */
describe("forensicEdges — zamítnuté se skrývají ZVLÁŠŤ, nikdy jako ověřené", () => {
  const WITH_REJECTED: GraphEdge[] = [
    gated("a", "b", "supplies", "verified"),
    gated("a", "c", "linked_to", "pending_review"),
    gated("a", "d", "linked_to", "rejected"),
    gated("d", "e", "linked_to", "rejected"),
  ];

  it("zamítnutá hrana v krajině neprojde a počítá se do vlastního koše", () => {
    const v = forensicEdges(WITH_REJECTED);
    expect(v.edges.map(edgeKey)).toEqual(["a|supplies|b"]);
    expect(v.hiddenPending).toBe(1);
    expect(v.hiddenRejected).toBe(2);
    expect(v.keptRejected).toBe(0);
  });

  it("zamítnutý krok VYŽÁDANÉ čočky se kreslí — ale zůstává označený a spočítaný", () => {
    // Kurátorská trasa se nefiltruje (vynechaný krok vyžádané odpovědi by byl
    // lež), takže hrana projde — se svým `gate`, ne přestrojená za ověřenou.
    const keep = new Set([edgeKey(WITH_REJECTED[2])]);
    const v = forensicEdges(WITH_REJECTED, keep);
    expect(v.edges.map(edgeKey)).toEqual(["a|supplies|b", "a|linked_to|d"]);
    expect(v.edges[1].gate).toBe("rejected");
    expect(v.keptRejected).toBe(1);
    expect(v.hiddenRejected).toBe(1);
  });

  it("negated relace (gate=null) se neskrývá a netváří se jako ověřená", () => {
    const v = forensicEdges([gated("a", "b", "co_votes_with", null)]);
    expect(v.edges).toHaveLength(1);
    expect(v.hiddenPending).toBe(0);
    expect(v.hiddenRejected).toBe(0);
    expect(hoverCardModel(node("a"), [gated("a", "b", "co_votes_with", null)])).toMatchObject({
      verified: 0,
      ungated: 1,
    });
  });

  it("karta uzlu má pro zamítnuté vlastní sloupec, nepřičítá je k ověřeným", () => {
    const m = hoverCardModel(node("a"), WITH_REJECTED);
    expect(m.verified).toBe(1);
    expect(m.pending).toBe(1);
    // d→e je zamítnutá, ale uzle „a" se netýká — karta počítá hrany UZLU.
    expect(m.rejected).toBe(1);
    expect(m.rows).toEqual([
      { rel: "linked_to", verified: 0, pending: 1, rejected: 1, ungated: 0 },
      { rel: "supplies", verified: 1, pending: 0, rejected: 0, ungated: 0 },
    ]);
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
      { rel: "supplies", verified: 1, pending: 1, rejected: 0, ungated: 0 },
      { rel: "linked_to", verified: 0, pending: 1, rejected: 0, ungated: 0 },
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
