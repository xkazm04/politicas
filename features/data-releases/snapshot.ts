/*
 * SNAPSHOT (batch-3 item 3D) — čistá stavba stahovatelného JSON výřezu
 * veřejného grafu. Žádný server, žádné DB volání: dostane už načtené kg řádky
 * a manifest, vrátí deterministický objekt + přesnou velikost v bajtech
 * (velikost se PŘIZNÁVÁ na stránce i v Content-Length routy).
 *
 * Výřez je záměrně ohraničený: kg_node/kg_edge jsou odvozená, rekomputovatelná
 * metadata bez `raw` payloadů — přesně vrstva, kterou dává smysl vydávat jako
 * artefakt. Stropy (`SNAPSHOT_NODE_CAP` / `SNAPSHOT_EDGE_CAP`) chrání routu
 * před mnohasetmegabajtovou odpovědí a jsou součástí payloadu (`limits`).
 *
 * ── CO SE ZTRÁCÍ, SE MUSÍ DÁT PŘEČÍST (2026-08-13) ──────────────────────────
 * Do téhle chvíle payload i stránka přiznávaly STROP („20 000") a mlčely o
 * ZTRÁTĚ. To je na artefaktu nabízeném větou „co si stáhnete dnes, můžete
 * citovat" ta nebezpečnější polovina, protože výřez NENÍ VZOREK: obě čtení
 * jsou `order by` (uzly podle `id`, hrany podle `src, rel, dst`), takže okno je
 * ABECEDNÍ PREFIX. Na dnešním korpusu (~153 500 uzlů) se do něj vejdou celé
 * druhy `bill`, `bloc`, `company` a kus `contract` — a ani jeden `person`,
 * `law`, `party`, `organ` nebo `theme`; mezi hranami ani jedna `linked_to`,
 * tedy ani jedna lidskou branou posuzovaná vazba poslanec↔firma, což je celá
 * teze platformy. Procento („13 % uzlů") tohle zamlčuje, druh ne.
 *
 * `limits` proto nese SLOŽENÍ: `nodeKinds` / `edgeRels`, každý druh/vztah s
 * počtem VE VÝŘEZU proti počtu VE STORE. Složení se MĚŘÍ na týchž řádcích,
 * které soubor nese (nikdy neodvozuje z tvaru identifikátoru), a totály jdou
 * z censu, který si manifest už přečetl — takže tenhle modul nepřidává jediné
 * čtení. Stránka /data i soubor tím čtou JEDEN objekt: nemají jak se rozejít.
 *
 * `SNAPSHOT_SCHEMA` se ZÁMĚRNĚ nezvedá: přírůstek je čistě aditivní (žádné
 * pole nezměnilo význam, žádné nezmizelo) a `manifestHash` v `release` je otisk
 * MANIFESTU, ne snapshotu — vydané citace se tímhle nehýbou.
 */

import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import type { ReleaseManifest } from "./manifest";

export const SNAPSHOT_SCHEMA = "politicas.civic-graph-snapshot/1";

/** Stropy výřezu — přiznané v `limits` a v metodice na /data. */
export const SNAPSHOT_NODE_CAP = 20_000;
export const SNAPSHOT_EDGE_CAP = 20_000;

/** Jeden druh uzlu (resp. vztah hrany) ve výřezu proti celému store. */
export interface SnapshotCut {
  /** `kind` uzlu, nebo `rel` hrany — podle toho, ve kterém seznamu řádek stojí. */
  key: string;
  /** Kolik řádků toho druhu soubor NESE. 0 = druh ve výřezu úplně chybí. */
  included: number;
  /** Kolik jich je ve store (census manifestu). */
  total: number;
}

/**
 * Manifest, ze kterého snapshot bere hlavičku vydání A census.
 *
 * Census se bere odsud, a ne zvláštním vstupem: totály výřezu a čísla, která
 * /data tiskne v sekci 01, musí pocházet z JEDNOHO čtení. Dřív loader ručně
 * přepisoval `manifest.counts.kgNodes` do `totalNodes` — dva dráty k jednomu
 * číslu jsou přesně to, jak se dvě plochy rozejdou.
 */
