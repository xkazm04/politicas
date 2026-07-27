// Knowledge-graph verdict contract — the schema every KG-loop Sonnet subagent
// must return for one frontier target, and the deterministic gate that keeps a
// HALLUCINATED politician or a FABRICATED edge out of the graph (design §4.4–4.5).
//
// This mirrors lib/analysis/verdict.ts (the per-slice contract) and is the SINGLE
// SOURCE OF TRUTH for the KG contract:
//   - KG_NODE_KINDS / KG_EDGE_RELS / KG_FRONTIER_KINDS / APP_MODULES — the enums,
//     kept in sync with docs/data-analysis/graph-schema.md and lib/db (kg_node.kind).
//   - kgVerdictJsonSchema — draft-07; pass verbatim as a subagent's structured-output
//     schema so the model physically cannot return a drifted shape.
//   - validateKgVerdict() — a dependency-free gate. Two checks beyond shape:
//       1. every edge endpoint is a KNOWN entity id or a node this verdict declares
//          (a raw `psp:*` id that isn't real → rejected: a fabricated relationship);
//       2. every `psp:<table>:<id>` token cited ANYWHERE in prose must be a real id
//          (a hallucinated MP referenced in a pattern/opportunity → rejected).
//   Run EVERY returned verdict through it and discard/re-run on drift; never persist
//   a drifted or fabricated proposal.

// batch-007 (case loops apply-insert path): "notice" added per case-sources' kiosek
// handoff (docs/data-analysis/case-sources/handoff.md) — a kiosek.justice.cz úřední-deska
// posting node.
export const KG_NODE_KINDS = ["person", "party", "organ", "bloc", "theme", "company", "contract", "bill", "law", "notice"] as const;
export type KgNodeKind = (typeof KG_NODE_KINDS)[number];

export const KG_EDGE_RELS = [
  "co_votes_with",
  "rebels_against",
  "belongs_to",
  "about",
  "owns",
  "influential_in",
  "linked_to",
  "supplies",
  "sponsors",
  "amends",
  "assigned_to",
  // batch-007 additions:
  // "owns_stake" (company -> company, dated shareholder stake) per case-money's
  // batch-006 ownership-chains payload (docs/data-analysis/case-money/payloads/
  // batch-006-ownership-chains.json).
  "owns_stake",
  // "cites" (notice -> law) and "concerns" (notice -> company) per case-sources'
  // kiosek handoff (docs/data-analysis/case-sources/handoff.md).
  "cites",
  "concerns",
  // "rapporteur" (person -> bill, 2026-07-27): zpravodaj assignments from psp.cz
  // tisky.zip (hist.orgv_id_posl/ps_id_posl + hist_vybory.id_posl + tisky_za.id_posl),
  // props {scopes, organ_ids} — the "who did the analytical work" role that sponsors
  // edges cannot carry. Writer: scripts/data-analysis/kg-bill-roles-ingest.ts.
  "rapporteur",
] as const;
export type KgEdgeRel = (typeof KG_EDGE_RELS)[number];

export const KG_FRONTIER_KINDS = [
  "analyze-cluster",
  "test-hypothesis",
  "expand-node",
  "recompute-edge",
  "blocked-on-data",
] as const;
export type KgFrontierKind = (typeof KG_FRONTIER_KINDS)[number];

export const APP_MODULES = ["CivicScore", "VoteTrack", "FollowTheMoney", "BudgetMirror", "LawWatch"] as const;
export type AppModule = (typeof APP_MODULES)[number];

export const KG_VERDICT_SCHEMA_VERSION = "kg-verdict-cz-v1";

/** A raw-entity urn cited in prose: psp:<table>:<numeric id>. */
const ENTITY_URN = /\bpsp:[a-z_]+:\d+\b/g;

