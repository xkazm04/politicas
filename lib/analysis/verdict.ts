// Analysis-verdict contract — the schema every /data-analysis Sonnet subagent
// must return for one slice of the civic corpus. This module is the SINGLE
// SOURCE OF TRUTH for that contract:
//
//   - QUALITY_CRITERIA / VERDICT_KINDS — the named dimensions + backlog enum.
//   - verdictJsonSchema — a draft-07 JSON Schema built from those constants;
//     pass it verbatim as a subagent's structured-output schema for tool-layer
//     enforcement (the model physically cannot return a drifted shape).
//   - validateVerdict() — a dependency-free deterministic gate for the plain
//     agent path that has no schema param. Run EVERY returned block through it
//     and discard/re-run on drift; never persist a drifted score.
//
// The six criteria are IDENTICAL to the reference repo (completeness, freshness,
// categorization, validity, richness, volume) so scores are comparable across
// every corpus onboarded onto the platform. `additionalProperties:false` on
// `quality` is the load-bearing constraint: it rejects invented dimensions,
// which is the documented failure mode of an unsupervised sweep.

export const QUALITY_CRITERIA = [
  "completeness",
  "freshness",
  "categorization",
  "validity",
  "richness",
  "volume",
] as const;
export type QualityCriterion = (typeof QUALITY_CRITERIA)[number];

/** Allowed `backlog[].kind`. Domain-shaped for politicas. */
export const VERDICT_KINDS = ["ui-ux", "feature", "data-quality", "methodology"] as const;
export type VerdictKind = (typeof VERDICT_KINDS)[number];

export const VERDICT_SCHEMA_VERSION = "verdict-cz-v1";

export interface CriterionScore {
  /** Integer 1-5, consistent with the deterministic scorer. */
  score: number;
  /** Why this score — cites row ids / counts. Non-empty. */
  reason: string;
}
export interface EntityGap {
  entityId: string;
  field: string;
  note: string;
}
export interface Miscategorized {
  entityId: string;
  current: string;
  suggested: string;
  why: string;
}
export interface Opportunity {
  title: string;
  evidence: string;
  productImpact: string;
}
export interface BacklogItem {
  title: string;
  kind: VerdictKind;
  why: string;
}
export interface AnalysisVerdict {
  slice: string;
  rowsAnalyzed: number;
  quality: Record<QualityCriterion, CriterionScore>;
  composite: number;
  entityGaps: EntityGap[];
  miscategorized: Miscategorized[];
  patterns: string[];
  opportunities: Opportunity[];
  backlog: BacklogItem[];
}

/* ── JSON Schema ───────────────────────────────────────────────────────────── */

const criterionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "reason"],
  properties: {
    score: { type: "integer", minimum: 1, maximum: 5 },
    reason: { type: "string", minLength: 1 },
  },
} as const;

export const verdictJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://politicas.local/schemas/data-analysis/subagent-output.json",
  title: "AnalysisVerdict",
  description: "The structured verdict a /data-analysis Sonnet subagent returns for one civic-corpus slice.",
  type: "object",
  additionalProperties: false,
  required: [
    "slice",
    "rowsAnalyzed",
    "quality",
    "composite",
    "entityGaps",
    "miscategorized",
    "patterns",
    "opportunities",
    "backlog",
  ],
  properties: {
    slice: { type: "string", minLength: 1 },
    rowsAnalyzed: { type: "integer", minimum: 0 },
    quality: {
      type: "object",
      additionalProperties: false,
      required: [...QUALITY_CRITERIA],
      properties: Object.fromEntries(QUALITY_CRITERIA.map((c) => [c, criterionSchema])),
    },
    composite: { type: "number", minimum: 1, maximum: 5 },
    entityGaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entityId", "field", "note"],
        properties: { entityId: { type: "string" }, field: { type: "string" }, note: { type: "string" } },
      },
    },
    miscategorized: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entityId", "current", "suggested", "why"],
        properties: {
          entityId: { type: "string" },
          current: { type: "string" },
          suggested: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    patterns: { type: "array", items: { type: "string" } },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "evidence", "productImpact"],
        properties: {
          title: { type: "string" },
          evidence: { type: "string" },
          productImpact: { type: "string" },
        },
      },
    },
    backlog: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "why"],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: [...VERDICT_KINDS] },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

/* ── deterministic validator ─────────────────────────────────────────────── */

