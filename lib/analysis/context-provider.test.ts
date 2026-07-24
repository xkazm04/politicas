import { describe, expect, it } from "vitest";

import {
  buildCustomProps,
  buildDocumentation,
  corpusName,
  datasetUrn,
  ENTITY_FIELDS,
  pumperUpstreams,
  SLICE_QUALITY_SCHEMA_FIELDS,
  sliceName,
  type SliceStats,
} from "@/lib/analysis/context-model";
import { DirectContextProvider, LiteContextProvider } from "@/lib/analysis/context-provider";

/* ── fixtures: three slices, two sources ─────────────────────────────────────── */

const voteEvent: SliceStats = {
  slice: "psp-hlasovani×PSP10×vote_event", // has a LEDGER entry → coverage populated
  source: "psp-hlasovani",
  term: "PSP10",
  entity: "vote_event",
  rows: 1234,
  pct: { complete: 98, categorized: 95, valid: 100, rich: 3 },
  composite: 3.9,
  criteria: { completeness: 4.9, freshness: 4, categorization: 4.8, validity: 5, richness: 1.1, volume: 5 },
  freshness: { syncAgeDays: 2, rowLagDays: 5, newestRow: "2026-07-20T10:00:00.000Z" },
  notes: ["16 voided (zmatečné) roll calls", "0 manual votes (no per-MP ballots)"],
};
const voteBallot: SliceStats = {
  slice: "psp-hlasovani×PSP10×vote_ballot", // NOT in LEDGER → coverage pending
  source: "psp-hlasovani",
  term: "PSP10",
  entity: "vote_ballot",
  rows: 44633,
  pct: { complete: 100, categorized: 78, valid: 96, rich: 22 },
  composite: 3.7,
  criteria: { completeness: 5, freshness: 4, categorization: 4.1, validity: 4.8, richness: 1.9, volume: 5 },
  freshness: { syncAgeDays: 2, rowLagDays: null, newestRow: null },
  notes: ["44633 ballots are the post-1995 merged abstain/not-voting bucket (code K)"],
};
// A different source WITH a Pumper upstream — exercises the lineage-present branch.
const release: SliceStats = {
  slice: "pumper-psp-opendata×all×source_release",
  source: "pumper-psp-opendata",
  term: "all",
  entity: "source_release",
  rows: 17,
  pct: { complete: 100, categorized: 100, valid: 0, rich: 100 },
  composite: 3.0,
  criteria: { completeness: 5, freshness: 3, categorization: 5, validity: 1, richness: 5, volume: 2 },
  freshness: { syncAgeDays: 1, rowLagDays: 1, newestRow: "2026-07-19T00:00:00.000Z" },
  notes: ["17/17 rows carry U+FFFD (Pumper charset defect)"],
};

const ALL = [voteEvent, voteBallot, release];
const ENV = "PROD";

/* ── a mock GMS that returns exactly what datahub-sync would have published ───── */

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

/** Build the OpenAPI-v3 aspect bags the real GMS would return for our fixtures, so
 *  LiteContextProvider round-trips the SAME context DirectContextProvider builds. */
function makeMockFetch(target: { source: string; entity: string }): typeof fetch {
  const corpusUrn = datasetUrn(corpusName(target.source, target.entity), ENV);
  const rubricUrn = datasetUrn("store.slice_quality", ENV);
  const sliceUrns = new Map(ALL.map((s) => [datasetUrn(sliceName(s.source, s.term, s.entity), ENV), s]));

  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const dec = decodeURIComponent(url);

    // sibling scroll page (no specific urn) — one page, every slice dataset, no scrollId.
    if (url.includes("/entity/dataset?")) {
      return jsonResponse({
        entities: ALL.map((s) => ({
          urn: datasetUrn(sliceName(s.source, s.term, s.entity), ENV),
          datasetProperties: { value: { customProperties: buildCustomProps(s) } },
        })),
      });
    }

    if (dec.includes(rubricUrn)) {
      return jsonResponse({
        schemaMetadata: { value: { fields: SLICE_QUALITY_SCHEMA_FIELDS.map((f) => ({ fieldPath: f.field, description: f.doc })) } },
      });
    }
    if (dec.includes(corpusUrn)) {
      const ups = pumperUpstreams(target.source, ENV);
      return jsonResponse({
        datasetProperties: {
          value: {
            name: `corpus/${target.source}/${target.entity}`,
            description: buildDocumentation(target.source, "all", target.entity, null),
          },
        },
        schemaMetadata: {
          value: {
            fields: (ENTITY_FIELDS[target.entity] ?? [{ field: "id", doc: "Natural key." }]).map((f) => ({
              fieldPath: f.field,
              description: f.doc,
            })),
          },
        },
        ...(ups.length ? { upstreamLineage: { value: { upstreams: ups.map((dataset) => ({ dataset })) } } } : {}),
      });
    }
    for (const [urn, s] of sliceUrns) {
      if (dec.includes(urn)) {
        return jsonResponse({
          datasetProperties: {
            value: {
              name: `slice/${s.source}/${s.term}/${s.entity}`,
              description: buildDocumentation(s.source, s.term, s.entity, s),
              customProperties: buildCustomProps(s),
            },
          },
          upstreamLineage: { value: { upstreams: [{ dataset: datasetUrn(corpusName(s.source, s.entity), ENV) }] } },
        });
      }
    }
    return jsonResponse(null, false);
  }) as unknown as typeof fetch;
}

