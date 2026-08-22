/* Case ② Effort — batch 010 merge: fold the three army groups into ONE persist payload
 * under a DETERMINISTIC minimal-diff proof.
 *
 * The proof (batch 009's mechanic, which is why this pass needs no fresh money
 * re-verification): a rewrite is accepted only if
 *   1. every sentence of the original that was NOT flagged survives BYTE-IDENTICAL —
 *      so a money sentence, a hedge, a date or an IČO physically cannot have moved;
 *   2. the corrected text trips ZERO committee claims that contradict the graph;
 *   3. it trips zero public-copy jargon rules (the rewrite must not reintroduce the
 *      pipeline vocabulary it was sent to remove);
 *   4. the new sentence count is bounded by the offending sentence count;
 *   5. length growth is bounded (≤250 chars).
 * A unit failing any check is DROPPED with its reason printed — never silently fixed.
 *
 *   npx tsx scripts/case-loops/effort/merge-batch-010.ts --corrected=<snapshot.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractCommitteeClaims } from "@/lib/analysis/committee-claims";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";

const OUT = "docs/data-analysis/case-effort";
const GROUPS = ["A", "B", "C"] as const;
const MAX_GROWTH = 250;

interface Unit {
  pspId: number; name: string; field: string;
  claimedInProse: number; correctedCommitteeCount: number; recomputedDistinctBodies: number;
  offendingSentences: string[]; fullText: string;
}
interface Rewrite { pspId: number; field: string; newText: string; replacements: { old: string; new: string }[]; shape?: string; reasoning?: string }
interface Snap { pspId: number; name: string; committeeCount: number | null; prose: Record<string, string> }

const arg = (k: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

/** Sentence split matching pass42-rewrite-inputs.ts — abbreviation- and citation-safe. */
function sentences(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  const tokens = text.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    buf += tokens[i];
    const t = tokens[i];
    if (/[.!?]["»)]?$/.test(t)) {
      const isAbbrev = /(?:^|\s)(?:tzv|č|s|str|resp|např|mj|tj|atd|apod|zák|odst|písm|Sb|mil|mld|tis|ing|Ing|Mgr|JUDr|PhDr|MUDr|Bc)\.$/u.test(t);
      const nextStartsUpper = /^\s*$/.test(tokens[i + 1] ?? "") && /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ(„]/u.test((tokens[i + 2] ?? "").trim());
      if (!isAbbrev && (nextStartsUpper || i >= tokens.length - 2)) { parts.push(buf); buf = ""; }
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

function main() {
  const inputs = JSON.parse(readFileSync(`${OUT}/payloads/batch-010-rewrite-inputs.json`, "utf8")) as { units: Unit[]; adjudicatedFalsePositives: Record<string, string> };
  const unitByPsp = new Map(inputs.units.map((u) => [u.pspId, u]));
  const snapshot = new Map(
    (JSON.parse(readFileSync(arg("corrected")!, "utf8")) as Snap[]).map((s) => [s.pspId, s]),
  );

  const rewrites: Rewrite[] = [];
  for (const g of GROUPS) {
    const path = `${OUT}/payloads/batch-010-rewrite-group${g}.json`;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { units: Rewrite[] };
    console.log(`group ${g}: ${parsed.units.length} units`);
    rewrites.push(...parsed.units);
  }

  const accepted: { id: string; name: string; props: Record<string, string> }[] = [];
  const drops: string[] = [];
  const report: Record<string, unknown>[] = [];

  for (const r of rewrites) {
    const u = unitByPsp.get(r.pspId);
    if (!u) { drops.push(`psp:person:${r.pspId} — not a batch-010 unit`); continue; }
    const live = snapshot.get(r.pspId)!;
    const original = u.fullText;
    const fails: string[] = [];

    // 0. the original we proved against must still be the live text
    if (live.prose[u.field] !== original) fails.push("live text drifted from the extracted original — re-extract before merging");

    // 1. MINIMAL DIFF — every non-offending sentence byte-identical
    const offending = new Set(u.offendingSentences.map((s) => s.trim()));
    const origSentences = sentences(original);
    const newSentences = sentences(r.newText);
    const keptOriginals = origSentences.filter((s) => !offending.has(s.trim())).map((s) => s.trim());
    const newTrimmed = newSentences.map((s) => s.trim());
    const missing = keptOriginals.filter((s) => !newTrimmed.includes(s));
    if (missing.length) fails.push(`${missing.length} non-offending sentence(s) not preserved byte-identical: ${missing.map((s) => `"${s.slice(0, 60)}…"`).join(" | ")}`);

    // 2. the offending sentences must be GONE
    const survived = [...offending].filter((s) => r.newText.includes(s));
    if (survived.length) fails.push(`${survived.length} offending sentence(s) still present`);

    // 3. zero contradicting committee claims against the CORRECTED prop
    const stillWrong = extractCommitteeClaims(r.newText).filter((c) => c.count !== live.committeeCount);
    if (stillWrong.length) fails.push(`corrected text still claims ${stillWrong.map((c) => `"${c.raw}"`).join(", ")} against committee_count=${live.committeeCount}`);

    // 4. no NEWLY introduced pipeline jargon. Measured as a delta against the original,
    // not absolutely: a violation inherited from a sentence this pass never opened is
    // pre-existing debt, and failing the unit for it would block the correction while
    // fixing nothing. Any such residue is reported separately below.
    const beforeJargon = new Set(jargonViolationDetails(original).map((j) => j.what));
    const newJargon = jargonViolationDetails(r.newText).filter((j) => !beforeJargon.has(j.what));
    if (newJargon.length) fails.push(`public-copy jargon reintroduced: ${newJargon.map((j) => `${j.what} ("${j.match}")`).join(" · ")}`);
    const residualJargon = jargonViolationDetails(r.newText).filter((j) => beforeJargon.has(j.what)).map((j) => j.what);

    // 5. bounded new-sentence count and bounded growth
    if (newSentences.length > origSentences.length + u.offendingSentences.length) {
      fails.push(`sentence count grew ${origSentences.length} → ${newSentences.length}, beyond the ${u.offendingSentences.length} sentence(s) opened for rewrite`);
    }
    const growth = r.newText.length - original.length;
    if (growth > MAX_GROWTH) fails.push(`length grew by ${growth} chars (cap ${MAX_GROWTH})`);

    report.push({ pspId: r.pspId, name: u.name, shape: r.shape ?? null, growth, offendingCount: u.offendingSentences.length, residualJargon, fails });
    if (fails.length) {
      drops.push(`psp:person:${r.pspId} (${u.name}) — ${fails.join(" · ")}`);
      continue;
    }
    accepted.push({ id: `psp:person:${r.pspId}`, name: u.name, props: { [u.field]: r.newText } });
  }

  console.log(`\nMERGE · ${rewrites.length} rewrites · ${accepted.length} ACCEPT · ${drops.length} DROP`);
  for (const d of drops) console.log(`  ✗ ${d}`);
  for (const rep of report.filter((r) => !(r.fails as string[]).length)) {
    console.log(`  ✓ ${rep.name} (shape ${rep.shape}) — ${rep.offendingCount} sentence(s) rewritten, ${(rep.growth as number) >= 0 ? "+" : ""}${rep.growth} chars`);
  }
  // Pre-existing jargon carried by sentences this pass never opened — not a failure here
  // (fixing it would mean editing text outside the correction's scope), but it is debt and
  // it is stated rather than left invisible.
  const withResidue = report.filter((r) => (r.residualJargon as string[]).length);
  if (withResidue.length) {
    console.log(`\nPRE-EXISTING jargon residue on ${withResidue.length} accepted unit(s) — outside this pass's scope, recorded:`);
    for (const r of withResidue) console.log(`  · ${r.name}: ${(r.residualJargon as string[]).join(", ")}`);
  }

  writeFileSync(`${OUT}/payloads/batch-010-props.json`, JSON.stringify({
    case: "effort",
    batch: 10,
    track: "effort",
    method: "pass-42 committee-correction prose reconciliation; minimal-diff proof over analyst rewrites",
    ref: "pass42-committee-prose",
    generatedAt: new Date().toISOString(),
    proposals: accepted,
  }, null, 2));
  writeFileSync(`${OUT}/payloads/batch-010-merge-report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), report, drops }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-props.json (${accepted.length} proposals)`);
  process.exit(drops.length ? 2 : 0);
}

main();
