import { describe, expect, it } from "vitest";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import {
  buildSnapshot,
  bytesToMegabytes,
  measureSnapshotBytes,
  snapshotCasualties,
  snapshotFilename,
  snapshotPayload,
  SNAPSHOT_EDGE_CAP,
  SNAPSHOT_NODE_CAP,
  SNAPSHOT_SCHEMA,
  type SnapshotManifest,
} from "./snapshot";

const node = (id: string, kind = "person"): KgNodeRow => ({
  id,
  kind,
  label: `Uzel ${id}`,
  props: { note: "č" },
  firstSeenPass: 1,
  provenance: { method: "deterministic" },
});

const edge = (i: number, rel = "linked_to"): KgEdgeRow => ({
  src: `a-${i}`,
  rel,
  dst: `b-${i}`,
  weight: null,
  props: {},
  provenance: { method: "deterministic" },
});

/** Manifest ve tvaru, v jakém ho snapshot dostává — včetně CENSU (totály + složení). */
const manifestMeta = (over: Partial<SnapshotManifest["counts"]> = {}): SnapshotManifest => ({
  version: "2026.07.30",
  cutAt: "2026-07-30T09:00:00.000Z",
  degraded: false,
  manifestHash: "0abc1234",
  hashAlgorithm: "fnv-1a/32",
  counts: {
    kgNodes: 2,
    kgEdges: 1,
    voteBallots: 0,
    kinds: [{ kind: "person", count: 2 }],
    edgeRels: [{ rel: "linked_to", count: 1 }],
    ...over,
  },
});

describe("buildSnapshot", () => {
  it("tvar: schema, release z manifestu, limits, řádky beze změny", () => {
    const s = buildSnapshot({
      manifest: manifestMeta(),
      nodes: [node("n1"), node("n2")],
      edges: [edge(1)],
    });
    expect(s.schema).toBe(SNAPSHOT_SCHEMA);
    expect(s.release).toEqual({
      version: "2026.07.30",
      cutAt: "2026-07-30T09:00:00.000Z",
      degraded: false,
      manifestHash: "0abc1234",
      hashAlgorithm: "fnv-1a/32",
    });
    expect(s.limits).toEqual({
      nodeCap: SNAPSHOT_NODE_CAP,
      edgeCap: SNAPSHOT_EDGE_CAP,
      nodesIncluded: 2,
      edgesIncluded: 1,
      nodesTotal: 2,
      edgesTotal: 1,
      truncated: false,
      nodeKinds: [{ key: "person", included: 2, total: 2 }],
      edgeRels: [{ key: "linked_to", included: 1, total: 1 }],
    });
    expect(s.nodes).toHaveLength(2);
    expect(s.edges[0]).toEqual(edge(1));
  });

  it("ořez je vynucený i přiznaný: víc řádků než strop → slice + truncated", () => {
    const many = Array.from({ length: SNAPSHOT_EDGE_CAP + 5 }, (_, i) => edge(i));
    const s = buildSnapshot({
      manifest: manifestMeta({
        kgNodes: 1,
        kgEdges: many.length,
        kinds: [{ kind: "person", count: 1 }],
        edgeRels: [{ rel: "linked_to", count: many.length }],
      }),
      nodes: [node("n1")],
      edges: many,
    });
    expect(s.edges).toHaveLength(SNAPSHOT_EDGE_CAP);
    expect(s.limits.edgesIncluded).toBe(SNAPSHOT_EDGE_CAP);
    expect(s.limits.edgesTotal).toBe(SNAPSHOT_EDGE_CAP + 5);
    expect(s.limits.truncated).toBe(true);
  });

  it("store s víc řádky, než loader načetl (cap v loaderu) → truncated", () => {
    const s = buildSnapshot({
      manifest: manifestMeta({ kgNodes: 50_000, kinds: [{ kind: "person", count: 50_000 }] }),
      nodes: [node("n1")],
      edges: [edge(1)],
    });
    expect(s.limits.truncated).toBe(true);
  });
});

/*
 * SLOŽENÍ VÝŘEZU — jádro směru „snímek řekne, co v něm není". Prefixové čtení
 * (`order by id limit`) NENÍ vzorek: na živém korpusu se do okna vejdou celé
 * druhy a jiné ani jedním řádkem. Test drží, že se tenhle druh ztráty vypíše
 * jmenovitě, ne jen procentem.
 */
