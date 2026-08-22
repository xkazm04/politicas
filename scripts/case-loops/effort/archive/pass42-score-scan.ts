/* Case ② Effort — batch 010, second exposure: prose quoting a SUPERSEDED score.
 *
 * The committee scan caught sentences that named the wrong number of committees. This
 * one catches sentences that quote the composite the correction moved. 33 MPs' scores
 * changed; this measures how many of them are quoted verbatim in published prose, and
 * splits the result by whether the field actually REACHES A READER — the profile page
 * and /zebricek render effort_notes / effort_bill_focus / effort_public_role /
 * effort_work_themes; effort_psp9_trend_note, effort_analyst_note and the rest are
 * internal (guarded out of the render path since batch 007).
 *
 *   npx tsx scripts/case-loops/effort/pass42-score-scan.ts --corrected=<c.json> --pre=<p.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { findScoreCitations } from "@/lib/analysis/score-citations";

const OUT = "docs/data-analysis/case-effort";

/** Fields the product actually renders — measured by grep over features/, batch 010.
 *  A stale number here is a PUBLIC defect; anywhere else it is internal debt. */
const RENDERED_FIELDS = new Set(["effort_notes", "effort_bill_focus", "effort_public_role", "effort_work_themes"]);

interface Snap { pspId: number; name: string; score: number | null; committeeCount: number | null; prose: Record<string, string> }

const arg = (k: string): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (!hit) throw new Error(`missing --${k}=`);
  return hit.split("=").slice(1).join("=");
};

function main() {
  const corrected = JSON.parse(readFileSync(arg("corrected"), "utf8")) as Snap[];
  const pre = new Map((JSON.parse(readFileSync(arg("pre"), "utf8")) as Snap[]).map((s) => [s.pspId, s]));

  const findings: Record<string, unknown>[] = [];
  let movers = 0;
  for (const c of corrected) {
    const p = pre.get(c.pspId);
    if (!p || p.score == null || c.score == null || p.score === c.score) continue;
    movers++;
    for (const [field, text] of Object.entries(c.prose)) {
      for (const cite of findScoreCitations(text, p.score)) {
        findings.push({
          pspId: c.pspId, name: c.name, field,
          rendered: RENDERED_FIELDS.has(field),
          supersededScore: p.score, correctedScore: c.score,
          raw: cite.raw, index: cite.index, window: cite.window,
        });
      }
    }
  }

  const rendered = findings.filter((f) => f.rendered);
  const internal = findings.filter((f) => !f.rendered);
  console.log(`score movers: ${movers}/207`);
  console.log(`stale score citations: ${findings.length} — ${rendered.length} on RENDERED fields, ${internal.length} internal\n`);
  console.log("RENDERED (public defect — fixed this batch):");
  for (const f of rendered) console.log(`  ${String(f.name).padEnd(26)} ${f.field}  ${f.supersededScore} → ${f.correctedScore}  :: …${f.window}…\n`);
  console.log("INTERNAL (not rendered; recorded, not silently dropped):");
  for (const f of internal) console.log(`  ${String(f.name).padEnd(26)} ${f.field}  ${f.supersededScore} → ${f.correctedScore}`);

  writeFileSync(`${OUT}/payloads/batch-010-score-scan.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    renderedFields: [...RENDERED_FIELDS],
    scoreMovers: movers,
    findings,
  }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-score-scan.json`);
}

main();
