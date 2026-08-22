/* Case ② Effort — batch 010: inputs for the stale-score reconciliation.
 *
 * The numeral is owned by the data, so this script performs the SWAP deterministically
 * (old score string → corrected score string, asserted by exact match). What it cannot
 * decide is whether the CLAIM built around the number survives the correction: „skóre
 * pokleslo z 70,8 na 67" also moved at its other end (the prior-term score carries its
 * own pass-42 committee correction), and „zůstává nad klubovým průměrem" rests on a club
 * mean that moved when 33 members' scores moved. Those go to an analyst WITH the facts.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/pass42-score-inputs.ts \
 *     --corrected=<c.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { findScoreCitations } from "@/lib/analysis/score-citations";

const OUT = "docs/data-analysis/case-effort";
const TERM = "PSP10";

interface Snap { pspId: number; name: string; score: number | null; prose: Record<string, string> }
const arg = (k: string): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (!hit) throw new Error(`missing --${k}=`);
  return hit.split("=").slice(1).join("=");
};
const cz = (n: number) => String(n).replace(".", ",");
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

async function main() {
  const scan = JSON.parse(readFileSync(`${OUT}/payloads/batch-010-score-scan.json`, "utf8")) as {
    findings: { pspId: number; name: string; field: string; rendered: boolean; supersededScore: number; correctedScore: number }[];
  };
  const rendered = scan.findings.filter((f) => f.rendered);
  const corrected = new Map((JSON.parse(readFileSync(arg("corrected"), "utf8")) as Snap[]).map((s) => [s.pspId, s]));

  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const mandates = (await store.listMandates({ termCode: TERM })) ?? [];
  const clubByMandate = await store.clubByMandate(TERM);
  const clubByPerson = new Map<number, string>();
  for (const m of mandates) {
    const club = clubByMandate.get(m.pspId);
    if (club) clubByPerson.set(m.personPspId, club);
  }

  // CORRECTED club means — the baseline any „nad klubovým průměrem" claim rests on.
  const scoreByPsp = new Map<number, number>();
  const psp9ByPsp = new Map<number, number | null>();
  for (const p of persons) {
    const id = Number(p.id.split(":").pop());
    const s = num(p.props.contribution_score);
    if (s != null) scoreByPsp.set(id, s);
    const p9 = p.props.contribution_psp9 as { score?: unknown } | undefined;
    psp9ByPsp.set(id, p9 ? num(p9.score) : null);
  }
  const clubScores = new Map<string, number[]>();
  for (const [id, s] of scoreByPsp) {
    const c = clubByPerson.get(id);
    if (c) clubScores.set(c, [...(clubScores.get(c) ?? []), s]);
  }
  const clubMean = new Map<string, number>();
  for (const [c, arr] of clubScores) clubMean.set(c, Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10);

  const units = rendered.map((f) => {
    const cur = corrected.get(f.pspId)!;
    const text = cur.prose[f.field];
    const cites = findScoreCitations(text, f.supersededScore);
    // ── the deterministic part: swap the numeral, assert it applied exactly once ──
    const from = cz(f.supersededScore);
    const to = cz(f.correctedScore);
    // Rebuilt from segments at the ORIGINAL indices — a running `replace` would shift
    // every later offset and silently corrupt a second citation.
    let swapped = "";
    let cursor = 0;
    let applied = 0;
    for (const c of cites) {
      if (text.slice(c.index, c.index + c.raw.length) !== c.raw) throw new Error(`citation index drift for ${f.name}`);
      swapped += text.slice(cursor, c.index) + to;
      cursor = c.index + c.raw.length;
      applied++;
    }
    swapped += text.slice(cursor);
    const club = clubByPerson.get(f.pspId) ?? null;
    return {
      pspId: f.pspId,
      name: f.name,
      field: f.field,
      club,
      supersededScore: f.supersededScore,
      correctedScore: f.correctedScore,
      swapFrom: from,
      swapTo: to,
      citationCount: cites.length,
      swapApplied: applied,
      swappedText: swapped,
      /** facts the analyst needs to re-check the CLAIM around the number */
      facts: {
        correctedClubMean: club ? clubMean.get(club) ?? null : null,
        aboveClubMean: club && clubMean.get(club) != null ? f.correctedScore > clubMean.get(club)! : null,
        /** The PRIOR-TERM score as the graph carries it TODAY. It also received the
         *  pass-42 committee correction (the psp9 blob carries its own
         *  `committee_correction` stamp), so a prior-term number quoted in prose is
         *  suspect too and must be checked against this value — the swap above only
         *  touches the CURRENT-term score. */
        psp9ScoreNow: psp9ByPsp.get(f.pspId) ?? null,
      },
      sentenceWindows: cites.map((c) => c.window),
      fullText: text,
    };
  });

  console.log(`rendered stale-score units: ${units.length}`);
  for (const u of units) {
    console.log(`\n  ${u.name} [${u.club}] ${u.swapFrom} → ${u.swapTo} · citations ${u.citationCount}, swaps applied ${u.swapApplied}`);
    console.log(`    corrected club mean ${u.facts.correctedClubMean} → above it: ${u.facts.aboveClubMean}; PSP9 score now ${u.facts.psp9ScoreNow}`);
    if (u.swapApplied !== u.citationCount) console.log(`    ⚠ swap count mismatch — do NOT persist this unit without review`);
  }

  writeFileSync(`${OUT}/payloads/batch-010-score-inputs.json`, JSON.stringify({ generatedAt: new Date().toISOString(), units }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-score-inputs.json`);
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
