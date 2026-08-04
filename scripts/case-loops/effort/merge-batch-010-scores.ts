/* Case ② Effort — batch 010, second merge: the stale-SCORE reconciliation.
 *
 * Same minimal-diff proof as merge-batch-010.ts, with one addition specific to this
 * pass: the numeral swap was performed deterministically BEFORE the analyst saw the
 * text, so the proof checks the analyst's output against `swappedText` (the swapped
 * baseline) and separately re-verifies that the superseded score is gone and the
 * corrected one is present. A rewrite that reintroduced the old number, or that quietly
 * altered a number the analyst was not authorised to touch, fails here.
 *
 *   npx tsx scripts/case-loops/effort/merge-batch-010-scores.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { findScoreCitations } from "@/lib/analysis/score-citations";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";

const OUT = "docs/data-analysis/case-effort";
const MAX_GROWTH = 250;

interface Input {
  pspId: number; name: string; field: string; club: string | null;
  supersededScore: number; correctedScore: number;
  swappedText: string; fullText: string;
  facts: { correctedClubMean: number | null; aboveClubMean: boolean | null; psp9ScoreNow: number | null };
}
interface Rewrite { pspId: number; field: string; newText: string; changed?: boolean; replacements?: { old: string; new: string }[]; reasoning?: string }

/** Sentence split shared with the committee merge. */
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
  const inputs = (JSON.parse(readFileSync(`${OUT}/payloads/batch-010-score-inputs.json`, "utf8")) as { units: Input[] }).units;
  const inputByPsp = new Map(inputs.map((u) => [u.pspId, u]));
  const rewrites = (JSON.parse(readFileSync(`${OUT}/payloads/batch-010-score-rewrites.json`, "utf8")) as { units: Rewrite[] }).units;

  const accepted: { id: string; name: string; props: Record<string, string> }[] = [];
  const drops: string[] = [];
  const report: Record<string, unknown>[] = [];

  for (const r of rewrites) {
    const u = inputByPsp.get(r.pspId);
    if (!u) { drops.push(`psp:person:${r.pspId} — not a batch-010 score unit`); continue; }
    const baseline = u.swappedText;
    const fails: string[] = [];

    // 1. the superseded score must be gone, and the corrected one present
    if (findScoreCitations(r.newText, u.supersededScore).length) fails.push(`superseded score ${u.supersededScore} still cited`);
    if (!findScoreCitations(r.newText, u.correctedScore).length) fails.push(`corrected score ${u.correctedScore} not present`);

    // 2. minimal diff against the SWAPPED baseline — the analyst was allowed to change
    //    only sentences whose claim broke, so every other sentence must survive verbatim.
    const baseSentences = sentences(baseline).map((s) => s.trim());
    const newSentences = sentences(r.newText).map((s) => s.trim());
    // A declared `old` may be a SUB-SENTENCE fragment („Nejmladší z pětice (nar. 1996)"),
    // which is a tighter edit than replacing a whole sentence, not a looser one. So a
    // baseline sentence counts as declared when it EQUALS or CONTAINS a declared string;
    // an earlier version compared whole sentences only and dropped 2 of 7 correct
    // rewrites for being too careful.
    const declared = (r.replacements ?? []).map((x) => x.old.trim());
    const shouldSurvive = baseSentences.filter((s) => !declared.some((d) => s === d || s.includes(d)));
    const missing = shouldSurvive.filter((s) => !newSentences.includes(s));
    if (missing.length) fails.push(`${missing.length} sentence(s) altered without being declared: ${missing.map((s) => `"${s.slice(0, 70)}…"`).join(" | ")}`);

    // 3. declared replacements must actually reproduce newText from the baseline
    let applied = baseline;
    for (const rep of r.replacements ?? []) {
      if (!applied.includes(rep.old)) { fails.push(`declared replacement not found in baseline: "${rep.old.slice(0, 70)}…"`); break; }
      applied = applied.replace(rep.old, rep.new);
    }
    if (applied !== r.newText) fails.push("declared replacements do not reproduce newText");

    // 4. no NEWLY introduced jargon (delta, like the committee merge)
    const before = new Set(jargonViolationDetails(u.fullText).map((j) => j.what));
    const newJargon = jargonViolationDetails(r.newText).filter((j) => !before.has(j.what));
    if (newJargon.length) fails.push(`jargon reintroduced: ${newJargon.map((j) => `${j.what} ("${j.match}")`).join(" · ")}`);

    // 5. bounded growth against the ORIGINAL published text
    const growth = r.newText.length - u.fullText.length;
    if (growth > MAX_GROWTH) fails.push(`length grew by ${growth} chars (cap ${MAX_GROWTH})`);

    report.push({ pspId: r.pspId, name: u.name, changed: r.changed ?? (r.newText !== baseline), growth, reasoning: r.reasoning ?? null, fails });
    if (fails.length) { drops.push(`psp:person:${r.pspId} (${u.name}) — ${fails.join(" · ")}`); continue; }
    accepted.push({ id: `psp:person:${r.pspId}`, name: u.name, props: { [u.field]: r.newText } });
  }

  console.log(`MERGE (scores) · ${rewrites.length} rewrites · ${accepted.length} ACCEPT · ${drops.length} DROP`);
  for (const d of drops) console.log(`  ✗ ${d}`);
  for (const rep of report.filter((x) => !(x.fails as string[]).length)) {
    console.log(`  ✓ ${rep.name} — ${rep.changed ? "claim rewritten" : "numeral swap only"}, ${(rep.growth as number) >= 0 ? "+" : ""}${rep.growth} chars`);
  }

  writeFileSync(`${OUT}/payloads/batch-010-score-props.json`, JSON.stringify({
    case: "effort", batch: 10, track: "effort",
    method: "pass-42 superseded-score reconciliation; deterministic numeral swap + analyst claim adjudication under a minimal-diff proof",
    ref: "pass42-score-prose",
    generatedAt: new Date().toISOString(),
    proposals: accepted,
  }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-score-props.json (${accepted.length} proposals)`);
  process.exit(drops.length ? 2 : 0);
}

main();
