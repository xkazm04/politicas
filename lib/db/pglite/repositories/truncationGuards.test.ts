// Každý lister musí ohlásit, že narazil na vlastní strop — jinak čtenář dostane
// SYSTEMATICKY useknutý výsledek a nic to neřekne (lib/db/pglite/internals.ts,
// `warnIfTruncated`). Šest čtecích cest tu hlídku nemělo:
//
//   kgNeighbours (a jeho asOf dvojče) — primitivum, ke kterému čtecí doktrína
//     míří KAŽDÝ per-entity loader, a jediné bez hlídky; navíc s nejmenším
//     defaultem v aplikaci (500) proti ~784 hranám `supplies` na firmu v
//     průměru. Cena mlčení je změřená: /denik takhle ztratil 4 872 smluv.
//   listLensVectors — živí PUBLIKOVANÝ medián referenda.
//   listReviewAudit — /dukazy vykresluje jeho `length` JAKO POČET rozhodnutí,
//     a pět volajících žádá přesně jeho tvrdý strop 10 000.
//   listChangeEvents · listVoteEvents · listVoteTags.
//
// BEZ PGlite: repozitáře berou spojení jako parametr, takže stačí atrapa, která
// vrátí přesně `limit` řádků. Žádný WASM boot navíc (ADR o jednom bootu na
// soubor v lib/testing/loaders.test.ts) a hlídka se testuje tam, kde je —
// v zapojení listeru, ne v čisté funkci, kterou už testuje volající kód.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Pglite } from "../internals";
import { makeChangesRepo } from "./changes";
import { makeKgRepo } from "./kg";
import { makeReviewRepo } from "./review";
import { makeVoteRepo } from "./votes";
import { makeVoteTagRepo } from "./voteTags";
import { makeWeightsRepo } from "./weights";

/** Atrapa spojení: každý `query` vrátí přesně `rows` řádků daného tvaru. */
function stubPg(rowsFor: (sql: string) => Record<string, unknown>[]): Pglite {
  return {
    waitReady: Promise.resolve(),
    exec: async () => undefined,
    query: async (sql: string) => ({ rows: rowsFor(sql) }) as never,
    transaction: async (cb) => cb({ query: async () => ({ rows: [] }) } as never),
    close: async () => undefined,
  } as Pglite;
}

/** N řádků hran `supplies` — dost na to, aby mapper prošel. */
const edgeRows = (n: number, src: string) =>
  Array.from({ length: n }, (_, i) => ({
    src,
    rel: "supplies",
    dst: `contract:${i}`,
    weight: 1,
    props: {},
    provenance: null,
    first_seen_pass: null,
    valid_from: null,
    valid_to: null,
    recorded_at: null,
  }));

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

/** Věty hlídky, které se týkají jednoho listeru. */
const warningsFor = (fn: string): string[] =>
  warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes(`[db] ${fn} `));

describe("kgNeighbours — primitivum, které hlídku nemělo", () => {
  it("výsledek přesně na stropu se ohlásí, a věta jmenuje entitu i rel filtr", async () => {
    const repo = makeKgRepo(stubPg((sql) => (sql.includes("kg_edge") ? edgeRows(3, "company:ico:123") : [])));
    await repo.kgNeighbours({ id: "company:ico:123", rels: ["supplies"], limit: 3 });
    const msgs = warningsFor("kgNeighbours");
    expect(msgs).toHaveLength(1);
    // Bez id by hlášení nepojmenovalo firmu, kterou má operátor dočíst.
    expect(msgs[0]).toContain("company:ico:123");
    expect(msgs[0]).toContain("supplies");
    expect(msgs[0]).toContain("TRUNCATED");
  });

  it("výsledek pod stropem mlčí", async () => {
    const repo = makeKgRepo(stubPg((sql) => (sql.includes("kg_edge") ? edgeRows(2, "company:ico:123") : [])));
    await repo.kgNeighbours({ id: "company:ico:123", rels: ["supplies"], limit: 3 });
    expect(warningsFor("kgNeighbours")).toEqual([]);
  });

  it("bez rel filtru se přizná hvězdička, ne prázdno", async () => {
    const repo = makeKgRepo(stubPg((sql) => (sql.includes("kg_edge") ? edgeRows(2, "p:1") : [])));
    await repo.kgNeighbours({ id: "p:1", limit: 2 });
    expect(warningsFor("kgNeighbours")[0]).toContain("rels=*");
  });

  it("asOf() čte jinou tabulku, ale hlídku má taky — a hlásí se pod svým jménem", async () => {
    const repo = makeKgRepo(stubPg((sql) => (sql.includes("kg_edge") ? edgeRows(2, "p:1") : [])));
    await repo.asOf("2026-08-01T00:00:00.000Z").kgNeighbours({ id: "p:1", rels: ["supplies"], limit: 2 });
    expect(warningsFor("asOf.kgNeighbours")).toHaveLength(1);
  });
});

describe("hlídky ostatních listerů", () => {
  it("listReviewAudit — /dukazy z jeho délky dělá POČET rozhodnutí", async () => {
    const row = {
      id: "a",
      src: "p:1",
      rel: "linked_to",
      dst: "c:1",
      decision: "confirm",
      reviewer: "t",
      note: null,
      decided_at: "2026-08-01T00:00:00.000Z",
      prior_state: null,
    };
    const repo = makeReviewRepo(stubPg(() => [row, row]));
    await repo.listReviewAudit({ limit: 2 });
    expect(warningsFor("listReviewAudit")).toHaveLength(1);
  });

  it("listVoteEvents — páteř hlasovacího ledgeru", async () => {
    const repo = makeVoteRepo(stubPg(() => [{ id: "v1" }, { id: "v2" }]));
    await repo.listVoteEvents({ limit: 2 });
    expect(warningsFor("listVoteEvents")).toHaveLength(1);
  });

  it("listVoteTags — /kompas z nich vybírá otázky a tiskne práh, který použil", async () => {
    const repo = makeVoteTagRepo(stubPg(() => [{ id: "t1" }, { id: "t2" }]));
    await repo.listVoteTags({ limit: 2, theme: "rozpočet" });
    const msgs = warningsFor("listVoteTags");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("rozpočet"); // filtr se přizná, ať jde read zopakovat
  });

  it("listChangeEvents — seismograf by jinak nakreslil okno a řekl mu historie", async () => {
    // Řádek musí projít vlastním kodexem událostí — mapper na vadné řádce
    // ZÁMĚRNĚ vyhodí výjimku, takže atrapa nese platnou událost.
    const event = (id: string) => ({
      id,
      event_type: "contract-new",
      recorded_at: "2026-08-01T00:00:00.000Z",
      entity_keys: ["firma:12345678"],
      src: null,
      dst: null,
      evidence: {},
      source: "registr smluv",
      payload: {},
    });
    const repo = makeChangesRepo(stubPg(() => [event("e1"), event("e2")]));
    await repo.listChangeEvents({ limit: 2 });
    expect(warningsFor("listChangeEvents")).toHaveLength(1);
  });

  it("listLensVectors — čtení pod PUBLIKOVANÝM mediánem referenda", async () => {
    const repo = makeWeightsRepo(stubPg(() => [{ vahy: "25-20-20-15-10-10" }, { vahy: "25-20-20-15-10-10" }]));
    await repo.listLensVectors(2);
    expect(warningsFor("listLensVectors")).toHaveLength(1);
  });
});