describe("buildSnapshot — složení výřezu po druzích", () => {
  const cutOfMixedCorpus = () =>
    buildSnapshot({
      manifest: manifestMeta({
        kgNodes: 1000,
        kgEdges: 500,
        kinds: [
          { kind: "bill", count: 2 },
          { kind: "company", count: 5 },
          { kind: "contract", count: 800 },
          { kind: "person", count: 193 },
        ],
        edgeRels: [
          { rel: "linked_to", count: 90 },
          { rel: "supplies", count: 410 },
        ],
      }),
      // Prefix: oba bills, dvě z pěti companies, žádný person, žádný contract.
      nodes: [node("bill:1", "bill"), node("bill:2", "bill"), node("c:1", "company"), node("c:2", "company")],
      edges: [edge(1, "supplies"), edge(2, "supplies")],
    });

  it("druh, ze kterého výřez nenese nic, je vypsaný s nulou — ne vynechaný", () => {
    const { nodeKinds } = cutOfMixedCorpus().limits;
    expect(nodeKinds).toEqual([
      { key: "bill", included: 2, total: 2 },
      { key: "company", included: 2, total: 5 },
      { key: "contract", included: 0, total: 800 },
      { key: "person", included: 0, total: 193 },
    ]);
  });

  it("totéž pro vztahy hran — chybějící linked_to je vidět", () => {
    expect(cutOfMixedCorpus().limits.edgeRels).toEqual([
      { key: "linked_to", included: 0, total: 90 },
      { key: "supplies", included: 2, total: 410 },
    ]);
  });

  it("ztráta se dá přečíst jménem: absentKinds / absentRels / partial", () => {
    const lost = snapshotCasualties(cutOfMixedCorpus().limits);
    expect(lost.absentKinds).toEqual(["contract", "person"]);
    expect(lost.absentRels).toEqual(["linked_to"]);
    expect(lost.partialKinds.map((c) => c.key)).toEqual(["company"]);
    expect(lost.partialRels.map((c) => c.key)).toEqual(["supplies"]);
    expect(lost.nodesMissing).toBe(996);
    expect(lost.edgesMissing).toBe(498);
  });

  it("druh z řádků, který census nezná, se nezahodí ani nedopočítá", () => {
    // Census a řádky jsou dvě čtení; mezi nimi mohl proběhnout zápis. Rozpor
    // se přizná (řádek existuje), nikdy neopraví.
    const s = buildSnapshot({
      manifest: manifestMeta({ kgNodes: 2, kinds: [{ kind: "person", count: 2 }] }),
      nodes: [node("n1"), node("t1", "theme")],
      edges: [],
    });
    expect(s.limits.nodeKinds).toEqual([
      { key: "person", included: 1, total: 2 },
      { key: "theme", included: 1, total: 1 },
    ]);
  });

  it("prázdný store: žádné vymyšlené druhy, žádná falešná ztráta", () => {
    const s = buildSnapshot({
      manifest: manifestMeta({ kgNodes: 0, kgEdges: 0, kinds: [], edgeRels: [] }),
      nodes: [],
      edges: [],
    });
    expect(s.limits.nodeKinds).toEqual([]);
    expect(s.limits.truncated).toBe(false);
    const lost = snapshotCasualties(s.limits);
    expect(lost).toMatchObject({ nodesMissing: 0, edgesMissing: 0, absentKinds: [], absentRels: [] });
  });
});

describe("snapshotPayload", () => {
  it("bytes = přesná UTF-8 délka JSON (diakritika počítá vícebajtově)", () => {
    const s = buildSnapshot({
      manifest: manifestMeta({ kgNodes: 1, kgEdges: 0, edgeRels: [] }),
      nodes: [node("n1")],
      edges: [],
    });
    const { json, bytes } = snapshotPayload(s);
    expect(bytes).toBe(new TextEncoder().encode(json).byteLength);
    expect(bytes).toBeGreaterThan(json.length); // sanity: „č" v props je 2 B
    expect(JSON.parse(json)).toEqual(s);
  });
});

/*
 * MĚŘENÍ BEZ SESTAVENÍ — /data potřebovala z celého souboru JEDNO číslo a
 * platila za ně ~20–40MB řetězec plus stejně velký buffer, obojí zahozené.
 * Kontrakt je tvrdý: bajt po bajtu TÁŽ hodnota jako `snapshotPayload`.
 */
describe("measureSnapshotBytes", () => {
  const sameAsPayload = (s: Parameters<typeof measureSnapshotBytes>[0]) => {
    expect(measureSnapshotBytes(s)).toBe(snapshotPayload(s).bytes);
  };

  it("prázdná pole", () => {
    sameAsPayload(
      buildSnapshot({
        manifest: manifestMeta({ kgNodes: 0, kgEdges: 0, kinds: [], edgeRels: [] }),
        nodes: [],
        edges: [],
      }),
    );
  });

  it("jeden uzel, žádná hrana (žádná čárka navíc)", () => {
    sameAsPayload(
      buildSnapshot({
        manifest: manifestMeta({ kgNodes: 1, kgEdges: 0, edgeRels: [] }),
        nodes: [node("n1")],
        edges: [],
      }),
    );
  });

  it("mnoho řádků obou druhů (čárky mezi nimi)", () => {
    sameAsPayload(
      buildSnapshot({
        manifest: manifestMeta({
          kgNodes: 37,
          kgEdges: 41,
          kinds: [{ kind: "person", count: 37 }],
          edgeRels: [{ rel: "linked_to", count: 41 }],
        }),
        nodes: Array.from({ length: 37 }, (_, i) => node(`n${i}`)),
        edges: Array.from({ length: 41 }, (_, i) => edge(i)),
      }),
    );
  });

  it("vícebajtové znaky, escapy a uvozovky v props", () => {
    const nasty: KgNodeRow = {
      id: 'contract:"1"',
      kind: "contract",
      label: 'Žluťoučký "kůň" \\ 🐎\n',
      props: { note: "příliš žluťoučký kůň 🐎", quote: '"', tab: "\t" },
      firstSeenPass: 1,
      provenance: { method: "deterministic", ref: "kg-pass:10" },
    };
    sameAsPayload(
      buildSnapshot({
        manifest: manifestMeta({ kgNodes: 1, kgEdges: 0, kinds: [{ kind: "contract", count: 1 }], edgeRels: [] }),
        nodes: [nasty],
        edges: [],
      }),
    );
  });
});

describe("snapshotFilename / bytesToMegabytes", () => {
  it("nese verzi; bez verze čestné nevydano", () => {
    expect(snapshotFilename("2026.07.30")).toBe("politicas-civic-graph-2026.07.30.json");
    expect(snapshotFilename(null)).toBe("politicas-civic-graph-nevydano.json");
  });
  it("převod na MB je binární (1024²)", () => {
    expect(bytesToMegabytes(1024 * 1024)).toBe(1);
  });
});
