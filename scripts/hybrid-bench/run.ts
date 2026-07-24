/* Direction #9 — semantic-operator cascade benchmark (the hybrid-framework test).
 *
 * sem_filter the PSP vote titles for a predicate, four ways, and compare quality
 * (agreement with a gold reference) vs efficiency (tokens, opus calls):
 *   • deterministic  — keyword regex over the title (free, the Execution-Plane floor)
 *   • haiku-all      — cheap model labels every batch
 *   • opus-all       — strong model labels every batch  ← the GOLD reference
 *   • cascade        — haiku labels all; the low-confidence tail escalates to opus
 *
 * The question: does the cascade match opus-all's decisions at a fraction of the
 * opus token cost, and how far is the free keyword floor from the gold?
 *
 *   npx tsx scripts/hybrid-bench/run.ts --limit=160 --pred=fiscal-budget --tau=0.75
 *     --gold-model=opus --gold-effort=high --proxy-model=haiku --batch=40
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { semFilter, type Item, type Label } from "./semop.js";
import { predicateById, PREDICATES } from "./predicates.js";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const round = (n: number) => Math.round(n * 1000) / 1000;

const ROWS_FILE = "./.data-analysis/rows/psp-hlasovani__PSP10__vote_event.json";

function loadItems(limit: number): Item[] {
  const raw = JSON.parse(readFileSync(ROWS_FILE, "utf8")) as Array<Record<string, unknown>>;
  const items: Item[] = [];
  for (const row of raw) {
    const d = (row.data ?? row) as Record<string, unknown>;
    if (d.voided === true) continue;
    const title = typeof d.title === "string" ? d.title.trim() : "";
    const id = typeof d.id === "string" ? d.id : null;
    if (!id || !title) continue;
    items.push({ id, title });
    if (items.length >= limit) break;
  }
  return items;
}

type BoolMap = Map<string, boolean>;

function labelsToBool(labels: Map<string, Label>): BoolMap {
  return new Map([...labels].map(([id, l]) => [id, l.match]));
}

function score(pred: BoolMap, gold: BoolMap) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const [id, g] of gold) {
    const p = pred.get(id) ?? false;
    if (p && g) tp++;
    else if (p && !g) fp++;
    else if (!p && g) fn++;
    else tn++;
  }
  const n = tp + fp + tn + fn || 1;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  return {
    acc: round((tp + tn) / n),
    precision: round(prec),
    recall: round(rec),
    f1: round(prec + rec ? (2 * prec * rec) / (prec + rec) : 0),
    tp, fp, fn, tn,
  };
}

async function main() {
  const limit = Number(arg("limit", "160")) || 160;
  const predId = arg("pred", "fiscal-budget");
  const tau = Number(arg("tau", "0.75"));
  const goldModel = arg("gold-model", "opus");
  const goldEffort = arg("gold-effort", "high");
  const proxyModel = arg("proxy-model", "haiku");
  const proxyEffort = arg("proxy-effort", "");
  const batchSize = Number(arg("batch", "40")) || 40;
  const outDir = arg("out", "./.hybrid-bench");

  const pred = predicateById(predId);
  if (!pred) {
    console.error(`unknown predicate '${predId}'. known: ${PREDICATES.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }
  const items = loadItems(limit);
  console.log(`predicate=${pred.id}  items=${items.length}  proxy=${proxyModel}  gold=${goldModel}/${goldEffort}  tau=${tau}\n`);

  // --- Deterministic (free) ---
  const deter: BoolMap = new Map(items.map((it) => [it.id, pred.keywords.test(it.title)]));

  // --- Gold reference: opus on every batch ---
  process.stdout.write(`gold  (${goldModel}/${goldEffort}) ... `);
  const gold = await semFilter(items, pred.question, { model: goldModel, effort: goldEffort || undefined, batchSize });
  const goldBool = labelsToBool(gold.labels);
  const goldPos = [...goldBool.values()].filter(Boolean).length;
  console.log(`ok  positives=${goldPos}/${items.length}  tok=${gold.outputTokens}  calls=${gold.calls}`);

  // --- Cheap proxy: haiku on every batch ---
  process.stdout.write(`proxy (${proxyModel}) ... `);
  const proxy = await semFilter(items, pred.question, { model: proxyModel, effort: proxyEffort || undefined, batchSize });
  console.log(`ok  tok=${proxy.outputTokens}  calls=${proxy.calls}`);

  // --- Cascade: escalate the low-confidence tail to opus ---
  const escalated = items.filter((it) => (proxy.labels.get(it.id)?.confidence ?? 0) < tau);
  process.stdout.write(`cascade escalate ${escalated.length}/${items.length} (<${tau}) to ${goldModel} ... `);
  const esc = escalated.length
    ? await semFilter(escalated, pred.question, { model: goldModel, effort: goldEffort || undefined, batchSize })
    : { labels: new Map<string, Label>(), outputTokens: 0, calls: 0 };
  console.log(`ok  tok=${esc.outputTokens}  calls=${esc.calls}`);
  const cascadeBool: BoolMap = new Map(
    items.map((it) => [it.id, (esc.labels.get(it.id) ?? proxy.labels.get(it.id))?.match ?? false]),
  );

  // --- Score each arm vs gold ---
  const arms = [
    { id: "deterministic", labels: deter, tokens: 0, calls: 0, opusCalls: 0 },
    { id: `proxy (${proxyModel})`, labels: labelsToBool(proxy.labels), tokens: proxy.outputTokens, calls: proxy.calls, opusCalls: 0 },
    { id: "cascade", labels: cascadeBool, tokens: proxy.outputTokens + esc.outputTokens, calls: proxy.calls + esc.calls, opusCalls: esc.calls },
    { id: `gold (${goldModel}/${goldEffort})`, labels: goldBool, tokens: gold.outputTokens, calls: gold.calls, opusCalls: gold.calls },
  ];

  const rows = arms.map((a) => ({ ...a, ...score(a.labels, goldBool) }));

  const lines = [
    `# Direction #9 — sem_filter cascade  ·  predicate=${pred.id}  ·  n=${items.length}`,
    "",
    `Scored vs GOLD = ${goldModel}/${goldEffort} on all (base rate ${goldPos}/${items.length}). Cascade escalated ${escalated.length}/${items.length} (<${tau}).`,
    "",
    "| Arm | acc vs gold | precision | recall | F1 | out-tokens | LLM calls | opus calls |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      (r) => `| ${r.id} | ${r.acc} | ${r.precision} | ${r.recall} | ${r.f1} | ${r.tokens} | ${r.calls} | ${r.opusCalls} |`,
    ),
    "",
    `Cascade vs gold-on-all: **${round((1 - (proxy.outputTokens + esc.outputTokens) / (gold.outputTokens || 1)) * 100)}% fewer output tokens**, opus calls ${esc.calls} vs ${gold.calls}.`,
  ];
  const card = lines.join("\n");

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `semop-${pred.id}.json`),
    JSON.stringify({ predicate: pred.id, n: items.length, tau, goldModel, goldEffort, proxyModel, rows, items }, null, 1),
  );
  writeFileSync(join(outDir, `semop-${pred.id}.md`), card);
  console.log(`\n${card}\nwrote ${outDir}/semop-${pred.id}.{md,json}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