export type SnapshotManifest = Pick<
  ReleaseManifest,
  "version" | "cutAt" | "degraded" | "manifestHash" | "hashAlgorithm" | "counts"
>;

export interface SnapshotInput {
  manifest: SnapshotManifest;
  nodes: ReadonlyArray<KgNodeRow>;
  edges: ReadonlyArray<KgEdgeRow>;
}

export interface SnapshotLimits {
  nodeCap: number;
  edgeCap: number;
  nodesIncluded: number;
  edgesIncluded: number;
  nodesTotal: number;
  edgesTotal: number;
  /** true, když se do výřezu nevešly všechny řádky store. */
  truncated: boolean;
  /** Složení výřezu podle druhu uzlu; řazeno podle `key` vzestupně. */
  nodeKinds: SnapshotCut[];
  /** Složení výřezu podle vztahu hrany; řazeno podle `key` vzestupně. */
  edgeRels: SnapshotCut[];
}

export interface Snapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  release: {
    version: string | null;
    cutAt: string | null;
    degraded: boolean;
    manifestHash: string;
    hashAlgorithm: string;
  };
  limits: SnapshotLimits;
  nodes: KgNodeRow[];
  edges: KgEdgeRow[];
}

/**
 * Složení výřezu: naměřené počty ve výřezu proti censu store.
 *
 * Klíč z censu, který ve výřezu není, se vypisuje s `included: 0` — TO JE TA
 * ZPRÁVA (druh, který v souboru celý chybí), ne prázdno k zamlčení. Klíč, který
 * je v řádcích a v censu chybí (census a řádky jsou dvě čtení, mezi nimi mohl
 * proběhnout zápis), se NEZAHAZUJE ani nedopočítává: vypíše se s `total`
 * rovným naměřenému počtu. Rozpor se nikdy neopravuje.
 */
