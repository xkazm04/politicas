/* Publishes the civic corpus's METADATA to DataHub — the catalog layer the
 * `/data-analysis-dh` skill (LiteContextProvider arm) reads instead of hand-carrying
 * context in prompts. METADATA ONLY: no civic rows are ever sent — only schemas,
 * deterministic stats, documentation (source known-issues + corpus rules), coverage
 * state, and lineage. This is a civic-accountability product; the rows stay in the store.
 *
 * The context corpus it publishes (SOURCE_DOCS, CORPUS_PRIMER, LEDGER, the RUBRIC,
 * ENTITY_FIELDS, and the documentation/stats builders) lives in lib/analysis/
 * context-model.ts — the SAME module DirectContextProvider assembles context from.
 * That shared origin is what makes the with/without-DataHub-Lite A/B a measurement of
 * the metalayer as a delivery mechanism, not of two different bodies of knowledge.
 *
 * What lands in the catalog (platform `politicas`, env PROD):
 *   politicas.corpus.<source>.<entity>        one per graph entity (schema + docs)
 *   politicas.slice.<source>.<term>.<entity>   one per analysis slice (stats + coverage)
 *   politicas.store.slice_quality              the scorer's output + the RUBRIC
 *                                              (each criterion a documented field)
 *
 *   npx tsx scripts/data-analysis/datahub-sync.ts --stats=<dir>/stats.json [--gms=http://localhost:8080]
 */
import { readFileSync } from "node:fs";

import {
  buildCustomProps,
  buildDocumentation,
  corpusName,
  ENTITY_FIELDS,
  pumperUpstreams,
  SLICE_QUALITY_SCHEMA_FIELDS,
  sliceName,
  datasetUrn as urnFor,
  type SliceStats,
} from "@/lib/analysis/context-model";
import { envelope, lineage, operation, postAspects, profile, props, schemaOf, type Entity } from "./datahubAspects";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const ENV = arg("env", "PROD");
const GMS = arg("gms", process.env.DATAHUB_GMS_URL || "http://localhost:8080").replace(/\/+$/, "");
const datasetUrn = (name: string) => urnFor(name, ENV);

async function main() {
  const statsPath = arg("stats", "./.data-analysis/stats.json");
  const { slices } = JSON.parse(readFileSync(statsPath, "utf8")) as { slices: SliceStats[] };
  const ms = Date.now();
  const entities: Entity[] = [];

  // The rubric dataset — the shared slice_quality schema (4 keys + 6 criteria + 3 tallies).
  const sqUrn = datasetUrn("store.slice_quality");
  entities.push(
    envelope(
      sqUrn,
      props(
        "store/slice_quality",
        [
          "Deterministic quality snapshot per slice, written by scoreSlice (lib/analysis/quality.ts) and promoted from validated verdicts.",
          "",
          "THE RUBRIC IS THE SCHEMA BELOW: each criterion field carries its definition, so a score always references one shared meaning.",
          "Scores are 1–5; composite is their mean. LLM analysis NEVER authors these numbers — it adds qualitative findings on top and may flag a number as semantically hollow.",
        ].join("\n"),
        { taxonomy_version: "det-cz-v1", written_by: "scoreSlice" },
      ),
    ),
    envelope(sqUrn, schemaOf("store.slice_quality", SLICE_QUALITY_SCHEMA_FIELDS)),
    envelope(sqUrn, operation(ms)),
  );

  // Corpus entity datasets (one per source×entity present).
  const corpusUrns = new Set<string>();
  const seenCorpus = new Set<string>();
  for (const s of slices) {
    const cn = corpusName(s.source, s.entity);
    if (seenCorpus.has(cn)) continue;
    seenCorpus.add(cn);
    const urn = datasetUrn(cn);
    corpusUrns.add(urn);
    entities.push(
      envelope(urn, props(`corpus/${s.source}/${s.entity}`, buildDocumentation(s.source, "all", s.entity, null), {
        source: s.source,
        entity: s.entity,
      })),
      envelope(urn, schemaOf(cn, ENTITY_FIELDS[s.entity] ?? [{ field: "id", doc: "Natural key." }])),
      envelope(urn, operation(ms)),
    );
    const ups = pumperUpstreams(s.source, ENV);
    if (ups.length) entities.push(envelope(urn, lineage(ups, ms)));
  }

  // Slice datasets (stats + coverage + lineage back to the corpus entity).
  for (const s of slices) {
    const urn = datasetUrn(sliceName(s.source, s.term, s.entity));
    entities.push(
      envelope(urn, props(`slice/${s.source}/${s.term}/${s.entity}`, buildDocumentation(s.source, s.term, s.entity, s), buildCustomProps(s))),
      envelope(urn, profile(ms, s.rows)),
      envelope(urn, operation(ms)),
      envelope(urn, lineage([datasetUrn(corpusName(s.source, s.entity))], ms)),
    );
  }

  // slice_quality is derived FROM the corpus datasets.
  entities.push(envelope(sqUrn, lineage([...corpusUrns], ms)));

  console.log(`pushing ${entities.length} aspects for ${slices.length} slices → ${GMS}`);
  await postAspects(GMS, entities);
  console.log(`\ndone: ${seenCorpus.size} corpus datasets, ${slices.length} slice datasets, 1 rubric dataset`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
