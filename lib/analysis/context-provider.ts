// The Lite-optional context WRAPPER: one interface, two interchangeable arms.
//
//   DirectContextProvider — assembles the analyst's context from LOCAL deterministic
//                           sources (context-model + the slice stats). No DataHub.
//   LiteContextProvider   — reads the SAME context back from the DataHub Lite catalog
//                           (GMS OpenAPI v3), exactly as scripts/data-analysis/
//                           dh-context.ts did before this refactor.
//
// Selecting the arm with a flag is what lets us run the analysis loop WITH and WITHOUT
// the DataHub Lite metalayer and measure the difference (the hackathon A/B). The two
// arms are proven to return byte-identical CONTENT for the same slice
// (context-provider.test.ts), so any measured delta is about the metalayer as a
// DELIVERY mechanism (catalog round-trip, discoverability, portability), never about
// one arm knowing more than the other. If the delta is nil, the honest framing still
// holds: the pipeline runs through DataHub Lite, so it is built on it.
//
// IO surface: DirectContextProvider is pure (given the loaded slice stats).
// LiteContextProvider does HTTP (its whole job); `fetchImpl` is injectable for tests.

import {
  ENTITY_FIELDS,
  SLICE_QUALITY_SCHEMA_FIELDS,
  buildCustomProps,
  buildDocumentation,
  clean,
  corpusName,
  datasetUrn,
  pumperUpstreams,
  siblingCoverageLine,
  sliceName,
  type SliceStats,
} from "@/lib/analysis/context-model";

export type ContextMode = "direct" | "lite";

export interface RubricCriterion {
  criterion: string;
  definition: string;
}
export interface CorpusContext {
  urn: string | null;
  name: string | undefined;
  documentation: string | undefined;
  fields: { field: string; doc: string | undefined }[] | undefined;
}
/** What an analyst READS before analyzing a slice — the same shape whichever arm built it. */
export interface SliceContext {
  contextSource: ContextMode;
  slice: {
    urn: string | null;
    name: string | undefined;
    documentation: string | undefined;
    deterministicStats: Record<string, string> | undefined;
  };
  corpus: CorpusContext | null;
  scoringRubric: RubricCriterion[] | undefined;
  provenance: { sliceUpstreams: string[]; corpusUpstreams: string[] };
  siblingSlicesOnThisSource: Record<string, string>;
}

export interface ContextProvider {
  readonly mode: ContextMode;
  /** The analyst's context for one slice, or null when the slice is unknown to this arm. */
  getSliceContext(source: string, term: string, entity: string): Promise<SliceContext | null>;
}

/* ── Arm A: local, no metalayer ─────────────────────────────────────────────── */

export class DirectContextProvider implements ContextProvider {
  readonly mode = "direct" as const;
  constructor(
    private readonly slices: readonly SliceStats[],
    private readonly env = "PROD",
  ) {}

  async getSliceContext(source: string, term: string, entity: string): Promise<SliceContext | null> {
    const s = this.slices.find((x) => x.source === source && x.term === term && x.entity === entity);
    if (!s) return null;

    const siblings: Record<string, string> = {};
    for (const sib of this.slices) {
      if (sib.source !== source) continue;
      siblings[`${clean(sib.term)}.${sib.entity}`] = siblingCoverageLine(sib);
    }

    const fields = ENTITY_FIELDS[entity] ?? [{ field: "id", doc: "Natural key." }];

    return {
      contextSource: "direct",
      slice: {
        urn: datasetUrn(sliceName(source, term, entity), this.env),
        name: `slice/${source}/${term}/${entity}`,
        documentation: buildDocumentation(source, term, entity, s),
        deterministicStats: buildCustomProps(s),
      },
      corpus: {
        urn: datasetUrn(corpusName(source, entity), this.env),
        name: `corpus/${source}/${entity}`,
        documentation: buildDocumentation(source, "all", entity, null),
        fields: fields.map((f) => ({ field: f.field, doc: f.doc })),
      },
      scoringRubric: SLICE_QUALITY_SCHEMA_FIELDS.map((f) => ({ criterion: f.field, definition: f.doc })),
      provenance: {
        sliceUpstreams: [datasetUrn(corpusName(source, entity), this.env)],
        corpusUpstreams: pumperUpstreams(source, this.env),
      },
      siblingSlicesOnThisSource: siblings,
    };
  }
}

/* ── Arm B: the DataHub Lite catalog ────────────────────────────────────────── */

