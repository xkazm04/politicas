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

import { czechGateErrors } from "@/lib/analysis/language-gate";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";
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
  /**
   * Reject a verdict whose reader-facing prose is English (default TRUE — Politicas is
   * Czech-first, and batch 009 measured 27/27 gated verdicts rendering English to Czech
   * readers). Set false only to re-validate an archived pre-rewrite verdict.
   */
  requireCzech?: boolean;
}

/** Law-case pipeline-jargon classes (batch-013 M6, widened batch-014 M8). Module-scoped and
 * exported so the SAME rule runs at persist time (validateLawVerdict) and at render time
 * (features/lawwatch/getLawData.ts withholds on it) — a gate that exists in one place only is
 * a gate the other surface silently lacks. Composes the effort case's shared PIPELINE_JARGON
 * list (public-copy.ts) rather than forking it. */
const LAW_PIPELINE_JARGON: { re: RegExp; what: string }[] = [
  { re: /\b(sectorAdjacency|triageScoreV2|maxTargetChurn|amendsCount|moneyTies|attributedSectorLeads|forensic_[a-z_]+)\b/, what: "internal prop identifier" },
  { re: /\bmp_group\b/, what: "origin enum token" },
  { re: /\.data[\\/]law-collision-cache|law-collision-cache[\\/]tisk-|\.txt\b/, what: "cache file path (cite the psp.cz document URL instead)" },
  { re: /\bpsp:person:\d+|\bbill:tisk:\d+|\bcompany:ico:\d+|\blaw:sb:\d+/, what: "graph urn in prose (urns belong in citation sources, not sentences)" },
  // „dávka" is GENUINELY AMBIGUOUS in this corpus (batch-015 closure audit N5/N6: the same
  // verdicts speak of „paušální dávkou 15 000 Kč" — a social benefit — and „dávka 001" — a
  // pipeline batch id, sentences apart). Only the zero-padded id form is decidable by regex;
  // \p{L}+/u because ASCII \w/\b cannot match Czech letters (the batch-007 lesson, re-learned
  // here on „dávce"/„Dávkový"). The adjectival form is flagged only with „scan" attached.
  // „scan" is bounded by \p{L} lookarounds with optional Czech case endings so that proper
  // names merely BEGINNING with it (Scania, Scanmed — batch-017 audit M8) stay legal prose.
  { re: /\bbatch\b|\bpass[- ]?\d{1,3}\b|(?<!\p{L})dávk\p{L}*\s+0\d{2}(?!\d)|(?<!\p{L})dávkov\p{L}*\s+scan\p{L}*|(?<!\p{L})scan(?:y|u|ů|ům|em|ech)?(?!\p{L})/iu, what: "internal batch/pass reference" },
  { re: /\bkg_(node|edge)s?\b|\bknownIds\b|\bknownLawRefs\b/, what: "pipeline identifier" },
  // batch-016: the residuals the batch-015 closure audit inventoried outside the rule set
  // „case law" alone is a term of art English legal texts quote; only the loop names and the
  // Czech-declined form are pipeline tokens (batch-017 M8).
  { re: /\bchurn\b|(?<!\p{L})gatovan\p{L}*|případu law\b|\bcase (money|effort)\b|\bcase law loop\b/iu, what: "pipeline identifier" },
  // batch-016 audit B7: the classes the NEW verdicts reintroduced while the sweep removed them
  // one directory over — pspId, payload, steward, and digit-less batch-sense „dávka" phrases
  // that are unambiguous WITH these specific heads (přehled/pořadí are never the benefit sense).
  // „steward" flags the bare tie-class token only — declined Czech forms (stewardka,
  // stewardem: palubní průvodčí) are legitimate prose in transport bills (batch-017 M8).
  // „amends" and bare „pending" joined after the batch-017 audit measured „amends" LIVE in a
  // shipped sweep rewrite while only „pending_review" was gated.
  { re: /\bpspId\b|\bpayloadu?\b|(?<!\p{L})steward(?!\p{L})|(?<!\p{L})amends(?!\p{L})|(?<!\p{L})pending(?!\p{L})|\bdávkov\p{L}*\s+přehled\p{L}*|\bpořadí v dávce\b|\bcache\b|(?<!\p{L})cachovan\p{L}*/iu, what: "pipeline identifier" },
  // STRUCTURAL rules (batch-017 — three batches of token-class whack-a-mole ended here for the
  // largest class): Czech prose never contains ASCII camelCase (pspId, sponsorContractCzk,
  // likelyCompanionTisk…), snake_case, or a prop-value shape („sponsors: []", „flagged: false").
  // Diacritics exclude ordinary Czech from the camelCase rule automatically; capitalized brand
  // names (McKinsey) don't match the lowercase-start pattern.
  // The camelCase tail is [\p{L}\p{N}_]* — ASCII \w stops at the first diacritic, which made
  // eSbírka/eObčanka DEAD allowlist entries (the match was „eSb" against an anchored list) and
  // therefore rejected any verdict naming the electronic collection of laws (batch-017 M8).
  // The rule carries `g` because EVERY match must clear the allowlist — the first-match
  // `continue` let one allowlisted name void the whole gate for the rest of the sentence.
  { re: /(?<![\p{L}\p{N}])[a-z][a-z0-9]*[A-Z][\p{L}\p{N}_]*/gu, what: "camelCase identifier" },
  { re: /(?<![\p{L}\p{N}])[\p{L}\p{N}]+_[\p{L}\p{N}]+/u, what: "snake_case identifier" },
  { re: /\p{L}+:\s?(?:\[\]|true\b|false\b|null\b)/u, what: "prop-value shape" },
  { re: /(?<!\p{L})(?:flagged|severity|confidence|origin|status|weight|kind|rel|src|dst):/u, what: "prop-value shape" },
];

