/* A minimal DataHub-Lite-equivalent: a read-only HTTP catalog that serves the exact
 * DataHub OpenAPI v3 read endpoints the LiteContextProvider consumes, populated from the
 * same aspects datahub-sync would publish (both draw from lib/analysis/context-model).
 *
 * Why this exists: acryl DataHub Lite (the pip package) does not install on this box's
 * Python 3.14 (pydantic-core has no 3.14 wheel + no Rust toolchain), and the full GMS is
 * the heavy multi-container path we're avoiding. This process is functionally DataHub
 * Lite for our purpose — a lightweight, embeddable, read-only HTTP catalog — and lets us
 * confirm the LiteContextProvider's REAL HTTP transport end-to-end (real fetch → live
 * server → parse), which the in-process A/B (mocked fetch) did not exercise.
 *
 *   npx tsx scripts/data-analysis/lite-serve.ts   # serves ./.data-analysis/stats.json on :8090
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import {
  ENTITY_FIELDS,
  SLICE_QUALITY_SCHEMA_FIELDS,
  buildCustomProps,
  buildDocumentation,
  corpusName,
  datasetUrn,
  pumperUpstreams,
  sliceName,
  type SliceStats,
} from "@/lib/analysis/context-model";

const ENV = "PROD";
const PORT = Number(process.env.LITE_PORT || 8090);
const STATS = process.env.LITE_STATS || "./.data-analysis/stats.json";
const { slices } = JSON.parse(readFileSync(STATS, "utf8")) as { slices: SliceStats[] };

const nameFromUrn = (urn: string) => urn.slice(urn.indexOf("(") + 1, urn.lastIndexOf(")")).split(",")[1] ?? "";

/** The aspect bag for a dataset urn — slice, corpus, or the rubric — matching datahub-sync. */
function aspectFor(urn: string): Record<string, unknown> | null {
  const name = nameFromUrn(urn);
  const s = slices.find((x) => sliceName(x.source, x.term, x.entity) === name);
  if (s)
    return {
      datasetProperties: { value: { name: `slice/${s.source}/${s.term}/${s.entity}`, description: buildDocumentation(s.source, s.term, s.entity, s), customProperties: buildCustomProps(s) } },
      upstreamLineage: { value: { upstreams: [{ dataset: datasetUrn(corpusName(s.source, s.entity), ENV) }] } },
    };
  if (name === "store.slice_quality")
    return { schemaMetadata: { value: { fields: SLICE_QUALITY_SCHEMA_FIELDS.map((f) => ({ fieldPath: f.field, description: f.doc })) } } };
  const cs = slices.find((x) => corpusName(x.source, x.entity) === name);
  if (cs) {
    const ups = pumperUpstreams(cs.source, ENV);
    return {
      datasetProperties: { value: { name: `corpus/${cs.source}/${cs.entity}`, description: buildDocumentation(cs.source, "all", cs.entity, null) } },
      schemaMetadata: { value: { fields: (ENTITY_FIELDS[cs.entity] ?? [{ field: "id", doc: "Natural key." }]).map((f) => ({ fieldPath: f.field, description: f.doc })) } },
      ...(ups.length ? { upstreamLineage: { value: { upstreams: ups.map((dataset) => ({ dataset })) } } } : {}),
    };
  }
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  res.setHeader("content-type", "application/json");
  // scroll/list endpoint (no urn segment) — one page of every slice dataset, no scrollId.
  if (url.pathname === "/openapi/v3/entity/dataset") {
    const entities = slices.map((s) => ({ urn: datasetUrn(sliceName(s.source, s.term, s.entity), ENV), datasetProperties: { value: { customProperties: buildCustomProps(s) } } }));
    return void res.end(JSON.stringify({ entities }));
  }
  const m = url.pathname.match(/^\/openapi\/v3\/entity\/dataset\/(.+)$/);
  if (m) {
    const bag = aspectFor(decodeURIComponent(m[1]));
    if (!bag) {
      res.statusCode = 404;
      return void res.end("null");
    }
    return void res.end(JSON.stringify(bag));
  }
  res.statusCode = 404;
  res.end("null");
}).listen(PORT, () => console.log(`DataHub-Lite catalog serving OpenAPI v3 on http://localhost:${PORT} — ${slices.length} slices`));