export interface NodeProposal {
  id: string;
  kind: KgNodeKind;
  label: string;
  rationale: string;
}
export interface EdgeProposal {
  src: string;
  rel: KgEdgeRel;
  dst: string;
  weight?: number;
  rationale: string;
}
export interface KgPattern {
  statement: string;
  evidence: string; // cites entity ids / counts
}
export interface KgFeatureOpportunity {
  module: AppModule;
  title: string;
  evidence: string;
  proposal: string;
}
export interface KgFrontierItem {
  kind: KgFrontierKind;
  target: string;
  why: string;
  priority: number; // 1–5
}
export interface KgVerdict {
  target: string;
  summary: string;
  nodes: NodeProposal[];
  edges: EdgeProposal[];
  patterns: KgPattern[];
  featureOpportunities: KgFeatureOpportunity[];
  frontier: KgFrontierItem[];
}

/* ── JSON Schema ───────────────────────────────────────────────────────────── */

export const kgVerdictJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://politicas.local/schemas/data-analysis/kg-verdict.json",
  title: "KgVerdict",
  description: "The structured verdict a knowledge-graph-loop Sonnet subagent returns for one frontier target.",
  type: "object",
  additionalProperties: false,
  required: ["target", "summary", "nodes", "edges", "patterns", "featureOpportunities", "frontier"],
  properties: {
    target: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "label", "rationale"],
        properties: {
          id: { type: "string", minLength: 1 },
          kind: { type: "string", enum: [...KG_NODE_KINDS] },
          label: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["src", "rel", "dst", "rationale"],
        properties: {
          src: { type: "string", minLength: 1 },
          rel: { type: "string", enum: [...KG_EDGE_RELS] },
          dst: { type: "string", minLength: 1 },
          weight: { type: "number" },
          rationale: { type: "string", minLength: 1 },
        },
      },
    },
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "evidence"],
        properties: {
          statement: { type: "string", minLength: 1 },
          evidence: { type: "string", minLength: 1 },
        },
      },
    },
    featureOpportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["module", "title", "evidence", "proposal"],
        properties: {
          module: { type: "string", enum: [...APP_MODULES] },
          title: { type: "string", minLength: 1 },
          evidence: { type: "string", minLength: 1 },
          proposal: { type: "string", minLength: 1 },
        },
      },
    },
    frontier: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "target", "why", "priority"],
        properties: {
          kind: { type: "string", enum: [...KG_FRONTIER_KINDS] },
          target: { type: "string", minLength: 1 },
          why: { type: "string", minLength: 1 },
          priority: { type: "integer", minimum: 1, maximum: 5 },
        },
      },
    },
  },
} as const;

/* ── deterministic validator ─────────────────────────────────────────────── */

export interface ValidationResult {
  ok: boolean;
  value?: KgVerdict;
  errors: string[];
}

