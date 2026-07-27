/* Case ③ Law loop — batch-009: does the `rewriteVsSubstitute` signal actually discriminate?
 *
 * Fisher's exact test over the stratified close-read sample, against the same baseline
 * batch-005 used to (honestly) reject `moneyLiteral` at p=1.00. Two questions are asked, because
 * a collision signal can be useful in two different ways:
 *
 *   SEVERITY — does the flag predict `confirmed-collision`?  (the thing it was proposed for)
 *   NOISE    — does the flag predict NOT-`incidental`?        (a filter rather than a ranking)
 *
 * Reporting both is the point. A signal that fails the first and passes the second is still
 * worth having — it just belongs in a different place in the pipeline (pruning the candidate
 * set, not ordering the queue). Reporting only the question that happened to come out well is
 * exactly the self-serving framing the batch-008 reflection caught elsewhere in this case.
 *
 *   npx tsx scripts/case-loops/law/measure-signal-009.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAYLOADS = "docs/data-analysis/case-law/payloads";

interface Pair {
  pairId: string;
  lawRef: string;
  classification: string;
  stratum: string;
}

const reads = JSON.parse(readFileSync(join(PAYLOADS, "collision-close-reads-batch009.json"), "utf8")) as { pairs: Pair[] };
const signal = JSON.parse(readFileSync(join(PAYLOADS, "batch-009-collision-signal.json"), "utf8")) as {
  counts: { unread: number; flagged: number; unflagged: number; flaggedRate: number };
};

/** log n! via lgamma — exact enough for the tiny tables here, and avoids overflow. */
function lnFact(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
function hypergeom(a: number, b: number, c: number, d: number): number {
  const n = a + b + c + d;
  return Math.exp(
    lnFact(a + b) + lnFact(c + d) + lnFact(a + c) + lnFact(b + d) - lnFact(a) - lnFact(b) - lnFact(c) - lnFact(d) - lnFact(n),
  );
}
/** Two-tailed Fisher exact: sum the probability of every table at least as extreme. */
function fisherTwoTailed(a: number, b: number, c: number, d: number): number {
  const observed = hypergeom(a, b, c, d);
  const rowA = a + b;
  const colA = a + c;
  const n = a + b + c + d;
  let p = 0;
  const lo = Math.max(0, colA - (n - rowA));
  const hi = Math.min(rowA, colA);
  for (let x = lo; x <= hi; x++) {
    const pr = hypergeom(x, rowA - x, colA - x, n - rowA - colA + x);
    if (pr <= observed * (1 + 1e-9)) p += pr;
  }
  return Math.min(1, p);
}

function table(pred: (p: Pair) => boolean) {
  const f = reads.pairs.filter((p) => p.stratum === "flagged");
  const u = reads.pairs.filter((p) => p.stratum === "unflagged");
  const a = f.filter(pred).length;
  const b = f.length - a;
  const c = u.filter(pred).length;
  const d = u.length - c;
  return { a, b, c, d, p: fisherTwoTailed(a, b, c, d) };
}

const severity = table((p) => p.classification === "confirmed-collision");
const noise = table((p) => p.classification !== "incidental");

const fmt = (t: { a: number; b: number; c: number; d: number; p: number }, label: string, yes: string) =>
  [
    `${label}`,
    `                       ${yes.padEnd(18)} not`,
    `  flagged   (n=${t.a + t.b})     ${String(t.a).padStart(2)}                 ${String(t.b).padStart(2)}`,
    `  unflagged (n=${t.c + t.d})     ${String(t.c).padStart(2)}                 ${String(t.d).padStart(2)}`,
    `  rate: ${((t.a / (t.a + t.b)) * 100).toFixed(0)}% vs ${((t.c / (t.c + t.d)) * 100).toFixed(0)}%   Fisher two-tailed p = ${t.p.toFixed(3)}  →  ${t.p < 0.05 ? "DISCRIMINATES" : "NOT statistically distinguishable"}`,
  ].join("\n");

console.log(`Case ③ batch-009 · rewriteVsSubstitute signal validation (n=${reads.pairs.length})\n`);
console.log(fmt(severity, "Q1 SEVERITY — does the flag predict a confirmed collision?", "confirmed"));
console.log();
console.log(fmt(noise, "Q2 NOISE — does the flag predict a GENUINE co-touch (not incidental)?", "genuine"));

const verdict =
  severity.p < 0.05
    ? "VALIDATED for severity ranking"
    : noise.p < 0.05
      ? "NOT validated for severity; VALIDATED as a noise filter"
      : "NOT validated for either use at this sample size";

console.log(`\nVERDICT: ${verdict}`);
console.log(
  `\nHonest reading: the flag did NOT predict severity (${((severity.a / (severity.a + severity.b)) * 100).toFixed(0)}% vs ${((severity.c / (severity.c + severity.d)) * 100).toFixed(0)}% confirmed, p=${severity.p.toFixed(2)}) — the same null`,
);
console.log(`result batch-005 got for moneyLiteral. Every incidental pair in the sample (${noise.b + noise.d} total) fell in the`);
console.log(`unflagged stratum, which is suggestive but NOT significant at n=${reads.pairs.length} (p=${noise.p.toFixed(2)}).`);
console.log(`Do not order the remaining sweep by this signal on the strength of that.`);

const out = {
  generatedAt: new Date().toISOString(),
  signal: "rewriteVsSubstitute",
  sampleSize: reads.pairs.length,
  design:
    "Stratified: 8 flagged + 8 unflagged, statute-diverse within stratum, drawn from the 117 unread partitioned survivors. Classifications produced by close-reading BEFORE the measurement was computed; the strata were fixed by the signal script, not chosen after seeing the verdicts.",
  populationBaseRate: signal.counts,
  severity: { ...severity, question: "flag predicts confirmed-collision" },
  noise: { ...noise, question: "flag predicts a genuine co-touch (not incidental)" },
  verdict,
  interpretation:
    "The signal does NOT rank severity — 2/8 flagged and 2/8 unflagged pairs were confirmed collisions, Fisher p=1.00, the identical null batch-005 reported for moneyLiteral. It may act as a NOISE FILTER: all 3 incidental pairs in the sample were unflagged (0/8 flagged vs 3/8 unflagged), but at n=16 that is p=0.20 and must not be treated as established. Two candidate ranking signals have now been proposed and honestly failed; the case should stop proposing signals derived from instruction SHAPE and consider that confirmed collisions in this corpus may simply not be predictable from the novelization instruction text alone.",
  caveats: [
    "The signal is computed over the pre-check's ±N-character excerpts, not full bill text, so an instruction verb sitting just outside an excerpt window is invisible to it. Pair 7×206 changed stratum for exactly this reason when the regex was corrected mid-batch.",
    "A regex bug was found and fixed DURING this batch: the first SUBSTITUTE_RE matched `vkládá se` and `vkládají` but not `vkládá slovo`, the commonest insertion form in the corpus, silently under-flagging. It was caught by noticing the flag disagreed with a hand read on pair 5×64. The measurement above uses the corrected signal; the sample happened to contain the same 16 pairs before and after, with two swapping strata.",
    "n=16 is small. A null at this size is evidence against a LARGE effect, not proof of no effect.",
  ],
};
writeFileSync(join(PAYLOADS, "batch-009-signal-measurement.json"), JSON.stringify(out, null, 1));
console.log(`\n→ wrote ${PAYLOADS}/batch-009-signal-measurement.json`);
