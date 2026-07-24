// Case ③ Layer 3 — the law-change forensics VERDICT contract + the deterministic gate
// that keeps the LLM honest. A forensic pass contrasts a bill's STATED reasoning (its
// důvodová zpráva) against RESEARCHED effects and hypothesizes unstated economic/
// negative effects + any conflict with the sponsor's money ties (Case ①). Because this
// is civic-legal analysis, FABRICATION IS THE WORST FAILURE — a made-up law number or
// an uncited claim can defame. So every verdict is gated:
//   1. shape (a subagent cannot return a drifted structure — structured-output schema);
//   2. every `č. N/RRRR Sb.` cited ANYWHERE in prose must be a REAL law (known to the
//      graph or the bill's amended-laws) — a hallucinated statute is rejected;
//   3. every hypothesised unstated effect must carry ≥1 citation (no uncited accusation);
//   4. web citations must be URLs; graph-fact citations must reference a known id.
// A verdict that fails the gate is discarded/re-run, never persisted. Findings that pass
// are written pending_review — a lead for a human, never a published verdict.

import { LAW_CITATION } from "@/lib/ingest/sources/psp-legislation";

export const LAW_FINDING_SEVERITY = ["low", "medium", "high"] as const;
export type LawFindingSeverity = (typeof LAW_FINDING_SEVERITY)[number];
export const LAW_CITATION_KINDS = ["bill_text", "web", "graph_fact", "law"] as const;
export type LawCitationKind = (typeof LAW_CITATION_KINDS)[number];

export const LAW_VERDICT_SCHEMA_VERSION = "law-verdict-cz-v1";

export interface LawCitation {
  claim: string;
  kind: LawCitationKind;
  source: string; // a URL (web/bill_text), a "č. N/RRRR Sb." (law), or a graph id (graph_fact)
}
export interface UnstatedEffect {
  effect: string;
  whoBenefits: string;
  evidence: string; // must cite — a source string that also appears in citations
}
export interface LawForensicVerdict {
  billTisk: number;
  statedReasoning: string; // faithful summary of the official důvodová zpráva
  researchedContext: string; // what independent research/evidence shows
  unstatedEffects: UnstatedEffect[];
  conflictAssessment: string; // grounded in the sponsor's Case-① money graph
  severity: LawFindingSeverity;
  confidence: number; // 1–5
  citations: LawCitation[];
}