export interface ValidateKgVerdictOptions {
  /**
   * Every real id the graph may reference: existing kg_node ids + raw entity urns
   * (person/organ/vote…). When supplied, an edge endpoint or a prose-cited
   * `psp:*` urn that is neither known nor declared in this verdict is rejected.
   */
  knownIds?: Iterable<string>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function checkString(v: unknown, path: string, errors: string[], min = 1): void {
  if (typeof v !== "string") errors.push(`${path}: expected string, got ${typeof v}`);
  else if (v.length < min) errors.push(`${path}: string is shorter than ${min}`);
}
function checkExactKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string, errors: string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${path}.${k}: unexpected key (invented field — not in the schema)`);
  }
}
function checkArray(v: unknown, path: string, errors: string[], item: (x: unknown, p: string) => void): void {
  if (!Array.isArray(v)) {
    errors.push(`${path}: expected array, got ${v === null ? "null" : typeof v}`);
    return;
  }
  v.forEach((x, i) => item(x, `${path}[${i}]`));
}
function checkEnum(v: unknown, allowed: readonly string[], path: string, errors: string[]): void {
  if (typeof v !== "string" || !allowed.includes(v)) {
    errors.push(`${path}: expected one of ${allowed.join("|")}, got ${JSON.stringify(v)}`);
  }
}

export function validateKgVerdict(input: unknown, options: ValidateKgVerdictOptions = {}): ValidationResult {
  const errors: string[] = [];
  const known = options.knownIds ? new Set(options.knownIds) : null;
  if (!isPlainObject(input)) return { ok: false, errors: ["root: expected a JSON object"] };

  const topKeys = kgVerdictJsonSchema.required;
  checkExactKeys(input, topKeys, "root", errors);
  for (const k of topKeys) if (!(k in input)) errors.push(`root.${k}: missing required key`);

  checkString(input.target, "target", errors);
  checkString(input.summary, "summary", errors);

  // nodes — collect the ids this verdict declares (valid edge endpoints even if new).
  const declared = new Set<string>();
  checkArray(input.nodes, "nodes", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["id", "kind", "label", "rationale"], p, errors);
    checkString(x.id, `${p}.id`, errors);
    checkEnum(x.kind, KG_NODE_KINDS, `${p}.kind`, errors);
    checkString(x.label, `${p}.label`, errors);
    checkString(x.rationale, `${p}.rationale`, errors);
    if (typeof x.id === "string") declared.add(x.id);
  });

  // edges — shape + the MEMBERSHIP GATE on endpoints.
  checkArray(input.edges, "edges", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["src", "rel", "dst", "weight", "rationale"], p, errors);
    checkString(x.src, `${p}.src`, errors);
    checkEnum(x.rel, KG_EDGE_RELS, `${p}.rel`, errors);
    checkString(x.dst, `${p}.dst`, errors);
    checkString(x.rationale, `${p}.rationale`, errors);
    if (x.weight !== undefined && typeof x.weight !== "number") {
      errors.push(`${p}.weight: expected number, got ${typeof x.weight}`);
    }
    if (known) {
      for (const [slot, id] of [["src", x.src] as const, ["dst", x.dst] as const]) {
        if (typeof id === "string" && id.length > 0 && !known.has(id) && !declared.has(id)) {
          errors.push(
            `${p}.${slot}: ${JSON.stringify(id)} is not a known entity/node and is not declared in this verdict — ` +
              `a fabricated relationship endpoint`,
          );
        }
      }
    }
  });

  checkArray(input.patterns, "patterns", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["statement", "evidence"], p, errors);
    checkString(x.statement, `${p}.statement`, errors);
    checkString(x.evidence, `${p}.evidence`, errors);
  });

  checkArray(input.featureOpportunities, "featureOpportunities", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["module", "title", "evidence", "proposal"], p, errors);
    checkEnum(x.module, APP_MODULES, `${p}.module`, errors);
    checkString(x.title, `${p}.title`, errors);
    checkString(x.evidence, `${p}.evidence`, errors);
    checkString(x.proposal, `${p}.proposal`, errors);
  });

  checkArray(input.frontier, "frontier", errors, (x, p) => {
    if (!isPlainObject(x)) return void errors.push(`${p}: expected object`);
    checkExactKeys(x, ["kind", "target", "why", "priority"], p, errors);
    checkEnum(x.kind, KG_FRONTIER_KINDS, `${p}.kind`, errors);
    checkString(x.target, `${p}.target`, errors);
    checkString(x.why, `${p}.why`, errors);
    if (!Number.isInteger(x.priority) || (x.priority as number) < 1 || (x.priority as number) > 5) {
      errors.push(`${p}.priority: expected integer 1-5, got ${JSON.stringify(x.priority)}`);
    }
  });

  // Anti-hallucination sweep: every raw-entity urn cited in ANY prose must be real.
  if (known) {
    for (const cited of citedEntityUrns(input)) {
      if (!known.has(cited)) {
        errors.push(`cited urn ${JSON.stringify(cited)} is not a real entity — a hallucinated MP/organ reference`);
      }
    }
  }

  return errors.length === 0
    ? { ok: true, value: input as unknown as KgVerdict, errors: [] }
    : { ok: false, errors };
}

/** Distinct `psp:*` urns cited anywhere in the verdict's prose (deduped). */
export function citedEntityUrns(input: unknown): string[] {
  const text = JSON.stringify(input ?? "");
  const out = new Set<string>();
  for (const m of text.matchAll(ENTITY_URN)) out.add(m[0]);
  return [...out];
}

/** Extract the first ```json block (or outermost braces) from raw text and validate. */
export function parseAndValidateKgVerdict(text: string, options: ValidateKgVerdictOptions = {}): ValidationResult {
  const raw = extractJsonBlock(text);
  if (raw === null) return { ok: false, errors: ["no JSON block found in subagent output"] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }
  return validateKgVerdict(parsed, options);
}

export function extractJsonBlock(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim().startsWith("{")) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}
