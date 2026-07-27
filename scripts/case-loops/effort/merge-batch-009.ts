/* Batch 009 (Q-effort-16) — merge the two group outputs with a DETERMINISTIC
 * minimal-diff proof: for every corrected field,
 *   (a) the corrected text trips zero jargon rules;
 *   (b) EVERY original sentence that did NOT contain a jargon match appears in
 *       the corrected text verbatim (this is the money-safety proof — a money
 *       or hedge sentence physically cannot have changed);
 *   (c) at most (offending sentences + 1) sentences of the corrected text are
 *       new, and length growth is bounded (no silent essay-writing).
 * A violation drops the unit loudly.
 *
 *   npx tsx scripts/case-loops/effort/merge-batch-009.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";

const DIR = "docs/data-analysis/case-effort/payloads";
const inputs = JSON.parse(readFileSync(`${DIR}/batch-009-inputs.json`, "utf8")) as {
  units: { id: string; name: string; leaking: Record<string, { text: string; matches: { match: string }[] }> }[];
};
const priorById = new Map(inputs.units.map((u) => [u.id, u]));

/** Sentence split at ". " before a capital/„ (never before a digit — spares "č. 90"). */
const splitSentences = (t: string): string[] => t.split(/(?<=\.)\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])/u).map((s) => s.trim()).filter(Boolean);

interface Proposal { id: string; name: string; props: Record<string, unknown> }
const proposals: Proposal[] = [];
const drops: string[] = [];

for (const g of ["A", "B"]) {
  const payload = JSON.parse(readFileSync(`${DIR}/batch-009-group-${g}.json`, "utf8")) as { proposals: Proposal[] };
  for (const p of payload.proposals) {
    const prior = priorById.get(p.id);
    if (!prior) {
      drops.push(`${p.id} (${p.name}) — not a batch-009 unit`);
      continue;
    }
    let ok = true;
    for (const [field, corrected] of Object.entries(p.props)) {
      const leak = prior.leaking[field];
      if (!leak) {
        drops.push(`${p.id} (${p.name}) — ${field} was not a leaking field; refusing the edit`);
        ok = false;
        continue;
      }
      if (typeof corrected !== "string" || corrected.length === 0) {
        drops.push(`${p.id} (${p.name}) — ${field} corrected text missing`);
        ok = false;
        continue;
      }
      const stillBad = jargonViolationDetails(corrected);
      if (stillBad.length > 0) {
        drops.push(`${p.id} (${p.name}) — ${field} still trips: ${stillBad.map((v) => v.match).join(" · ")}`);
        ok = false;
        continue;
      }
      const origSentences = splitSentences(leak.text);
      const offending = origSentences.filter((s) => leak.matches.some((m) => s.includes(m.match)));
      const clean = origSentences.filter((s) => !offending.includes(s));
      const missing = clean.filter((s) => !corrected.includes(s));
      if (missing.length > 0) {
        drops.push(`${p.id} (${p.name}) — ${field} lost ${missing.length} non-offending sentence(s), e.g. ${JSON.stringify(missing[0].slice(0, 90))}`);
        ok = false;
        continue;
      }
      const newSentences = splitSentences(corrected).filter((s) => !leak.text.includes(s));
      if (newSentences.length > offending.length + 1) {
        drops.push(`${p.id} (${p.name}) — ${field} adds ${newSentences.length} new sentences for ${offending.length} offending`);
        ok = false;
        continue;
      }
      if (corrected.length > leak.text.length + 250) {
        drops.push(`${p.id} (${p.name}) — ${field} grew by ${corrected.length - leak.text.length} chars (bound 250)`);
        ok = false;
      }
    }
    if (ok) proposals.push(p);
  }
}

const expected = inputs.units.length;
console.log(`merged: ${proposals.length}/${expected} units · drops: ${drops.length}`);
for (const d of drops) console.log(`  DROP ${d}`);
writeFileSync(
  `${DIR}/batch-009-props.json`,
  JSON.stringify(
    {
      case: "effort",
      batch: 9,
      generatedAt: new Date().toISOString(),
      note: "Q-effort-16 rewrite — sample-scoped self-references de-scoped/restated absolutely; minimal-diff proven in merge (all non-offending sentences verbatim-preserved).",
      proposals,
    },
    null,
    2,
  ),
);
console.log(`written: ${DIR}/batch-009-props.json`);
if (proposals.length !== expected) process.exitCode = 1;
