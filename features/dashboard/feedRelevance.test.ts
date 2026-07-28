// Pravidlo relevance zaměřovače u vzorkového pásu provozu. Hlídá PRAVIDLO
// (podmět podle druhu události), ne dnešní obsah vzorku.

import { describe, expect, it } from "vitest";
import { EVENTS } from "@/lib/civic/data";
import { buildStateGraph, companyId, lawId, personId, voteId } from "@/lib/civic/stateGraph";
import { primaryNodeForEvent } from "./feedRelevance";

const graph = buildStateGraph();
const byId = (id: string) => EVENTS.find((e) => e.id === id)!;

describe("primaryNodeForEvent — podmět podle druhu události", () => {
  it("peněžní událost připne FIRMU, i když je poslanec v refs první", () => {
    const e = EVENTS.find((x) => x.kind === "money" && (x.refs?.ties?.length ?? 0) > 0)!;
    expect(e.refs?.mps?.length ?? 0).toBeGreaterThan(0); // poslanec v refs je
    expect(primaryNodeForEvent(e, graph)).toBe(companyId(e.refs!.ties![0]));
  });

  it("událost o hlasování připne HLASOVÁNÍ", () => {
    const e = EVENTS.find((x) => x.kind === "vote" && (x.refs?.rollCalls?.length ?? 0) > 0)!;
    expect(primaryNodeForEvent(e, graph)).toBe(voteId(e.refs!.rollCalls![0]));
  });

  it("událost o zákonu připne ZÁKON", () => {
    const e = EVENTS.find((x) => x.kind === "law" && (x.refs?.lawChanges?.length ?? 0) > 0)!;
    expect(primaryNodeForEvent(e, graph)).toBe(lawId(e.refs!.lawChanges![0]));
  });

  it("událost o skóre připne POSLANCE", () => {
    const e = EVENTS.find((x) => x.kind === "score" && (x.refs?.mps?.length ?? 0) > 0);
    if (!e) return; // vzorek takovou událost mít nemusí
    expect(primaryNodeForEvent(e, graph)).toBe(personId(e.refs!.mps![0]));
  });

  it("událost bez refs nemá co připnout", () => {
    const e = EVENTS.find((x) => !x.refs);
    if (!e) return;
    expect(primaryNodeForEvent(e, graph)).toBeNull();
  });

  it("uzel, který výřez nekreslí, se NENAHRAZUJE — vrací se null", () => {
    const e = { ...byId(EVENTS[0].id), kind: "vote" as const, refs: { rollCalls: ["neexistuje"] } };
    expect(primaryNodeForEvent(e, graph)).toBeNull();
  });

  it("každý vrácený uzel je ve výřezu skutečně nakreslený", () => {
    const drawn = new Set(graph.nodes.map((n) => n.id));
    for (const e of EVENTS) {
      const id = primaryNodeForEvent(e, graph);
      if (id !== null) expect(drawn.has(id), `${e.id} → ${id}`).toBe(true);
    }
  });
});