/** JSON Schema (draft-07) — pass verbatim as a subagent's structured-output schema. */
export const lawVerdictJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://politicas.local/schemas/data-analysis/law-verdict.json",
  title: "LawForensicVerdict",
  type: "object",
  additionalProperties: false,
  required: ["billTisk", "statedReasoning", "researchedContext", "unstatedEffects", "conflictAssessment", "severity", "confidence", "citations"],
  properties: {
    billTisk: { type: "integer" },
    statedReasoning: { type: "string", minLength: 1 },
    researchedContext: { type: "string", minLength: 1 },
    unstatedEffects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["effect", "whoBenefits", "evidence"],
        properties: {
          effect: { type: "string", minLength: 1 },
          whoBenefits: { type: "string", minLength: 1 },
          evidence: { type: "string", minLength: 1 },
        },
      },
    },
    conflictAssessment: { type: "string", minLength: 1 },
    severity: { type: "string", enum: [...LAW_FINDING_SEVERITY] },
    confidence: { type: "integer", minimum: 1, maximum: 5 },
    citations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "kind", "source"],
        properties: {
          claim: { type: "string", minLength: 1 },
          kind: { type: "string", enum: [...LAW_CITATION_KINDS] },
          source: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export interface ValidationResult {
  ok: boolean;
  value?: LawForensicVerdict;
  errors: string[];
}
export interface ValidateLawVerdictOptions {
  /** Real law refs the verdict may cite: "N/RRRR" (bill's amended laws + graph law nodes). */
  knownLawRefs?: Iterable<string>;
  /** Real graph ids a graph_fact citation may reference (company/person/law urns). */
  knownIds?: Iterable<string>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, path: string, e: string[], min = 1): void {
  if (typeof v !== "string") e.push(`${path}: expected string, got ${typeof v}`);
  else if (v.length < min) e.push(`${path}: shorter than ${min}`);
}

/** Distinct `č. N/RRRR Sb.` law refs cited anywhere in the verdict's prose (as "N/RRRR"). */
export function citedLawRefs(input: unknown): string[] {
  const text = JSON.stringify(input ?? "");
  const out = new Set<string>();
  for (const m of text.matchAll(LAW_CITATION)) out.add(`${Number(m[1])}/${m[2]}`);
  return [...out];
}

export function validateLawVerdict(input: unknown, opts: ValidateLawVerdictOptions = {}): ValidationResult {
  const e: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["root: expected a JSON object"] };
  for (const k of lawVerdictJsonSchema.required) if (!(k in input)) e.push(`root.${k}: missing`);
  for (const k of Object.keys(input)) if (!(lawVerdictJsonSchema.required as readonly string[]).includes(k)) e.push(`root.${k}: unexpected key`);

  if (typeof input.billTisk !== "number" || !Number.isInteger(input.billTisk)) e.push("billTisk: expected integer");
  str(input.statedReasoning, "statedReasoning", e);
  str(input.researchedContext, "researchedContext", e);
  str(input.conflictAssessment, "conflictAssessment", e);
  if (typeof input.severity !== "string" || !(LAW_FINDING_SEVERITY as readonly string[]).includes(input.severity)) e.push("severity: invalid");
  if (!Number.isInteger(input.confidence) || (input.confidence as number) < 1 || (input.confidence as number) > 5) e.push("confidence: expected 1-5");

  // every unstated effect must be cited (no uncited accusation)
  if (!Array.isArray(input.unstatedEffects)) e.push("unstatedEffects: expected array");
  else
    input.unstatedEffects.forEach((u, i) => {
      if (!isObj(u)) return void e.push(`unstatedEffects[${i}]: expected object`);
      str(u.effect, `unstatedEffects[${i}].effect`, e);
      str(u.whoBenefits, `unstatedEffects[${i}].whoBenefits`, e);
      str(u.evidence, `unstatedEffects[${i}].evidence`, e);
    });

  const known = opts.knownIds ? new Set(opts.knownIds) : null;
  const knownLaws = opts.knownLawRefs ? new Set(opts.knownLawRefs) : null;
  if (!Array.isArray(input.citations) || input.citations.length < 1) e.push("citations: expected non-empty array");
  else
    input.citations.forEach((c, i) => {
      if (!isObj(c)) return void e.push(`citations[${i}]: expected object`);
      str(c.claim, `citations[${i}].claim`, e);
      str(c.source, `citations[${i}].source`, e);
      if (typeof c.kind !== "string" || !(LAW_CITATION_KINDS as readonly string[]).includes(c.kind)) e.push(`citations[${i}].kind: invalid`);
      if (c.kind === "web" || c.kind === "bill_text") {
        if (typeof c.source !== "string" || !/^https?:\/\//.test(c.source)) e.push(`citations[${i}].source: ${c.kind} citation must be a URL`);
      } else if (c.kind === "graph_fact" && known && typeof c.source === "string" && !known.has(c.source)) {
        e.push(`citations[${i}].source: graph_fact ${JSON.stringify(c.source)} is not a known graph id`);
      } else if (c.kind === "law" && knownLaws && typeof c.source === "string") {
        const ref = c.source.match(/(\d{1,4})\s*\/\s*(\d{4})/);
        const norm = ref ? `${Number(ref[1])}/${ref[2]}` : c.source;
        if (!knownLaws.has(norm)) e.push(`citations[${i}].source: law ${JSON.stringify(c.source)} is not a real statute in scope`);
      }
    });

  // ANTI-FABRICATION: every law number cited ANYWHERE in prose must be real.
  if (knownLaws) {
    for (const ref of citedLawRefs(input)) {
      if (!knownLaws.has(ref)) e.push(`cited statute č. ${ref} Sb. is not a real law in scope — a fabricated legal citation`);
    }
  }

  return e.length === 0 ? { ok: true, value: input as unknown as LawForensicVerdict, errors: [] } : { ok: false, errors: e };
}

export function extractJsonBlock(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim().startsWith("{")) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : null;
}
export function parseAndValidateLawVerdict(text: string, opts: ValidateLawVerdictOptions = {}): ValidationResult {
  const raw = extractJsonBlock(text);
  if (raw === null) return { ok: false, errors: ["no JSON block found in subagent output"] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`] };
  }
  return validateLawVerdict(parsed, opts);
}
