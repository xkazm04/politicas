/*
 * Fixture testy agregace provenience grafu.
 *
 * Dvě „mixed" se nesmí slít: rozpolcenost NAPŘÍČ relacemi je normální stav
 * postupně přepočítávaného grafu, rozpolcenost UVNITŘ jedné relace je
 * poloviční přepočet — a jen ta druhá je poplach.
 */

import { describe, expect, it } from "vitest";
import { summarizeGraphProvenance, type ProvenancedEdge } from "./graphProvenance";

const e = (rel: string, prov?: Record<string, unknown> | null): ProvenancedEdge => ({
  rel,
  provenance: prov ?? null,
});

const P68 = { pass: 68, ref: "kg:tender/v1", method: "deterministic" };
const P70 = { pass: 70, ref: "kg:tender/v2", method: "deterministic" };

describe("summarizeGraphProvenance — jedna relace", () => {
  it("uniform: jedna kombinace, vydá pass i ref", () => {
    const g = summarizeGraphProvenance([e("supplies", P68), e("supplies", P68)]);
    expect(g.rels).toHaveLength(1);
    expect(g.rels[0]).toMatchObject({
      rel: "supplies",
      state: "uniform",
      pass: 68,
      ref: "kg:tender/v1",
      method: "deterministic",
      coverage: { stamped: 2, read: 2 },
    });
    expect(g.state).toBe("uniform");
  });

  it("mixed UVNITŘ relace: žádný jeden průchod se nevydá a relace se pojmenuje", () => {
    const g = summarizeGraphProvenance([e("supplies", P68), e("supplies", P70), e("supplies", P70)]);
    expect(g.rels[0].state).toBe("mixed");
    // Rozpolcená populace ŽÁDNÝ jeden pass nemá — a nesmí si ho vymyslet.
    expect(g.rels[0].pass).toBeNull();
    expect(g.rels[0].ref).toBeNull();
    // Varianty i s populací, count desc — poloviční přepočet je vidět v číslech.
    expect(g.rels[0].variants).toEqual([
      { pass: 70, ref: "kg:tender/v2", method: "deterministic", count: 2 },
      { pass: 68, ref: "kg:tender/v1", method: "deterministic", count: 1 },
    ]);
    expect(g.mixedWithinRel).toEqual(["supplies"]);
  });

  it("absent: chybějící provenience není průchod č. 0 a nedopočítává se", () => {
    const g = summarizeGraphProvenance([e("about"), e("about")]);
    expect(g.rels[0]).toMatchObject({ state: "absent", pass: null, ref: null });
    expect(g.rels[0].variants).toEqual([]);
    expect(g.rels[0].coverage).toEqual({ stamped: 0, read: 2 });
    expect(g.state).toBe("absent");
  });

  it("prázdný objekt provenience se nepočítá jako orazítkovaná hrana", () => {
    const g = summarizeGraphProvenance([e("about", {}), e("about", { pass: null })]);
    expect(g.rels[0].coverage).toEqual({ stamped: 0, read: 2 });
    expect(g.rels[0].state).toBe("absent");
  });

  it("částečné razítko (jen ref) je pořád razítko", () => {
    const g = summarizeGraphProvenance([e("about", { ref: "kg:themes/v1" })]);
    expect(g.rels[0]).toMatchObject({ state: "uniform", pass: null, ref: "kg:themes/v1" });
    expect(g.rels[0].coverage).toEqual({ stamped: 1, read: 1 });
  });
});

describe("summarizeGraphProvenance — celý graf", () => {
  it("mixed NAPŘÍČ relacemi je informace, ne poplach: mixedWithinRel zůstává prázdné", () => {
    // Přesně dnešní stav skladu: průchod tenderů přistál na grafu, který pro
    // ostatní relace nese starší průchody.
    const g = summarizeGraphProvenance([e("supplies", P68), e("linked_to", P70), e("linked_to", P70)]);
    expect(g.state).toBe("mixed");
    expect(g.pass).toBeNull();
    expect(g.mixedWithinRel).toEqual([]);
    expect(g.rels.every((r) => r.state === "uniform")).toBe(true);
  });

  it("relace se řadí podle počtu hran, remíza abecedně — hlášení jde diffovat", () => {
    const g = summarizeGraphProvenance([
      e("zzz", P68),
      e("aaa", P68),
      e("many", P68),
      e("many", P68),
    ]);
    expect(g.rels.map((r) => r.rel)).toEqual(["many", "aaa", "zzz"]);
  });

  it("pokrytí se sčítá přes všechny relace a počítá i neorazítkované", () => {
    const g = summarizeGraphProvenance([e("supplies", P68), e("about"), e("about")]);
    expect(g.coverage).toEqual({ stamped: 1, read: 3 });
  });

  it("determinismus: pořadí hran na vstupu nesmí změnit ani bajt výsledku", () => {
    const edges = [e("supplies", P68), e("linked_to", P70), e("supplies", P70), e("about")];
    const baseline = summarizeGraphProvenance(edges);
    expect(summarizeGraphProvenance([...edges].reverse())).toEqual(baseline);
  });

  it("prázdný graf: absent, nulové pokrytí, žádné vymyšlené číslo", () => {
    expect(summarizeGraphProvenance([])).toEqual({
      rels: [],
      state: "absent",
      pass: null,
      ref: null,
      mixedWithinRel: [],
      coverage: { stamped: 0, read: 0 },
    });
  });
});