/** Real-world camelCase proper nouns AND physical-unit symbols the structural rule must NOT
 * flag: the Czech e-government naming family, EU regulation short names, media brands, and SI
 * unit symbols with internal capitals (kWh, mSv — energy, environmental and health bills
 * cannot be described without them; batch-017 audit M8). Grown by allowlisting a VERIFIED
 * name, never by loosening the rule. */
const CAMEL_ALLOW =
  /^(eKLEP|eTurista|iROZHLAS|eGovernment|eIDAS|eLegislativa|eSbírka|eObčanka|eRecept|eNeschopenka|eDoklady|kW|kWh|kWp|kV|kVA|mSv|mGy|mmHg|hPa|kPa|mAh|dB|eV|keV|pH)$/u;

/** All pipeline-jargon issues in one reader-facing string (law list ∪ shared effort list). */
export function lawJargonIssues(text: string): string[] {
  const out: string[] = [];
  for (const { re, what } of LAW_PIPELINE_JARGON) {
    if (re.global) {
      // batch-017 audit M8: `exec` + `continue` on the first ALLOWLISTED hit voided the whole
      // rule for the rest of the text — the verdict depended on word order. Every match must
      // clear the allowlist; the first that does not is the finding.
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        if (what === "camelCase identifier" && CAMEL_ALLOW.test(m[0])) continue;
        out.push(`pipeline jargon in reader-facing prose — ${what} ("${m[0]}")`);
        break;
      }
      continue;
    }
    const m = re.exec(text);
    if (m) {
      if (what === "camelCase identifier" && CAMEL_ALLOW.test(m[0])) continue;
      out.push(`pipeline jargon in reader-facing prose — ${what} ("${m[0]}")`);
    }
  }
  for (const { what, match } of jargonViolationDetails(text)) {
    // Documented scope limit: the effort case's "sample-scoped self-reference" rule ("v této
    // skupině" etc.) targets dossier prose about the analysis COHORT; in legal prose the same
    // words legitimately denote a statutory group of persons (verdict-257: „v této skupině
    // pojištěnců"). Composing it verbatim would withhold correct Czech.
    if (what.includes("sample-scoped")) continue;
    // Second scope limit (batch-017 closure): the effort case's „dávka <digit>" batch-id rule
    // also matches a radiation dose („dávka 12 mSv") or a benefit amount („dávka 15 000 Kč").
    // Skip the finding only when EVERY nominative dávka-digit occurrence carries a unit or
    // currency; a bare „dávka 12" (the pipeline batch-id shape) still flags.
    if (what.includes("batch/sample") && /^dávka\s*\d/iu.test(match)) {
      const UNIT = /^(?:mSv|µSv|Sv|mGy|Gy|kBq|MBq|Bq|mg|µg|g|ml|l|mmol|kWh|kW|kVA|Kč|EUR)$/u;
      const occ = [...text.matchAll(/(?<!\p{L})dávka\s*\d+(?:[   ]\d{3})*(?:[,.]\d+)?\s*(\p{L}+|€)?/giu)];
      if (occ.length > 0 && occ.every((o) => o[1] !== undefined && (UNIT.test(o[1]) || o[1] === "€"))) continue;
    }
    out.push(`pipeline jargon in reader-facing prose — ${what} ("${match}")`);
  }
  return out;
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

  // PIPELINE-JARGON GATE (batch-013 M6): the audit found internal tokens (`sectorAdjacency:
  // false`, `mp_group`, cache file paths, `psp:person:` ids, batch numbers) in reader-facing
  // prose in 9 of 10 verdicts, and nothing in this contract blocked them — prose rules do not
  // survive the next army; only code does. Scoped to the law case's own token classes;
  // `lib/analysis/public-copy.ts` (the effort case's list) composes separately at call sites.
  if (opts.requireCzech !== false) {
    const readerFields: { label: string; text: unknown }[] = [
      { label: "statedReasoning", text: input.statedReasoning },
      { label: "researchedContext", text: input.researchedContext },
      { label: "conflictAssessment", text: input.conflictAssessment },
    ];
    if (Array.isArray(input.unstatedEffects))
      input.unstatedEffects.forEach((u, i) => {
        if (!isObj(u)) return;
        readerFields.push({ label: `unstatedEffects[${i}].effect`, text: u.effect });
        readerFields.push({ label: `unstatedEffects[${i}].whoBenefits`, text: u.whoBenefits });
        readerFields.push({ label: `unstatedEffects[${i}].evidence`, text: u.evidence });
      });
    if (Array.isArray(input.citations))
      input.citations.forEach((c, i) => {
        if (isObj(c)) readerFields.push({ label: `citations[${i}].claim`, text: c.claim });
      });
    for (const f of readerFields) {
      if (typeof f.text !== "string") continue;
      for (const issue of lawJargonIssues(f.text)) e.push(`${f.label}: ${issue}`);
    }
  }

  // CZECH-FIRST: every string this verdict renders to a reader must be Czech. An English
  // artifact on a reader-facing field is a defect, not a style preference — the same rule
  // `features/lawwatch/getLawData.ts` enforces at render time (lib/analysis/language-gate.ts).
  if (opts.requireCzech !== false) {
    const fields: { label: string; text: string | null | undefined }[] = [
      { label: "statedReasoning", text: typeof input.statedReasoning === "string" ? input.statedReasoning : null },
      { label: "researchedContext", text: typeof input.researchedContext === "string" ? input.researchedContext : null },
      { label: "conflictAssessment", text: typeof input.conflictAssessment === "string" ? input.conflictAssessment : null },
    ];
    if (Array.isArray(input.unstatedEffects))
      input.unstatedEffects.forEach((u, i) => {
        if (!isObj(u)) return;
        fields.push({ label: `unstatedEffects[${i}].effect`, text: typeof u.effect === "string" ? u.effect : null });
        fields.push({ label: `unstatedEffects[${i}].whoBenefits`, text: typeof u.whoBenefits === "string" ? u.whoBenefits : null });
      });
    if (Array.isArray(input.citations))
      input.citations.forEach((c, i) => {
        if (!isObj(c)) return;
        fields.push({ label: `citations[${i}].claim`, text: typeof c.claim === "string" ? c.claim : null });
      });
    e.push(...czechGateErrors(fields));
  }

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
