/* Catalog context fetcher — what an analyst agent READS from DataHub before
 * analyzing a slice, instead of having context hand-carried into its prompt.
 *
 * Deliberately shaped like the DataHub MCP tool surface (get_entities +
 * list_schema_fields + get_lineage + a scoped search), so the same context is
 * available whether an agent calls this CLI or the MCP server.
 *
 *   npx tsx scripts/data-analysis/dh-context.ts --slice="psp-hlasovani×PSP10×vote_event"
 *   npx tsx scripts/data-analysis/dh-context.ts --source=psp-hlasovani --term=PSP10 --entity=vote_event
 *
 * Prints JSON: the slice's documentation + deterministic stats, its parent corpus
 * entity's field docs, the shared scoring rubric, upstream provenance, and the
 * coverage state of every sibling slice on that source.
 */
const PLATFORM = "urn:li:dataPlatform:politicas";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const GMS = arg("gms", process.env.DATAHUB_GMS_URL || "http://localhost:8080").replace(/\/+$/, "");
const ENV = arg("env", "PROD");
const TOKEN = process.env.DATAHUB_TOKEN;
const clean = (s: string) => s.replace(/[.\-]/g, "_");
const urnFor = (name: string) => `urn:li:dataset:(${PLATFORM},${name},${ENV})`;

async function gms(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${GMS}${path}`, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

interface AspectBag {
  datasetProperties?: { value: { name?: string; description?: string; customProperties?: Record<string, string> } };
  upstreamLineage?: { value: { upstreams: { dataset: string }[] } };
  schemaMetadata?: { value: { fields: { fieldPath: string; description?: string }[] } };
}

async function entity(urn: string, aspects: string[]): Promise<AspectBag | null> {
  const q = aspects.map((a) => `aspects=${a}`).join("&");
  return (await gms(`/openapi/v3/entity/dataset/${encodeURIComponent(urn)}?${q}`)) as AspectBag | null;
}

/** `urn:li:dataset:(urn:li:dataPlatform:X,<name>,ENV)` → `<name>` */
function nameFromUrn(urn: string): string {
  return urn.slice(urn.indexOf("(") + 1, urn.lastIndexOf(")")).split(",")[1] ?? "";
}

/**
 * Scoped catalog search: every politicas slice dataset for one source, with its
 * coverage state. Pages at 10 — this GMS build returns an EMPTY BODY for scroll
 * pages above ~10, so a larger page size silently loses siblings.
 */
async function siblingSlices(source: string): Promise<Record<string, string>> {
  const prefix = `slice.${clean(source)}.`;
  const out: Record<string, string> = {};
  let scrollId: string | null = null;
  for (let page = 0; page < 60; page++) {
    const path: string = `/openapi/v3/entity/dataset?count=10&systemMetadata=false&aspects=datasetProperties${
      scrollId ? `&scrollId=${encodeURIComponent(scrollId)}` : ""
    }`;
    const res = (await gms(path)) as {
      scrollId?: string;
      entities?: { urn: string; datasetProperties?: { value?: { customProperties?: Record<string, string> } } }[];
    } | null;
    if (!res?.entities?.length) break;
    for (const e of res.entities) {
      const name = nameFromUrn(e.urn);
      if (!name.startsWith(prefix)) continue;
      const cp = e.datasetProperties?.value?.customProperties ?? {};
      out[name.slice(prefix.length)] = `${cp.coverage_status ?? "pending"} · ${cp.rows ?? "?"} rows${
        cp.coverage_note ? ` · ${cp.coverage_note}` : ""
      }`;
    }
    if (!res.scrollId || res.scrollId === scrollId) break;
    scrollId = res.scrollId;
  }
  return out;
}

async function main() {
  let source = arg("source");
  let term = arg("term");
  let entityKind = arg("entity");
  const slice = arg("slice");
  if (slice) {
    const parts = slice.split(/[×x]/).map((p) => p.trim());
    [source, term, entityKind] = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
  }
  if (!source || !term || !entityKind) {
    console.error('usage: --slice="<source>×<term>×<entity>"  |  --source= --term= --entity=');
    process.exit(2);
  }

  const sliceUrn = urnFor(`slice.${clean(source)}.${clean(term)}.${entityKind}`);
  const corpusUrn = urnFor(`corpus.${clean(source)}.${entityKind}`);
  const rubricUrn = urnFor("store.slice_quality");

  const [sliceBag, corpusBag, rubricBag, siblings] = await Promise.all([
    entity(sliceUrn, ["datasetProperties", "upstreamLineage"]),
    entity(corpusUrn, ["datasetProperties", "schemaMetadata", "upstreamLineage"]),
    entity(rubricUrn, ["schemaMetadata"]),
    siblingSlices(source),
  ]);

  if (!sliceBag?.datasetProperties) {
    console.error(`slice not found in catalog: ${sliceUrn}`);
    process.exit(1);
  }

  const sp = sliceBag.datasetProperties.value;
  const cp = corpusBag?.datasetProperties?.value;
  console.log(
    JSON.stringify(
      {
        slice: {
          urn: sliceUrn,
          name: sp.name,
          documentation: sp.description,
          deterministicStats: sp.customProperties,
        },
        corpus: cp
          ? {
              urn: corpusUrn,
              name: cp.name,
              documentation: cp.description,
              fields: corpusBag?.schemaMetadata?.value.fields.map((f) => ({ field: f.fieldPath, doc: f.description })),
            }
          : null,
        scoringRubric: rubricBag?.schemaMetadata?.value.fields.map((f) => ({
          criterion: f.fieldPath,
          definition: f.description,
        })),
        provenance: {
          sliceUpstreams: sliceBag.upstreamLineage?.value.upstreams.map((u) => u.dataset) ?? [],
          corpusUpstreams: corpusBag?.upstreamLineage?.value.upstreams.map((u) => u.dataset) ?? [],
        },
        siblingSlicesOnThisSource: siblings,
      },
      null,
      1,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