export interface ValidationResult {
  ok: boolean;
  value?: AnalysisVerdict;
  errors: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function checkString(v: unknown, path: string, errors: string[], { min = 0 } = {}): void {
  if (typeof v !== "string") errors.push(`${path}: expected string, got ${typeof v}`);
  else if (v.length < min) errors.push(`${path}: string is shorter than ${min}`);
}
function checkArray(v: unknown, path: string, errors: string[], item: (x: unknown, p: string) => void): void {
  if (!Array.isArray(v)) {
    errors.push(`${path}: expected array, got ${v === null ? "null" : typeof v}`);
    return;
  }
  v.forEach((x, i) => item(x, `${path}[${i}]`));
}
function checkExactKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string, errors: string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${path}.${k}: unexpected key (invented field — not in the schema)`);
  }
}

export interface ValidateVerdictOptions {
  /**
   * Ids actually present in the analyzed slice. When supplied, every `entityId`
   * cited in `entityGaps`/`miscategorized` must be one of them — this catches the
   * failure mode where a subagent puts a FIELD NAME or a slice-wide summary in the
   * id slot ("all 42261 rows"). Slice-wide observations belong in patterns/backlog.
   */
  knownEntityIds?: Iterable<string>;
}

export function validateVerdict(input: unknown, options: ValidateVerdictOptions = {}): ValidationResult {
  const errors: string[] = [];
  const known = options.knownEntityIds ? new Set(options.knownEntityIds) : null;
  const checkEntityId = (value: unknown, path: string) => {
    checkString(value, path, errors);
    if (known && typeof value === "string" && value.length > 0 && !known.has(value)) {
      errors.push(
        `${path}: ${JSON.stringify(value)} is not an entity id in this slice — ` +
          `report slice-wide gaps in patterns/backlog, not in an entityId field`,
      );
    }
  };
  if (!isPlainObject(input)) return { ok: false, errors: ["root: expected a JSON object"] };

  const topKeys = verdictJsonSchema.required;
  checkExactKeys(input, topKeys, "root", errors);
  for (const k of topKeys) if (!(k in input)) errors.push(`root.${k}: missing required key`);

  checkString(input.slice, "slice", errors, { min: 1 });
  if (!Number.isInteger(input.rowsAnalyzed) || (input.rowsAnalyzed as number) < 0) {
    errors.push(`rowsAnalyzed: expected integer ≥ 0, got ${JSON.stringify(input.rowsAnalyzed)}`);
  }

  if (!isPlainObject(input.quality)) {
    errors.push("quality: expected object with the six named criteria");
  } else {
    checkExactKeys(input.quality, QUALITY_CRITERIA, "quality", errors);
    for (const c of QUALITY_CRITERIA) {
      const cv = input.quality[c];
      if (cv === undefined) {
        errors.push(`quality.${c}: missing criterion`);
        continue;
      }
      if (!isPlainObject(cv)) {
        errors.push(`quality.${c}: expected {score,reason}`);
        continue;
      }
      checkExactKeys(cv, ["score", "reason"], `quality.${c}`, errors);
      const s = cv.score;
      if (!Number.isInteger(s) || (s as number) < 1 || (s as number) > 5) {
        errors.push(`quality.${c}.score: expected integer 1-5, got ${JSON.stringify(s)}`);
      }
      checkString(cv.reason, `quality.${c}.reason`, errors, { min: 1 });
    }
  }

  const comp = input.composite;
  if (typeof comp !== "number" || Number.isNaN(comp) || comp < 1 || comp > 5) {
    errors.push(`composite: expected number 1-5, got ${JSON.stringify(comp)}`);
  }

  checkArray(input.entityGaps, "entityGaps", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["entityId", "field", "note"], p, errors);
    checkEntityId(x.entityId, `${p}.entityId`);
    checkString(x.field, `${p}.field`, errors);
    checkString(x.note, `${p}.note`, errors);
  });

  checkArray(input.miscategorized, "miscategorized", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["entityId", "current", "suggested", "why"], p, errors);
    checkEntityId(x.entityId, `${p}.entityId`);
    checkString(x.current, `${p}.current`, errors);
    checkString(x.suggested, `${p}.suggested`, errors);
    checkString(x.why, `${p}.why`, errors);
  });

  checkArray(input.patterns, "patterns", errors, (x, p) => checkString(x, p, errors));

  checkArray(input.opportunities, "opportunities", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["title", "evidence", "productImpact"], p, errors);
    checkString(x.title, `${p}.title`, errors);
    checkString(x.evidence, `${p}.evidence`, errors);
    checkString(x.productImpact, `${p}.productImpact`, errors);
  });

  checkArray(input.backlog, "backlog", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["title", "kind", "why"], p, errors);
    checkString(x.title, `${p}.title`, errors);
    checkString(x.why, `${p}.why`, errors);
    if (!VERDICT_KINDS.includes(x.kind as VerdictKind)) {
      errors.push(`${p}.kind: expected one of ${VERDICT_KINDS.join("|")}, got ${JSON.stringify(x.kind)}`);
    }
  });

  return errors.length === 0
    ? { ok: true, value: input as unknown as AnalysisVerdict, errors: [] }
    : { ok: false, errors };
}

/** Extract the first ```json block (or outermost braces) from raw text and validate. */
export function parseAndValidateVerdict(text: string, options: ValidateVerdictOptions = {}): ValidationResult {
  const raw = extractJsonBlock(text);
  if (raw === null) return { ok: false, errors: ["no JSON block found in subagent output"] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }
  return validateVerdict(parsed, options);
}

export function extractJsonBlock(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim().startsWith("{")) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
