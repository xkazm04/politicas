/* Case ② Effort — batch 010: build the per-unit rewrite inputs for the army.
 *
 * Joins the prose scan (which sentence is stale) with the seat extraction (what the
 * corrected count is made of), so an agent never has to guess a number: it restates
 * from the body list or it de-scopes. Kernel rule — pre-extract every unit's context
 * into ONE inputs file so army agents never open the single-connection store.
 *
 *   npx tsx scripts/case-loops/effort/pass42-rewrite-inputs.ts --corrected=<snapshot.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-effort";

/** Adjudicated FALSE POSITIVE of the committee scan, excluded from the rewrite with its
 *  reason recorded rather than silently dropped (kernel: no silent truncation).
 *  Nerušil — „opustila dva výbory a nepůsobila v žádném" is about ANOTHER person the
 *  dossier discusses (feminine „opustila", her resignation letter), not about Nerušil's
 *  own seat count, so his committee_count of 1 does not contradict it. */
const ADJUDICATED_FALSE_POSITIVES: Record<number, string> = {
  6664: 'Josef Nerušil — the matched „opustila dva výbory a nepůsobila v žádném" is about ANOTHER person the dossier discusses (feminine „opustila", „její rezignační dopis"), not about Nerušil\'s own seat count. His committee_count of 1 does not contradict it. 1 of 15 survivors (6,7 %) — the guard\'s residual false-positive rate, hand-read.',
};

interface Snap { pspId: number; name: string; score: number | null; committeeCount: number | null; prose: Record<string, string> }

const arg = (k: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

/** Split Czech prose into sentences without breaking on „č. 58/2026 Sb." or „tzv. ". */
function sentences(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  const tokens = text.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    buf += tokens[i];
    const t = tokens[i];
    if (/[.!?]["»)]?$/.test(t)) {
      // an abbreviation or a numbered citation is not a sentence end
      const isAbbrev = /(?:^|\s)(?:tzv|č|s|str|resp|např|mj|tj|atd|apod|zák|odst|písm|Sb|mil|mld|tis|ing|Ing|Mgr|JUDr|PhDr|MUDr|Bc)\.$/u.test(t);
      const nextStartsUpper = /^\s*$/.test(tokens[i + 1] ?? "") && /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ(„]/u.test((tokens[i + 2] ?? "").trim());
      if (!isAbbrev && (nextStartsUpper || i >= tokens.length - 2)) { parts.push(buf); buf = ""; }
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

function main() {
  const corrected = new Map(
    (JSON.parse(readFileSync(arg("corrected")!, "utf8")) as Snap[]).map((s) => [s.pspId, s]),
  );
  const scan = JSON.parse(readFileSync(`${OUT}/payloads/batch-010-prose-scan.json`, "utf8")) as {
    findings: { pspId: number; name: string; field: string; claimed: number; corrected: number; preCorrection: number; raw: string; window: string }[];
  };
  const seats = JSON.parse(readFileSync(`${OUT}/payloads/batch-010-seats.json`, "utf8")) as {
    units: { pspId: number; distinctBodyCount: number; countedSeatRows: number; bodies: { organName: string; organType: string; roles: string[]; leads: boolean; filedTwice: boolean }[] }[];
  };
  const seatByPsp = new Map(seats.units.map((u) => [u.pspId, u]));

  const units = scan.findings
    .filter((f) => !(f.pspId in ADJUDICATED_FALSE_POSITIVES))
    .map((f) => {
      const snap = corrected.get(f.pspId)!;
      const text = snap.prose[f.field];
      const s = seatByPsp.get(f.pspId)!;
      const offending = sentences(text).filter((sent) => sent.includes(f.raw));
      return {
        pspId: f.pspId,
        name: f.name,
        field: f.field,
        claimedInProse: f.claimed,
        correctedCommitteeCount: f.corrected,
        preCorrectionCommitteeCount: f.preCorrection,
        recomputedDistinctBodies: s.distinctBodyCount,
        countedSeatRows: s.countedSeatRows,
        matchedSubstring: f.raw,
        bodies: s.bodies.map((b) => ({
          name: b.organName.replace(/&bdquo;|&ldquo;/g, '"'),
          type: b.organType,
          roles: b.roles,
          leads: b.leads,
          filedTwice: b.filedTwice,
        })),
        offendingSentences: offending,
        fullText: text,
      };
    });

  const missing = units.filter((u) => u.offendingSentences.length === 0);
  console.log(`units: ${units.length}; offending sentence located for ${units.length - missing.length}`);
  for (const m of missing) console.log(`  ⚠ could not isolate the sentence for ${m.name} (${m.field}) — matched "${m.matchedSubstring}"`);
  console.log(`false positives excluded: ${Object.keys(ADJUDICATED_FALSE_POSITIVES).length}`);

  writeFileSync(`${OUT}/payloads/batch-010-rewrite-inputs.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    doctrine: "restate absolutely from the body list, or de-scope; never invent a number",
    adjudicatedFalsePositives: ADJUDICATED_FALSE_POSITIVES,
    units,
  }, null, 2));
  console.log(`wrote ${OUT}/payloads/batch-010-rewrite-inputs.json`);
}

main();
