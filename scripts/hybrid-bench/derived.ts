/* Direction #9 (cont.) — DERIVED-aggregate probe. sem_agg's simple counts were
 * 100% exact at both tiers, because counting labeled rows is trivial. This probes
 * the boundary: aggregates that need real MULTI-STEP arithmetic over the per-vote
 * yes/no counts — a sum over 154 rows, an argmin over computed margins — where the
 * Tier-2 "don't let the LLM compute" rule should finally bite. Deterministic truth
 * is trivial; the question is whether (and which tier of) the LLM matches it.
 *
 *   npx tsx scripts/hybrid-bench/derived.ts --min-votes=5 --groups=8 --arms=haiku,opus
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runClaude } from "./engine.js";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const round = (n: number) => Math.round(n * 100) / 100;
const ROWS_FILE = "./.data-analysis/rows/psp-hlasovani__PSP10__vote_event.json";
const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

interface Vote { title: string; yes: number; no: number; abstain: number; notVoting: number; present: number; outcome: string; }
interface Truth {
  session: string; n_votes: number;
  total_yes: number; acceptance_rate_pct: number; max_no_count: number; closest_margin: number; closest_vote_title: string;
}

function loadGroups(minVotes: number): { session: string; votes: Vote[]; truth: Truth }[] {
  const raw = JSON.parse(readFileSync(ROWS_FILE, "utf8")) as Array<Record<string, unknown>>;
  const bySession = new Map<string, Vote[]>();
  for (const row of raw) {
    const d = (row.data ?? row) as Record<string, unknown>;
    if (d.voided === true || typeof d.title !== "string" || !d.title.trim()) continue;
    const s = String(d.session ?? "?");
    const v: Vote = { title: String(d.title), yes: n0(d.yes), no: n0(d.no), abstain: n0(d.abstain), notVoting: n0(d.notVoting), present: n0(d.present), outcome: String(d.outcome ?? "?") };
    (bySession.get(s) ?? bySession.set(s, []).get(s)!).push(v);
  }
  const out: { session: string; votes: Vote[]; truth: Truth }[] = [];
  for (const [session, votes] of bySession) {
    if (votes.length < minVotes) continue;
    const accepted = votes.filter((v) => v.outcome === "accepted").length;
    let closest = Infinity, closestTitle = "";
    for (const v of votes) {
      const m = Math.abs(v.yes - v.no);
      if (m < closest) { closest = m; closestTitle = v.title; }
    }
    out.push({
      session, votes,
      truth: {
        session, n_votes: votes.length,
        total_yes: votes.reduce((a, v) => a + v.yes, 0),
        acceptance_rate_pct: Math.round((100 * accepted) / votes.length),
        max_no_count: Math.max(...votes.map((v) => v.no)),
        closest_margin: closest === Infinity ? 0 : closest,
        closest_vote_title: closestTitle,
      },
    });
  }
  return out.sort((a, b) => b.votes.length - a.votes.length);
}

function prompt(session: string, votes: Vote[]): string {
  const list = votes.map((v, i) => `${i + 1}. ${v.title} | yes=${v.yes} no=${v.no} abstain=${v.abstain} notVoting=${v.notVoting} present=${v.present} | ${v.outcome}`).join("\n");
  return `Compute EXACT summary statistics for session ${session} of Czech Parliament roll-call votes (${votes.length} votes below). Do the arithmetic carefully over ALL rows.

Return ONLY this JSON:
{"n_votes":<int>,"total_yes":<int, sum of the yes column over all votes>,"acceptance_rate_pct":<int, round(100*accepted/n_votes) where accepted = outcome==accepted>,"max_no_count":<int, the largest single 'no' value>,"closest_margin":<int, the smallest |yes-no| across votes>,"closest_vote_title":"<title of the vote with that smallest |yes-no|>"}

Votes (title | counts | outcome):
${list}`;
}

const FIELDS = ["n_votes", "total_yes", "acceptance_rate_pct", "max_no_count", "closest_margin"] as const;
type NumField = (typeof FIELDS)[number];

function extractObject(text: string): Record<string, unknown> {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return {};
  try { const v = JSON.parse(text.slice(s, e + 1)); return v && typeof v === "object" ? (v as Record<string, unknown>) : {}; } catch { return {}; }
}

const ARMS: Record<string, { model: string; effort?: string }> = {
  haiku: { model: "haiku" },
  "sonnet-medium": { model: "sonnet", effort: "medium" },
  "opus-low": { model: "opus", effort: "low" },
  opus: { model: "opus", effort: "high" }, // reasoning-gradient reference vs opus-low
};

async function main() {
  const minVotes = Number(arg("min-votes", "5")) || 5;
  const maxGroups = Number(arg("groups", "8")) || 8;
  const repeats = Number(arg("repeats", "1")) || 1; // >1 pins run-to-run variance
  const armIds = arg("arms", "haiku,opus").split(",").map((s) => s.trim());
  const outDir = arg("out", "./.hybrid-bench");
  const groups = loadGroups(minVotes).slice(0, maxGroups);
  console.log(`groups=${groups.length} (${groups.map((g) => `${g.session}:${g.truth.n_votes}`).join(" ")})  arms=${armIds.join(",")}\n`);

  interface ArmRow { arm: string; exactPct: Record<NumField, number>; mae: Record<NumField, number>; titleOk: number; outTok: number; }
  const rows: ArmRow[] = [];
  const detail: Record<string, unknown[]> = {};

  for (const armId of armIds) {
    const cfg = ARMS[armId];
    if (!cfg) { console.error(`unknown arm ${armId}`); continue; }
    const exact: Record<NumField, number> = { n_votes: 0, total_yes: 0, acceptance_rate_pct: 0, max_no_count: 0, closest_margin: 0 };
    const errSum: Record<NumField, number> = { n_votes: 0, total_yes: 0, acceptance_rate_pct: 0, max_no_count: 0, closest_margin: 0 };
    let titleOk = 0, outTok = 0;
    detail[armId] = [];
    for (let rep = 0; rep < repeats; rep++) for (const g of groups) {
      process.stdout.write(`${armId} · session ${g.session} (${g.truth.n_votes}) #${rep + 1} ... `);
      let res;
      try {
        res = await runClaude(prompt(g.session, g.votes), cfg);
      } catch (e) {
        // Survive a per-cell timeout/error instead of aborting the whole batch
        // (a repeats run makes many calls; one slow one must not kill it).
        console.log(`ENGINE ERROR (skipped): ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      outTok += res.outputTokens;
      const o = extractObject(res.text);
      const got: Record<string, number> = {};
      for (const f of FIELDS) {
        const val = typeof o[f] === "number" ? (o[f] as number) : NaN;
        got[f] = val;
        if (val === g.truth[f]) exact[f]++;
        errSum[f] += Number.isFinite(val) ? Math.abs(val - g.truth[f]) : g.truth[f];
      }
      const titleMatch = typeof o.closest_vote_title === "string" && o.closest_vote_title.trim() === g.truth.closest_vote_title.trim();
      if (titleMatch) titleOk++;
      (detail[armId] as unknown[]).push({ session: g.session, got, truth: g.truth, titleMatch });
      console.log(`total_yes ${got.total_yes}/${g.truth.total_yes}  closest ${got.closest_margin}/${g.truth.closest_margin}  ${titleMatch ? "title✓" : "title✗"}`);
    }
    const N = groups.length * repeats;
    rows.push({
      arm: armId,
      exactPct: Object.fromEntries(FIELDS.map((f) => [f, round((100 * exact[f]) / N)])) as Record<NumField, number>,
      mae: Object.fromEntries(FIELDS.map((f) => [f, round(errSum[f] / N)])) as Record<NumField, number>,
      titleOk: round((100 * titleOk) / N),
      outTok,
    });
  }

  const lines = [
    `# Direction #9 — DERIVED-aggregate probe  ·  ${groups.length} sessions`,
    "",
    "Exact-match % vs deterministic truth, per derived field. n_votes/acceptance are easy; total_yes is a sum over all rows; max_no is a column max; closest_margin is an argmin over computed |yes−no|.",
    "",
    "| Arm | n_votes | acceptance% | max_no | total_yes (sum) | closest_margin (argmin) | closest-title | out-tok |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((r) => `| ${r.arm} | ${r.exactPct.n_votes} | ${r.exactPct.acceptance_rate_pct} | ${r.exactPct.max_no_count} | ${r.exactPct.total_yes} | ${r.exactPct.closest_margin} | ${r.titleOk} | ${r.outTok} |`),
    "",
    "MAE (mean abs error) on the hard fields:",
    ...rows.map((r) => `- ${r.arm}: total_yes ±${r.mae.total_yes}, closest_margin ±${r.mae.closest_margin}, max_no ±${r.mae.max_no_count}`),
  ];
  const card = lines.join("\n");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "derived.json"), JSON.stringify({ rows, detail }, null, 1));
  writeFileSync(join(outDir, "derived.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/derived.{md,json}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
