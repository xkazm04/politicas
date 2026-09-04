/**
 * THE PROVENANCE CONTRACT for `kg_node.provenance` / `kg_edge.provenance`
 * (moonshot card #22).
 *
 * WHY THIS EXISTS. Until now every graph writer put whatever it liked into the
 * `provenance` jsonb — `{pass, method, ref, computedAt}` in five different
 * spellings, no `source`, no run key. Two consequences the product actually
 * paid for:
 *
 *   • `/atlas` could score 3 of the 12 declared sources. The nine that land in
 *     `kg_node`/`kg_edge` — including BOTH that carry the whole `/penize`
 *     foundation — printed a paragraph explaining that no join key runs from a
 *     graph row to `ingest_run`. The page about data quality was silent about
 *     three quarters of the data.
 *   • the Merkle seal covered eight entity tables and none of the graph, so a
 *     half-applied money or law pass was invisible to the sentinel.
 *
 * WHAT THIS MODULE IS. One type, one validator, one vocabulary. `source` is a
 * key of `INGESTED_SOURCES` (lib/analysis/atlas.ts) — imported, never re-listed,
 * so a source added to the atlas is immediately writable and a typo is a
 * refusal rather than a row nobody can score.
 *
 * `UNKNOWN_SOURCE` IS A FIRST-CLASS VALUE, not a hole. Historical rows whose
 * origin cannot be RECONSTRUCTED from what they already carry are stamped
 * `"unknown"` and COUNTED as such on `/atlas`. Guessing a plausible source for
 * them would be repair, and this repo discloses rather than repairs: a number to
 * burn down, printed, beats a number that looks finished and is not.
 *
 * Plain module — no server imports, no I/O — so scripts, loaders and tests all
 * share the one definition (same discipline as ./propRegistry.ts).
 */

import { INGESTED_SOURCES } from "@/lib/analysis/atlas";

/**
 * The stamp every graph row carries.
 *
 * `ingest_run_id` is nullable BY CONTRACT, not by oversight: a writer that did
 * not open an `ingest_run` has no run to point at, and inventing one would put
 * a row inside a seal that never covered it. Null means "no run", and `/atlas`
 * reads it as exactly that (a row without run coverage), never as a failure to
 * write the field.
 */
export interface KgProvenance {
  /** A key of INGESTED_SOURCES, or UNKNOWN_SOURCE. Never a guess. */
  source: string;
  /** The `ingest_run` this row was written by; null = the writer opened none. */
  ingest_run_id: number | null;
  /** The graph pass that wrote it (the loops' own numbering). */
  pass: number;
  /** A DECLARED formula ref or batch ref — what produced the value. */
  ref: string;
  /** The script that wrote the row, by module name (e.g. "kg-compute"). */
  writer: string;
}

/** The counted, never-guessed source of a row whose origin is unreconstructable. */
export const UNKNOWN_SOURCE = "unknown";

/** Every value `source` may legally take: the atlas keys plus UNKNOWN_SOURCE. */
export const PROVENANCE_SOURCES: readonly string[] = [
  ...INGESTED_SOURCES.map((s) => s.source),
  UNKNOWN_SOURCE,
];

const SOURCE_SET = new Set(PROVENANCE_SOURCES);

export function isProvenanceSource(value: unknown): value is string {
  return typeof value === "string" && SOURCE_SET.has(value);
}

/** The five keys the contract declares — mirrored in lib/kg/prop-registry.json. */
export const PROVENANCE_KEYS: readonly (keyof KgProvenance)[] = [
  "source",
  "ingest_run_id",
  "pass",
  "ref",
  "writer",
];

/** Every reason a candidate stamp is not a valid one, named. Empty = valid. */
export function provenanceProblems(value: unknown): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return ["provenance must be a JSON object"];
  }
  const o = value as Record<string, unknown>;
  const problems: string[] = [];
  if (!isProvenanceSource(o.source)) {
    problems.push(
      `source ${JSON.stringify(o.source)} is not a declared INGESTED_SOURCES key ` +
        `(or "${UNKNOWN_SOURCE}") — never guess a source, stamp "${UNKNOWN_SOURCE}" and let it be counted`,
    );
  }
  if (
    o.ingest_run_id !== null &&
    !(typeof o.ingest_run_id === "number" && Number.isInteger(o.ingest_run_id))
  ) {
    problems.push("ingest_run_id must be an integer or null (null = the writer opened no run)");
  }
  if (typeof o.pass !== "number" || !Number.isInteger(o.pass)) problems.push("pass must be an integer");
  if (typeof o.ref !== "string" || o.ref.trim() === "") problems.push("ref must be a non-empty declared ref");
  if (typeof o.writer !== "string" || o.writer.trim() === "") problems.push("writer must be the script's name");
  return problems;
}

export function isKgProvenance(value: unknown): value is KgProvenance {
  return provenanceProblems(value).length === 0;
}

/**
 * Throw unless `value` is a valid stamp. The writers call this BEFORE a write,
 * so an unstamped or mis-stamped row never reaches the store — the enforcement
 * point `persist-batch` already established for prop keys, applied to origin.
 */
export function assertProvenance(value: unknown, context = "kg row"): asserts value is KgProvenance {
  const problems = provenanceProblems(value);
  if (problems.length > 0) {
    throw new Error(`invalid provenance on ${context}: ${problems.join("; ")}`);
  }
}

/** Build a stamp, validated. `ingestRunId` defaults to null — see the interface. */
export function makeProvenance(input: {
  source: string;
  pass: number;
  ref: string;
  writer: string;
  ingestRunId?: number | null;
}): KgProvenance {
  const stamp: KgProvenance = {
    source: input.source,
    ingest_run_id: input.ingestRunId ?? null,
    pass: input.pass,
    ref: input.ref,
    writer: input.writer,
  };
  assertProvenance(stamp, `${input.writer} pass ${input.pass}`);
  return stamp;
}

/**
 * Merge a stamp onto whatever a row already carries.
 *
 * The legacy keys (`method`, `computedAt`, `track`) are PRESERVED, not dropped:
 * they are the only record several passes left of themselves, and this contract
 * is additive over history rather than a rewrite of it.
 */
export function withProvenance(
  existing: Record<string, unknown> | null | undefined,
  stamp: KgProvenance,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...stamp };
}

/** Read a stamp's source off a stored row, without deciding what absence means. */
export function readProvenanceSource(provenance: unknown): string | null {
  if (provenance === null || typeof provenance !== "object" || Array.isArray(provenance)) return null;
  const s = (provenance as Record<string, unknown>).source;
  return typeof s === "string" && s.trim() !== "" ? s : null;
}
