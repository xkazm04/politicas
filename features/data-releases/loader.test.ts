/*
 * LOADER /data — co stránka o výřezu tvrdí a co si za to čte.
 *
 * Tři věci, které se dají rozbít potichu:
 *  • STRÁNKA A SOUBOR SE NESMĚJÍ ROZEJÍT. `/data` říká, co ve staženém výřezu
 *    není; `/data/snapshot.json` totéž nese v poli `limits`. Kdyby to byly dvě
 *    derivace, rozešly by se přesně ve chvíli, kdy na tom záleží — proto je
 *    obojí JEDNA stavba (`buildSnapshot`) a test to porovnává přes skutečný
 *    serializovaný payload, ne přes typ.
 *  • MEMO MÁ ROČNÍK. Klíčem je otisk manifestu, ne jen čas: manifest se čte
 *    čerstvý, takže každý ingest memo sám zneplatní. Prázdný výřez se
 *    nepamatuje (disciplína `createLedgerMemo`).
 *  • VÝPADEK JEDNÉ VRSTVY NENÍ VÝPADEK STRÁNKY. Když selže čtení výřezu,
 *    manifest zůstává — a `snapshot` je `null`, tedy „neumím říct", ne „nic
 *    tam není".
 *
 * Obchod se odehrává nad syntetickým storem (živý ./.pglite drží jiná session)
 * — vzor features/money/moneyLoader.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const listKgNodes = vi.fn();
const listKgEdges = vi.fn();
const reportLoaderFailure = vi.fn();

const CENSUS = {
  kinds: [
    { kind: "company", count: 1 },
    { kind: "contract", count: 800 },
    { kind: "person", count: 2 },
  ],
  rels: { linked_to: 2, supplies: 500 } as Record<string, number>,
  nodes: 803,
  edges: 502,
  ballots: 100,
};

let ballots = CENSUS.ballots;

const node = (id: string, kind: string) => ({
  id,
  kind,
  label: `Uzel ${id}`,
  props: { note: "č" },
  firstSeenPass: 1,
  provenance: { method: "deterministic" },
});
const edge = (i: number) => ({
  src: `psp:person:${i}`,
  rel: "linked_to",
  dst: `company:ico:0000011${i}`,
  weight: null,
  props: {},
  provenance: { method: "deterministic" },
});

const store = {
  kgKindCounts: async () => CENSUS.kinds,
  countKgEdgesByRel: async () => CENSUS.rels,
  countKgNodes: async () => CENSUS.nodes,
  countKgEdges: async () => CENSUS.edges,
  countVoteBallots: async () => ballots,
  listIngestRuns: async () => [],
  listKgNodes,
  listKgEdges,
};

vi.mock("@/lib/db/store", () => ({ getStore: async () => store }));
vi.mock("@/lib/db/pglite/repositories/ledger", () => ({
  getLedgerRepo: async () => ({ getLedgerHeads: async () => ({ reviewChain: null, sealedRuns: [] }) }),
}));
vi.mock("@/lib/db/loaderGuard", () => ({ reportLoaderFailure }));

const { getDataReleasesData, getSnapshotDownload, resetSnapshotMemo } = await import(
  "./getDataReleasesData"
);

beforeEach(() => {
  ballots = CENSUS.ballots;
  resetSnapshotMemo();
  listKgNodes.mockReset();
  listKgEdges.mockReset();
  reportLoaderFailure.mockReset();
  listKgNodes.mockImplementation(async () => [
    node("company:ico:00000111", "company"),
    node("psp:person:1", "person"),
    node("psp:person:2", "person"),
  ]);
  listKgEdges.mockImplementation(async () => [edge(1), edge(2)]);
});

describe("/data ↔ /data/snapshot.json", () => {
  it("stránka a stažený soubor nesou TYTÉŽ limits (i tutéž velikost)", async () => {
    const page = await getDataReleasesData();
    const download = await getSnapshotDownload();
    expect(page?.snapshot).not.toBeNull();
    expect(download).not.toBeNull();
    const payload = JSON.parse(download!.json) as { limits: unknown };
    expect(payload.limits).toEqual(page!.snapshot!.limits);
    expect(page!.snapshot!.bytes).toBe(download!.bytes);
  });

  it("složení pojmenuje druh, ze kterého výřez nenese ani řádek", async () => {
    const page = await getDataReleasesData();
    const { limits } = page!.snapshot!;
    expect(limits.truncated).toBe(true);
    expect(limits.nodeKinds).toEqual([
      { key: "company", included: 1, total: 1 },
      { key: "contract", included: 0, total: 800 },
      { key: "person", included: 2, total: 2 },
    ]);
    expect(limits.edgeRels).toEqual([
      { key: "linked_to", included: 2, total: 2 },
      { key: "supplies", included: 0, total: 500 },
    ]);
  });
});

describe("memo výřezu má ročník", () => {
  it("dvě zobrazení nad týmž otiskem manifestu čtou řádky jednou", async () => {
    await getDataReleasesData();
    await getDataReleasesData();
    expect(listKgNodes).toHaveBeenCalledTimes(1);
    expect(listKgEdges).toHaveBeenCalledTimes(1);
  });

  it("změna store (jiný otisk manifestu) si vynutí nové změření", async () => {
    await getDataReleasesData();
    ballots = CENSUS.ballots + 1; // jakákoli změna počtů = jiný manifestHash
    await getDataReleasesData();
    expect(listKgNodes).toHaveBeenCalledTimes(2);
  });

  it("prázdný výřez se nepamatuje — prázdno není odpověď k zmrazení", async () => {
    listKgNodes.mockImplementation(async () => []);
    listKgEdges.mockImplementation(async () => []);
    await getDataReleasesData();
    await getDataReleasesData();
    expect(listKgNodes).toHaveBeenCalledTimes(2);
  });

  it("stažení memo nečte: soubor se staví z aktuálního store", async () => {
    await getDataReleasesData();
    await getSnapshotDownload();
    expect(listKgNodes).toHaveBeenCalledTimes(2);
  });
});

describe("výpadek výřezu nesmete manifest", () => {
  it("čtení uzlů selže → manifest zůstává, snapshot je null a selhání se hlásí", async () => {
    listKgNodes.mockImplementation(async () => {
      throw new Error("kg_node read failed");
    });
    const page = await getDataReleasesData();
    expect(page).not.toBeNull();
    expect(page!.manifest.counts.kgNodes).toBe(CENSUS.nodes);
    expect(page!.snapshot).toBeNull();
    expect(reportLoaderFailure).toHaveBeenCalledWith("getDataReleasesData:snapshot", expect.any(Error));
  });

  it("selhání se nepamatuje: další zobrazení to zkusí znovu", async () => {
    listKgNodes.mockImplementationOnce(async () => {
      throw new Error("kg_node read failed");
    });
    expect((await getDataReleasesData())!.snapshot).toBeNull();
    expect((await getDataReleasesData())!.snapshot).not.toBeNull();
  });
});