interface AspectBag {
  datasetProperties?: { value: { name?: string; description?: string; customProperties?: Record<string, string> } };
  upstreamLineage?: { value: { upstreams: { dataset: string }[] } };
  schemaMetadata?: { value: { fields: { fieldPath: string; description?: string }[] } };
}

export interface LiteContextOptions {
  gms: string;
  env?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export class LiteContextProvider implements ContextProvider {
  readonly mode = "lite" as const;
  private readonly gmsUrl: string;
  private readonly env: string;
  private readonly token?: string;
  private readonly doFetch: typeof fetch;

  constructor(opts: LiteContextOptions) {
    this.gmsUrl = opts.gms.replace(/\/+$/, "");
    this.env = opts.env ?? "PROD";
    this.token = opts.token;
    this.doFetch = opts.fetchImpl ?? fetch;
  }

  private urnFor(name: string): string {
    return datasetUrn(name, this.env);
  }

  private async gms(path: string): Promise<Record<string, unknown> | null> {
    const res = await this.doFetch(`${this.gmsUrl}${path}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  }

  private async entity(urn: string, aspects: string[]): Promise<AspectBag | null> {
    const q = aspects.map((a) => `aspects=${a}`).join("&");
    return (await this.gms(`/openapi/v3/entity/dataset/${encodeURIComponent(urn)}?${q}`)) as AspectBag | null;
  }

  /** `urn:li:dataset:(urn:li:dataPlatform:X,<name>,ENV)` → `<name>` */
  private nameFromUrn(urn: string): string {
    return urn.slice(urn.indexOf("(") + 1, urn.lastIndexOf(")")).split(",")[1] ?? "";
  }

  /**
   * Every politicas slice dataset for one source + its coverage state. Pages at 10 —
   * this GMS build returns an EMPTY BODY for scroll pages above ~10, so a larger page
   * size silently loses siblings.
   */
  private async siblingSlices(source: string): Promise<Record<string, string>> {
    const prefix = `slice.${clean(source)}.`;
    const out: Record<string, string> = {};
    let scrollId: string | null = null;
    for (let page = 0; page < 60; page++) {
      const path: string = `/openapi/v3/entity/dataset?count=10&systemMetadata=false&aspects=datasetProperties${
        scrollId ? `&scrollId=${encodeURIComponent(scrollId)}` : ""
      }`;
      const res = (await this.gms(path)) as {
        scrollId?: string;
        entities?: { urn: string; datasetProperties?: { value?: { customProperties?: Record<string, string> } } }[];
      } | null;
      if (!res?.entities?.length) break;
      for (const e of res.entities) {
        const name = this.nameFromUrn(e.urn);
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

  async getSliceContext(source: string, term: string, entity: string): Promise<SliceContext | null> {
    const sliceUrn = this.urnFor(sliceName(source, term, entity));
    const corpusUrn = this.urnFor(corpusName(source, entity));
    const rubricUrn = this.urnFor("store.slice_quality");

    const [sliceBag, corpusBag, rubricBag, siblings] = await Promise.all([
      this.entity(sliceUrn, ["datasetProperties", "upstreamLineage"]),
      this.entity(corpusUrn, ["datasetProperties", "schemaMetadata", "upstreamLineage"]),
      this.entity(rubricUrn, ["schemaMetadata"]),
      this.siblingSlices(source),
    ]);

    if (!sliceBag?.datasetProperties) return null;

    const sp = sliceBag.datasetProperties.value;
    const cp = corpusBag?.datasetProperties?.value;

    return {
      contextSource: "lite",
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
        definition: f.description ?? "",
      })),
      provenance: {
        sliceUpstreams: sliceBag.upstreamLineage?.value.upstreams.map((u) => u.dataset) ?? [],
        corpusUpstreams: corpusBag?.upstreamLineage?.value.upstreams.map((u) => u.dataset) ?? [],
      },
      siblingSlicesOnThisSource: siblings,
    };
  }
}

/* ── factory ────────────────────────────────────────────────────────────────── */

export type ContextProviderConfig =
  | { mode: "direct"; slices: readonly SliceStats[]; env?: string }
  | ({ mode: "lite" } & LiteContextOptions);

export function makeContextProvider(config: ContextProviderConfig): ContextProvider {
  return config.mode === "direct"
    ? new DirectContextProvider(config.slices, config.env)
    : new LiteContextProvider(config);
}

/** Resolve the default arm from the environment (CONTEXT_SOURCE=direct|lite). */
export function defaultContextMode(): ContextMode {
  return process.env.CONTEXT_SOURCE === "direct" ? "direct" : "lite";
}
