/* The DataHub aspect envelopes both sync scripts emit — defined once.
 *
 * datahub-sync.ts (corpus + slices + rubric) and kg-datahub-sync.ts (the derived
 * graph) each carried their own envelope / props / profile / operation / lineage /
 * schemaOf / post, and the latter also re-spelled PLATFORM, `clean` and datasetUrn
 * that lib/analysis/context-model.ts already exports — while promising to „reference
 * the SAME corpus dataset urns datahub-sync.ts publishes, so lineage joins up". A
 * promise kept by two hand copies holds only until one is edited (2026-09-06).
 * METADATA ONLY, as before: no civic rows pass through here.
 */
import { PLATFORM } from "@/lib/analysis/context-model";

export const ACTOR = "urn:li:corpuser:data-analysis";
const BATCH = 25;

export type Entity = Record<string, unknown>;

export const envelope = (urn: string, aspect: Record<string, unknown>): Entity => ({
  entityType: "dataset",
  entityUrn: urn,
  aspect,
});

export const props = (name: string, description: string, custom: Record<string, string>): Record<string, unknown> => ({
  __type: "DatasetProperties",
  name,
  description,
  customProperties: custom,
});

export const profile = (ms: number, rowCount: number) => ({ __type: "DatasetProfile", timestampMillis: ms, rowCount });

export const operation = (ms: number) => ({
  __type: "Operation",
  timestampMillis: ms,
  lastUpdatedTimestamp: ms,
  operationType: "UPDATE",
});

export const lineage = (upstreams: string[], ms: number) => ({
  __type: "UpstreamLineage",
  upstreams: upstreams.map((dataset) => ({ auditStamp: { time: ms, actor: ACTOR }, dataset, type: "TRANSFORMED" })),
});

export function schemaOf(name: string, fields: { field: string; doc: string; type?: string }[]) {
  return {
    __type: "SchemaMetadata",
    schemaName: name,
    platform: PLATFORM,
    version: 0,
    hash: "",
    platformSchema: { __type: "OtherSchema", rawSchema: "" },
    fields: fields.map((f) => ({
      fieldPath: f.field,
      description: f.doc,
      nativeDataType: f.type ?? "string",
      type: { type: { __type: f.type === "number" ? "NumberType" : "StringType" } },
    })),
  };
}

/** POST the aspects to a GMS in batches; `DATAHUB_TOKEN` is sent only when set. */
export async function postAspects(gms: string, entities: Entity[]): Promise<void> {
  const url = `${gms}/openapi/entities/v1/`;
  const token = process.env.DATAHUB_TOKEN;
  for (let i = 0; i < entities.length; i += BATCH) {
    const chunk = entities.slice(i, i + BATCH);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} → ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`);
    }
    process.stdout.write(`  … ${Math.min(i + BATCH, entities.length)}/${entities.length}\r`);
  }
}
