import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Atlas měří pokrytí provenancí nad PEVNÝM seznamem tabulek a jeho hlavička
 * říká „týž jako RUN_TABLES v repositories/ledger.ts". Do 2026-09-06 to držel
 * jen ten komentář: RUN_TABLES není exportováno, takže atlas nese vlastní opis
 * (ENTITY_TABLES + GRAPH_TABLES) a třetí opis leží v lib/testing/sentinel/facts.ts.
 * Pečeť už jednou rostla (kg_node/kg_edge, 2026-09-04) — tenhle test je brána,
 * která při další změně pečeti shodí atlas místo toho, aby tiše měřil užší
 * množinu, než jakou pečeť kryje. Čte se ZDROJ, ne export: ledger je jiný
 * kontext a jeho konstanta zůstává modulově soukromá. */

const arrayLiteral = (src: string, name: string): string[] => {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const`));
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].replace(/\/\/.*$/gm, "").matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
};

const atlas = readFileSync("features/atlas/getAtlasData.ts", "utf8");
const ledger = readFileSync("lib/db/pglite/repositories/ledger.ts", "utf8");

describe("atlas měří právě ty tabulky, které kryje pečeť ingest běhu", () => {
  it("ENTITY_TABLES ∪ GRAPH_TABLES se rovná RUN_TABLES, v jeho pořadí", () => {
    const measured = [...arrayLiteral(atlas, "ENTITY_TABLES"), ...arrayLiteral(atlas, "GRAPH_TABLES")];
    expect(measured).toEqual(arrayLiteral(ledger, "RUN_TABLES"));
  });

  it("nástroj čte netriviální seznam (falzifikace extraktoru)", () => {
    const sealed = arrayLiteral(ledger, "RUN_TABLES");
    expect(sealed.length).toBeGreaterThanOrEqual(10);
    expect(sealed).toContain("kg_edge");
  });
});
