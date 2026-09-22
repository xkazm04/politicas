/*
 * HLÁŠENÍ, NE JEN KONTROLA — tabulka provenience nad fixture korpusem.
 *
 * Test, který svůj výsledek VYTISKNE. Živý sklad tenhle worktree nemá (běží na
 * fixture a na PGlite šabloně), takže „per-rel provenance table" nemůže být
 * měření skutečného grafu a NEBUDE se za něj vydávat: je to tvar té tabulky
 * nad korpusem, který sem sáhne, plus důkaz, že rozpolcenost uvnitř relace se
 * pozná jako poplach a napříč relacemi jako běžný stav.
 *
 * Až se totéž pustí nad `.pglite`, čísla přijdou z
 * `select rel, provenance->>'pass', provenance->>'ref', count(*) from kg_edge
 *  group by 1,2,3` — a JEDEN dotaz i JEDNA agregace, ne dvě.
 */

import { describe, expect, it } from "vitest";
import { summarizeGraphProvenance, type ProvenancedEdge } from "./graphProvenance";

/**
 * Fixture korpus ve tvaru dnešního skladu: průchod tenderů (68) přistál na
 * grafu, který pro ostatní relace nese starší průchody, a jedna relace je
 * uprostřed přepočtu.
 */
const CORPUS: ProvenancedEdge[] = [
  ...Array.from({ length: 7 }, () => ({
    rel: "procures",
    provenance: { pass: 68, ref: "kg:tender/v1", method: "deterministic" },
  })),
  ...Array.from({ length: 4 }, () => ({
    rel: "supplies",
    provenance: { pass: 61, ref: "kg:contracts/v4", method: "deterministic" },
  })),
  // linked_to je uprostřed přepočtu — POPLACH, ne informace.
  ...Array.from({ length: 3 }, () => ({
    rel: "linked_to",
    provenance: { pass: 61, ref: "kg:ties/v2", method: "verdict" },
  })),
  ...Array.from({ length: 2 }, () => ({
    rel: "linked_to",
    provenance: { pass: 68, ref: "kg:ties/v3", method: "verdict" },
  })),
  // about nenese razítko vůbec — a to není průchod č. 0.
  ...Array.from({ length: 2 }, () => ({ rel: "about", provenance: null })),
];

describe("tabulka provenience nad fixture korpusem", () => {
  const g = summarizeGraphProvenance(CORPUS);

  it("vytiskne per-rel tabulku a přibije její tvar", () => {
    const table = g.rels.map((r) => ({
      rel: r.rel,
      state: r.state,
      pass: r.pass,
      ref: r.ref,
      coverage: `${r.coverage.stamped}/${r.coverage.read}`,
      variants: r.variants.length,
    }));
    // Hlášení je smysl tohoto testu — proto se tiskne, ne jen tvrdí.
    console.table(table);

    expect(table).toEqual([
      { rel: "procures", state: "uniform", pass: 68, ref: "kg:tender/v1", coverage: "7/7", variants: 1 },
      { rel: "linked_to", state: "mixed", pass: null, ref: null, coverage: "5/5", variants: 2 },
      { rel: "supplies", state: "uniform", pass: 61, ref: "kg:contracts/v4", coverage: "4/4", variants: 1 },
      { rel: "about", state: "absent", pass: null, ref: null, coverage: "0/2", variants: 0 },
    ]);
  });

  it("napříč relacemi je mixed informace; uvnitř relace je to poplach", () => {
    expect(g.state).toBe("mixed");
    // Souhrn NEVYDÁ jeden pass nad rozpolcenou populací…
    expect(g.pass).toBeNull();
    // …a poplach ukazuje přesně na tu jednu relaci, která je rozpolcená sama
    // v sobě — ne na tři, které jen píší různé průchody.
    expect(g.mixedWithinRel).toEqual(["linked_to"]);
    expect(g.coverage).toEqual({ stamped: 16, read: 18 });
  });

  it("varianty rozpolcené relace nesou svou populaci, ne jen svůj počet", () => {
    const linked = g.rels.find((r) => r.rel === "linked_to")!;
    expect(linked.variants).toEqual([
      { pass: 61, ref: "kg:ties/v2", method: "verdict", count: 3 },
      { pass: 68, ref: "kg:ties/v3", method: "verdict", count: 2 },
    ]);
  });
});
