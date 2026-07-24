/* Direction #9 (cont.) — sem_agg benchmark: summarize PSP sessions, testing
 * whether the LLM can AGGREGATE (count from raw votes) or must be handed the
 * deterministic tally to NARRATE. Hard quality metric = count fidelity vs the
 * deterministic aggregate; plus dominant-outcome correctness + efficiency.
 *
 *   npx tsx scripts/hybrid-bench/agg.ts --min-votes=5 --groups=8
 *     --arms=haiku-aggregate,opus-aggregate,haiku-narrate
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { semAgg, type Facts, type Vote } from "./agg-op.js";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const round = (n: number) => Math.round(n * 100) / 100;
const ROWS_FILE = "./.data-analysis/rows/psp-hlasovani__PSP10__vote_event.json";

interface Group { session: string; votes: Vote[]; facts: Facts; }

function loadGroups(minVotes: number): Group[] {
  const raw = JSON.parse(readFileSync(ROWS_FILE, "utf8")) as Array<Record<string, unknown>>;
  const bySession = new Map<string, Array<Record<string, unknown>>>();
  for (const row of raw) {
    const d = (row.data ?? row) as Record<string, unknown>;
    if (d.voided === true || typeof d.title !== "string" || !d.title.trim()) continue;
    const s = String(d.session ?? "?");
    (bySession.get(s) ?? bySession.set(s, []).get(s)!).push(d);
  }
  const groups: Group[] = [];
  for (const [session, ds] of bySession) {
    if (ds.length < minVotes) continue;
    const votes: Vote[] = ds.map((d) => ({ title: String(d.title), outcome: String(d.outcome ?? "?") }));
    const accepted = votes.filter((v) => v.outcome === "accepted").length;
    const rejected = votes.filter((v) => v.outcome === "rejected").length;
    const dates = ds.map((d) => String(d.at ?? "")).filter(Boolean).sort();
    groups.push({
      session, votes,
      facts: {
        n: votes.length, accepted, rejected,
        dateFrom: dates[0]?.slice(0, 10) ?? null,
        dateTo: dates[dates.length - 1]?.slice(0, 10) ?? null,
        topTitles: [...new Set(votes.map((v) => v.title))].filter((t) => t !== "Pořad schůze").slice(0, 5),
      },
    });
  }
  return groups.sort((a, b) => b.votes.length - a.votes.length);
}

const ARM_CFG: Record<string, { mode: "aggregate" | "narrate"; model: string; effort?: string }> = {
  "haiku-aggregate": { mode: "aggregate", model: "haiku" },
  "opus-aggregate": { mode: "aggregate", model: "opus", effort: "high" },
  "haiku-narrate": { mode: "narrate", model: "haiku" },
  "sonnet-narrate": { mode: "narrate", model: "sonnet", effort: "medium" },
  "opus-low-narrate": { mode: "narrate", model: "opus", effort: "low" },
  "opus-narrate": { mode: "narrate", model: "opus", effort: "high" },
};

// Lightweight hallucination check on the prose: a defunct/wrong institution
// (ČNR = Czech National Council, abolished 1993 — this is the Poslanecká
// sněmovna) or any year outside the session's actual date range.
function hallucinated(text: string, facts: Facts): boolean {
  if (/čnr|národní rad/i.test(text)) return true;
  const years = new Set<string>();
  for (const d of [facts.dateFrom, facts.dateTo]) if (d) years.add(d.slice(0, 4));
  for (const y of text.match(/\b(?:19|20)\d{2}\b/g) ?? []) if (!years.has(y)) return true;
  return false;
}

async function main() {
  const minVotes = Number(arg("min-votes", "5")) || 5;
  const maxGroups = Number(arg("groups", "8")) || 8;
  const armIds = arg("arms", "haiku-aggregate,opus-aggregate,haiku-narrate").split(",").map((s) => s.trim());
  const outDir = arg("out", "./.hybrid-bench");

  const groups = loadGroups(minVotes).slice(0, maxGroups);
  console.log(`groups=${groups.length} (sessions ${groups.map((g) => `${g.session}:${g.facts.n}`).join(" ")})  arms=${armIds.join(",")}\n`);

  interface Row { arm: string; mode: string; countExact: number; countMae: number; dominantOk: number; halluc: number; inTok: number; outTok: number; calls: number; }
  const rows: Row[] = [];
  const samples: Record<string, unknown> = {};

  for (const armId of armIds) {
    const cfg = ARM_CFG[armId];
    if (!cfg) { console.error(`unknown arm ${armId}`); continue; }
    let countExact = 0, countErrSum = 0, dominantOk = 0, halluc = 0, inTok = 0, outTok = 0, calls = 0;
    const isAgg = cfg.mode === "aggregate";
    for (const g of groups) {
      process.stdout.write(`${armId} · session ${g.session} (${g.facts.n}) ... `);
      const { result, inputTokens, outputTokens } = await semAgg(g.session, g, cfg.mode, { model: cfg.model, effort: cfg.effort });
      inTok += inputTokens; outTok += outputTokens; calls++;
      const trueDom = g.facts.accepted >= g.facts.rejected ? "accepted" : "rejected";
      if (result.dominantOutcome === trueDom) dominantOk++;
      if (hallucinated(`${result.headline} ${result.summary}`, g.facts)) halluc++;
      if (isAgg) {
        const errs = [Math.abs((result.nVotes ?? -1) - g.facts.n), Math.abs((result.nAccepted ?? -1) - g.facts.accepted), Math.abs((result.nRejected ?? -1) - g.facts.rejected)];
        countErrSum += errs.reduce((a, b) => a + b, 0);
        if (errs.every((e) => e === 0)) countExact++;
        console.log(`stated n/acc/rej=${result.nVotes}/${result.nAccepted}/${result.nRejected} true=${g.facts.n}/${g.facts.accepted}/${g.facts.rejected}`);
      } else {
        countExact++; // given the numbers → exact by construction
        console.log(`(narrate) dom=${result.dominantOutcome}`);
      }
      if (!samples[armId]) samples[armId] = { session: g.session, result };
    }
    rows.push({
      arm: armId, mode: cfg.mode,
      countExact: round((100 * countExact) / groups.length),
      countMae: isAgg ? round(countErrSum / (groups.length * 3)) : 0,
      dominantOk: round((100 * dominantOk) / groups.length),
      halluc: round((100 * halluc) / groups.length),
      inTok, outTok, calls,
    });
  }

  const lines = [
    `# Direction #9 — sem_agg (session summaries)  ·  ${groups.length} sessions`,
    "",
    "Aggregate arms must COUNT from raw votes; narrate arms are handed the deterministic tally.",
    "count-exact = % of sessions where the arm's n/accepted/rejected all match truth; count-MAE = mean abs error per stated number.",
    "",
    "| Arm | mode | count-exact % | count-MAE | dominant % | halluc % | out-tok | calls |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((r) => `| ${r.arm} | ${r.mode} | ${r.mode === "narrate" ? "— (given)" : r.countExact} | ${r.mode === "narrate" ? "—" : r.countMae} | ${r.dominantOk} | ${r.halluc} | ${r.outTok} | ${r.calls} |`),
  ];
  const card = lines.join("\n");

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "semagg.json"), JSON.stringify({ groups: groups.map((g) => ({ session: g.session, facts: g.facts })), rows, samples }, null, 1));
  writeFileSync(join(outDir, "semagg.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/semagg.{md,json}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