function cutsOf(
  includedKeys: readonly string[],
  totals: ReadonlyArray<{ key: string; count: number }>,
): SnapshotCut[] {
  const included = new Map<string, number>();
  for (const key of includedKeys) included.set(key, (included.get(key) ?? 0) + 1);
  const out = new Map<string, SnapshotCut>();
  for (const { key, count } of totals) out.set(key, { key, included: included.get(key) ?? 0, total: count });
  for (const [key, n] of included) if (!out.has(key)) out.set(key, { key, included: n, total: n });
  return [...out.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Postaví výřez; stropy vynucuje sám (loader je jen první obrana). */
export function buildSnapshot(input: SnapshotInput): Snapshot {
  const nodes = input.nodes.slice(0, SNAPSHOT_NODE_CAP);
  const edges = input.edges.slice(0, SNAPSHOT_EDGE_CAP);
  const { counts } = input.manifest;
  return {
    schema: SNAPSHOT_SCHEMA,
    release: {
      version: input.manifest.version,
      cutAt: input.manifest.cutAt,
      degraded: input.manifest.degraded,
      manifestHash: input.manifest.manifestHash,
      hashAlgorithm: input.manifest.hashAlgorithm,
    },
    limits: {
      nodeCap: SNAPSHOT_NODE_CAP,
      edgeCap: SNAPSHOT_EDGE_CAP,
      nodesIncluded: nodes.length,
      edgesIncluded: edges.length,
      nodesTotal: counts.kgNodes,
      edgesTotal: counts.kgEdges,
      truncated: nodes.length < counts.kgNodes || edges.length < counts.kgEdges,
      nodeKinds: cutsOf(
        nodes.map((n) => n.kind),
        counts.kinds.map((k) => ({ key: k.kind, count: k.count })),
      ),
      edgeRels: cutsOf(
        edges.map((e) => e.rel),
        counts.edgeRels.map((r) => ({ key: r.rel, count: r.count })),
      ),
    },
    nodes,
    edges,
  };
}

/**
 * Ztráta výřezu, vypsaná jako čísla a JMÉNA — čistá projekce `limits`.
 *
 * Stránka i soubor čtou tytéž `limits`, takže tohle nic nepřepočítává; jen
 * pojmenovává to, co strop udělal. `absent*` je ta věta, kterou procento
 * zamlčuje: druh/vztah, kterého v souboru NENÍ ANI JEDEN řádek.
 */
export interface SnapshotCasualties {
  nodesMissing: number;
  edgesMissing: number;
  /** Druhy uzlů, které jsou ve store a ve výřezu z nich není ani jeden. */
  absentKinds: string[];
  /** Vztahy hran, které jsou ve store a ve výřezu z nich není ani jedna. */
  absentRels: string[];
  /** Druhy/vztahy, které výřez nese jen zčásti. */
  partialKinds: SnapshotCut[];
  partialRels: SnapshotCut[];
}

const absentOf = (cuts: readonly SnapshotCut[]) =>
  cuts.filter((c) => c.total > 0 && c.included === 0).map((c) => c.key);
const partialOf = (cuts: readonly SnapshotCut[]) =>
  cuts.filter((c) => c.included > 0 && c.included < c.total);

export function snapshotCasualties(limits: SnapshotLimits): SnapshotCasualties {
  return {
    nodesMissing: Math.max(0, limits.nodesTotal - limits.nodesIncluded),
    edgesMissing: Math.max(0, limits.edgesTotal - limits.edgesIncluded),
    absentKinds: absentOf(limits.nodeKinds),
    absentRels: absentOf(limits.edgeRels),
    partialKinds: partialOf(limits.nodeKinds),
    partialRels: partialOf(limits.edgeRels),
  };
}

export interface SnapshotPayload {
  json: string;
  /** Přesná velikost UTF-8 payloadu v bajtech — tohle číslo se přiznává. */
  bytes: number;
}

/** Serializace + přesná velikost (TextEncoder — týž kód na serveru i ve vitestu). */
export function snapshotPayload(snapshot: Snapshot): SnapshotPayload {
  const json = JSON.stringify(snapshot);
  return { json, bytes: new TextEncoder().encode(json).byteLength };
}

/**
 * PŘESNÁ velikost payloadu, aniž by se payload sestavil.
 *
 * Stránka /data z celého souboru potřebovala JEDNO ČÍSLO a platila za ně
 * `JSON.stringify` celého snapshotu (~20–40 MB řetězec) plus `TextEncoder`
 * (druhý stejně velký buffer) — obojí zahozené na každém zobrazení. Tady se
 * měří po řádcích: obálka jednou, každý řádek zvlášť, a mezi řádky čárka.
 * Výsledek je bajt po bajtu tentýž jako `snapshotPayload(...).bytes`
 * (přibito testem), protože `JSON.stringify` nemá odsazení a klíče objektu si
 * spread zachovává v původním pořadí — `[]` v obálce se jen nahradí obsahem.
 *
 * `?? "null"` drží sémantiku POLE: `JSON.stringify(undefined)` je `undefined`
 * samostatně, ale `"null"` uvnitř pole.
 */
export function measureSnapshotBytes(snapshot: Snapshot): number {
  const enc = new TextEncoder();
  const shell = enc.encode(JSON.stringify({ ...snapshot, nodes: [], edges: [] })).byteLength;
  const rowsBytes = (rows: ReadonlyArray<unknown>): number => {
    let n = 0;
    for (const row of rows) n += enc.encode(JSON.stringify(row) ?? "null").byteLength;
    return n + Math.max(0, rows.length - 1); // oddělující čárky
  };
  return shell + rowsBytes(snapshot.nodes) + rowsBytes(snapshot.edges);
}

/** Název souboru ke stažení: `politicas-civic-graph-2026.07.30.json`. */
export function snapshotFilename(version: string | null): string {
  return `politicas-civic-graph-${version ?? "nevydano"}.json`;
}

/** „2,4 MB" nepatří sem — formátování drží lib/format; tohle jen převod. */
export const bytesToMegabytes = (bytes: number): number => bytes / (1024 * 1024);
