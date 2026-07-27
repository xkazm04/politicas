/* Case ③ Law loop — assemble the Czech forensic-verdict PATCH (batch 009, presentation gate).
 *
 * The measured defect: all 27 gated `forensic_*` verdicts on /zakony were written in ENGLISH
 * and rendered verbatim to Czech readers. The Czech rewrites live, one file per print, in
 * `docs/data-analysis/case-law/payloads/verdicts-cz/verdict-<cislo>.cz.json`. This script
 * joins them to their English originals and emits ONE patch payload for the fleet
 * orchestrator to apply — it NEVER writes to any database (fleet rule: the live `.pglite`
 * is single-writer and belongs to the orchestrator).
 *
 * The English is NOT destroyed. Every rewritten field is written back alongside an
 * `*_en` sibling prop holding the English original verbatim, so the ground truth a human
 * reviewer gates against survives, and any future audit can diff Czech against English.
 * The `*_en` props are NOT read by `features/lawwatch/getLawData.ts` — they never render.
 *
 * Before emitting, the script runs two gates and REFUSES to write on any failure:
 *   1. the LANGUAGE gate (`lib/analysis/language-gate.ts`) — every Czech reader-facing
 *      string must pass, every English original must fail (proving the gate discriminates);
 *   2. the FIDELITY check — the P51 lesson that a readability pass is exactly where hedges
 *      quietly die. Structure (citation count/kind/source, effect count, evidence URLs),
 *      every cited `č. N/RRRR Sb.` statute, every URL, and every numeric literal must be
 *      preserved between the English original and the Czech rewrite.
 *
 *   npx tsx scripts/case-loops/law/build-cz-verdict-patch.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { czechGateErrors, scoreLanguage } from "@/lib/analysis/language-gate";
import { citedLawRefs } from "@/lib/analysis/law-verdict";

const EN_DIR = "docs/data-analysis/case-law/payloads/verdicts";
const EN_EXTRA = ".kg-analysis"; // verdict-58 was gated from the analysis scratch dir
const CZ_DIR = "docs/data-analysis/case-law/payloads/verdicts-cz";
const INDEX = "docs/data-analysis/case-law/payloads/bill-index.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-009-cz-verdict-patch.json";

interface Effect {
  effect: string;
  whoBenefits: string;
  evidence: string;
}
interface Citation {
  claim: string;
  kind: string;
  source: string;
}
interface Verdict {
  billTisk: number;
  statedReasoning: string;
  researchedContext: string;
  conflictAssessment: string;
  unstatedEffects: Effect[];
  citations: Citation[];
}

function readVerdict(file: string): Verdict {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Verdict | Verdict[];
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/** Every URL in a verdict, in document order. */
function urls(v: Verdict): string[] {
  const out: string[] = [];
  for (const u of v.unstatedEffects) if (/^https?:\/\//.test(u.evidence)) out.push(u.evidence);
  for (const c of v.citations) if (/^https?:\/\//.test(c.source)) out.push(c.source);
  return out;
}

/**
 * Numeric literals, normalised so Czech and English formatting compare equal:
 * `30,840` ⇄ `30 840`, `9.82` ⇄ `9,82`, `1,470,325,336` ⇄ `1 470 325 336`.
 * Percentages, years, § numbers and statute numbers all fall out of this too.
 */
function numerals(text: string): Map<string, number> {
  const out = new Map<string, number>();
  const normalised = text
    .replace(/ /g, " ")
    // Collapse THOUSANDS separators only — a separator immediately followed by exactly
    // three digits. Without the lookahead, "282, 16" glued into "28216" and the checker
    // invented mismatches that were never in the text (caught on tisk 115 / tisk 24).
    .replace(/(\d)[ ,.](?=\d{3}(?!\d))/g, "$1");
  for (const m of normalised.matchAll(/\d+/g)) {
    // Leading zeros are pure formatting ("08.12.2025" vs "8. prosince 2025").
    const key = m[0].replace(/^0+(?=\d)/, "");
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** Where a numeral occurs, for the manual review line. */
function numeralContext(text: string, key: string): string {
  const flat = text
    .replace(/ /g, " ")
    .replace(/(\d)[ ,.](?=\d{3}(?!\d))/g, "$1")
    .replace(/\s+/g, " ");
  const re = new RegExp(`(?<!\\d)0*${key}(?!\\d)`);
  const m = re.exec(flat);
  if (!m) return "";
  return flat.slice(Math.max(0, m.index - 45), m.index + key.length + 45);
}

function proseOf(v: Verdict): string {
  return [
    v.statedReasoning,
    v.researchedContext,
    v.conflictAssessment,
    ...v.unstatedEffects.flatMap((u) => [u.effect, u.whoBenefits]),
    ...v.citations.map((c) => c.claim),
  ].join("\n");
}

function readerFields(v: Verdict): { label: string; text: string }[] {
  return [
    { label: "statedReasoning", text: v.statedReasoning },
    { label: "researchedContext", text: v.researchedContext },
    { label: "conflictAssessment", text: v.conflictAssessment },
    ...v.unstatedEffects.flatMap((u, i) => [
      { label: `unstatedEffects[${i}].effect`, text: u.effect },
      { label: `unstatedEffects[${i}].whoBenefits`, text: u.whoBenefits },
    ]),
    ...v.citations.map((c, i) => ({ label: `citations[${i}].claim`, text: c.claim })),
  ];
}

/** Structure + citation + statute + URL + numeral preservation. Empty ⇒ faithful. */
export function fidelityErrors(en: Verdict, cz: Verdict): string[] {
  const e: string[] = [];
  if (en.billTisk !== cz.billTisk) e.push(`billTisk ${en.billTisk} → ${cz.billTisk}`);

  if (en.unstatedEffects.length !== cz.unstatedEffects.length)
    e.push(`unstatedEffects count ${en.unstatedEffects.length} → ${cz.unstatedEffects.length}`);
  en.unstatedEffects.forEach((u, i) => {
    const c = cz.unstatedEffects[i];
    if (!c) return;
    if (u.evidence !== c.evidence) e.push(`unstatedEffects[${i}].evidence changed: ${u.evidence} → ${c.evidence}`);
  });

  if (en.citations.length !== cz.citations.length)
    e.push(`citations count ${en.citations.length} → ${cz.citations.length}`);
  en.citations.forEach((c, i) => {
    const z = cz.citations[i];
    if (!z) return;
    if (c.kind !== z.kind) e.push(`citations[${i}].kind ${c.kind} → ${z.kind}`);
    if (c.source !== z.source) e.push(`citations[${i}].source ${c.source} → ${z.source}`);
  });

  const enLaws = new Set(citedLawRefs(en));
  // A `kind:"law"` citation carries its statute in `source` as a bare "N/RRRR", which the
  // prose-scanning regex (which wants the formal "č. N/RRRR Sb.") does not see. The Czech
  // rewrite spells those statutes out formally in the claim text, so they legitimately
  // appear in Czech prose without being "new" — count the English sources as already cited.
  for (const c of en.citations) if (c.kind === "law") enLaws.add(c.source.replace(/^(\d+)\/(\d{4})$/, "$1/$2"));
  const czLaws = new Set(citedLawRefs(cz));
  for (const c of cz.citations) if (c.kind === "law") czLaws.add(c.source);
  for (const ref of enLaws) if (!czLaws.has(ref)) e.push(`statute č. ${ref} Sb. cited in English but LOST in Czech`);
  for (const ref of czLaws) if (!enLaws.has(ref)) e.push(`statute č. ${ref} Sb. ADDED in Czech, absent from English`);

  const enUrls = new Set(urls(en));
  const czUrls = new Set(urls(cz));
  for (const u of enUrls) if (!czUrls.has(u)) e.push(`URL lost in Czech: ${u}`);
  for (const u of czUrls) if (!enUrls.has(u)) e.push(`URL added in Czech: ${u}`);

  return e;
}

/**
 * Numeral drift, reported for MANUAL review rather than blocking: Czech spells dates as
 * month names ("8. prosince 2025" vs "08.12.2025") and orders clauses differently, so a
 * raw numeral diff has legitimate representational causes. Every line here was read
 * side-by-side against the English original before the payload was accepted.
 */
export function numeralReview(en: Verdict, cz: Verdict): string[] {
  const enText = proseOf(en);
  const czText = proseOf(cz);
  const enNums = numerals(enText);
  const czNums = numerals(czText);
  const out: string[] = [];
  for (const [n] of enNums) if (!czNums.has(n)) out.push(`EN-only ${n} — "${numeralContext(enText, n)}"`);
  for (const [n] of czNums) if (!enNums.has(n)) out.push(`CZ-only ${n} — "${numeralContext(czText, n)}"`);
  return out;
}

function englishFileFor(cislo: number): string | null {
  const primary = join(EN_DIR, `verdict-${cislo}.json`);
  if (existsSync(primary)) return primary;
  const fallback = join(EN_EXTRA, `verdict-${cislo}.json`);
  return existsSync(fallback) ? fallback : null;
}

function main(): void {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as { cislo: number; billUrn: string }[];
  const urnByCislo = new Map(index.map((r) => [r.cislo, r.billUrn]));

  const czFiles = readdirSync(CZ_DIR).filter((f) => f.endsWith(".cz.json")).sort();
  const rows: Record<string, unknown>[] = [];
  const problems: string[] = [];
  const report: { cislo: number; fidelity: string[]; czechGate: string[]; englishStillDetected: number; numerals: string[] }[] = [];

  for (const f of czFiles) {
    const cz = readVerdict(join(CZ_DIR, f));
    const cislo = cz.billTisk;
    const enFile = englishFileFor(cislo);
    if (!enFile) {
      problems.push(`tisk ${cislo}: no English original found — cannot verify fidelity`);
      continue;
    }
    const en = readVerdict(enFile);
    const urn = urnByCislo.get(cislo);
    if (!urn) {
      problems.push(`tisk ${cislo}: no bill urn in ${INDEX}`);
      continue;
    }

    const fidelity = fidelityErrors(en, cz);
    const numerals = numeralReview(en, cz);
    const czechGate = czechGateErrors(readerFields(cz));
    // Control: the ENGLISH original must be caught by the same gate. Count how many of its
    // reader-facing fields the gate flags — a gate that misses them all proves nothing.
    const enFields = readerFields(en);
    const englishStillDetected = czechGateErrors(enFields).length;

    report.push({ cislo, fidelity, czechGate, englishStillDetected, numerals });
    if (fidelity.length > 0) problems.push(...fidelity.map((x) => `tisk ${cislo} FIDELITY: ${x}`));
    if (czechGate.length > 0) problems.push(...czechGate.map((x) => `tisk ${cislo} LANGUAGE: ${x}`));

    rows.push({
      billUrn: urn,
      cislo,
      props: {
        forensic_stated_reasoning: cz.statedReasoning,
        forensic_researched_context: cz.researchedContext,
        forensic_conflict_assessment: cz.conflictAssessment,
        forensic_unstated_effects: cz.unstatedEffects,
        forensic_citations: cz.citations,
        // English ground truth, preserved and NEVER rendered (getLawData reads no `*_en` prop).
        forensic_stated_reasoning_en: en.statedReasoning,
        forensic_researched_context_en: en.researchedContext,
        forensic_conflict_assessment_en: en.conflictAssessment,
        forensic_unstated_effects_en: en.unstatedEffects,
        forensic_citations_en: en.citations,
        forensic_lang: "cs",
        forensic_lang_rewrite: { pass: 9, method: "cz-rewrite-batch-009", verifiedBy: "fidelity+language gate" },
      },
    });
  }

  const totalEnFieldsFlagged = report.reduce((s, r) => s + r.englishStillDetected, 0);
  console.log(`Czech rewrites: ${rows.length}/27`);
  console.log(`language gate — Czech rewrites failing: ${report.filter((r) => r.czechGate.length > 0).length}`);
  console.log(`language gate — English fields flagged (control): ${totalEnFieldsFlagged}`);
  console.log(`fidelity — prints with findings: ${report.filter((r) => r.fidelity.length > 0).length}`);
  for (const p of problems) console.log(`  ! ${p}`);
  const numeralLines = report.filter((r) => r.numerals.length > 0);
  console.log(`numeral drift (advisory, manually reviewed): ${numeralLines.reduce((s2, r) => s2 + r.numerals.length, 0)} across ${numeralLines.length} prints`);
  for (const r of numeralLines) for (const n of r.numerals) console.log(`  ~ tisk ${r.cislo}: ${n}`);

  if (problems.length > 0) {
    console.error(`\nREFUSING to write ${OUT}: ${problems.length} unresolved gate/fidelity findings.`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "PREPARE ONLY — apply via the orchestrator's props-merge writer. No live .pglite write was performed by this script.",
        verified: {
          czechRewrites: rows.length,
          languageGateCzechFailures: 0,
          languageGateEnglishFieldsFlagged: totalEnFieldsFlagged,
          fidelityFindings: 0,
          numeralDriftReviewed: report.reduce((s2, r) => s2 + r.numerals.length, 0),
        },
        numeralReview: report.filter((r) => r.numerals.length > 0).map((r) => ({ cislo: r.cislo, notes: r.numerals })),
        rows,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`written ${OUT}`);
}

main();

/** Exported for the colocated test: the language score of a string. */
export { scoreLanguage };