/* ── the measurement-integrity property ──────────────────────────────────────── */

describe("ContextProvider — direct vs lite parity", () => {
  it("returns byte-identical CONTENT for both arms (only contextSource differs)", async () => {
    const direct = await new DirectContextProvider(ALL, ENV).getSliceContext("psp-hlasovani", "PSP10", "vote_event");
    const lite = await new LiteContextProvider({
      gms: "http://gms.test",
      env: ENV,
      fetchImpl: makeMockFetch({ source: "psp-hlasovani", entity: "vote_event" }),
    }).getSliceContext("psp-hlasovani", "PSP10", "vote_event");

    expect(direct).not.toBeNull();
    expect(lite).toEqual({ ...direct!, contextSource: "lite" });
  });

  it("parity holds for a source WITH Pumper lineage (corpusUpstreams non-empty)", async () => {
    const direct = await new DirectContextProvider(ALL, ENV).getSliceContext("pumper-psp-opendata", "all", "source_release");
    const lite = await new LiteContextProvider({
      gms: "http://gms.test",
      env: ENV,
      fetchImpl: makeMockFetch({ source: "pumper-psp-opendata", entity: "source_release" }),
    }).getSliceContext("pumper-psp-opendata", "all", "source_release");

    expect(direct!.provenance.corpusUpstreams).toHaveLength(2);
    expect(lite).toEqual({ ...direct!, contextSource: "lite" });
  });
});

describe("DirectContextProvider — local assembly", () => {
  it("assembles a well-formed SliceContext with the full rubric and known-issue docs", async () => {
    const ctx = await new DirectContextProvider(ALL, ENV).getSliceContext("psp-hlasovani", "PSP10", "vote_event");
    expect(ctx).not.toBeNull();
    expect(ctx!.contextSource).toBe("direct");
    // the scoring rubric is the full slice_quality schema (4 keys + 6 criteria + 3 tallies)
    expect(ctx!.scoringRubric).toHaveLength(SLICE_QUALITY_SCHEMA_FIELDS.length);
    expect(ctx!.scoringRubric!.map((r) => r.criterion)).toEqual(
      expect.arrayContaining(["completeness", "freshness", "categorization", "validity", "richness", "volume"]),
    );
    // documentation carries the institutional memory
    expect(ctx!.slice.documentation).toContain("merged bucket");
    expect(ctx!.slice.documentation).toContain("COVERAGE: analyzed-onboarding");
    // deterministic stats are the scorer's, verbatim
    expect(ctx!.slice.deterministicStats!.rows).toBe("1234");
    expect(ctx!.slice.deterministicStats!.quality_composite).toBe("3.9");
  });

  it("scopes siblings to the same source and keys them <term>.<entity>", async () => {
    const ctx = await new DirectContextProvider(ALL, ENV).getSliceContext("psp-hlasovani", "PSP10", "vote_event");
    const siblings = ctx!.siblingSlicesOnThisSource;
    expect(Object.keys(siblings).sort()).toEqual(["PSP10.vote_ballot", "PSP10.vote_event"]);
    // the LEDGER-covered sibling shows its coverage; the uncovered one is pending
    expect(siblings["PSP10.vote_event"]).toContain("analyzed-onboarding");
    expect(siblings["PSP10.vote_ballot"]).toContain("pending");
    // a different source's slice never leaks in
    expect(siblings["all.source_release"]).toBeUndefined();
  });

  it("returns null for a slice it does not know", async () => {
    const ctx = await new DirectContextProvider(ALL, ENV).getSliceContext("psp-hlasovani", "PSP99", "vote_event");
    expect(ctx).toBeNull();
  });
});

describe("LiteContextProvider — missing slice", () => {
  it("returns null when the catalog has no datasetProperties for the slice", async () => {
    const lite = await new LiteContextProvider({
      gms: "http://gms.test",
      env: ENV,
      fetchImpl: (async () => jsonResponse(null, false)) as unknown as typeof fetch,
    }).getSliceContext("psp-hlasovani", "PSP10", "vote_event");
    expect(lite).toBeNull();
  });
});
