/* Case ③ Law loop — batch-009: a RANKING SIGNAL WITH A MECHANISM, and the stratified sample
 * that tests it.
 *
 * THE PROBLEM THIS ADDRESSES. The collision backlog has had no validated ordering since
 * batch-004. batch-005 proposed `moneyLiteral` and honestly reported it NOT statistically
 * distinguishable from the partition-survivor baseline (Fisher p=1.00, n=15); batch-008 declined
 * to rank by it and close-read a topic-diverse sample instead. So 117 pairs sit unread with no
 * defensible way to say which matter. P52 has now rolled through four batches.
 *
 * THE HYPOTHESIS. Read this case's OWN confirmed collisions and one mechanism dominates: one bill
 * REPLACES a provision wholesale ("§ N zní:", "odstavce 2 až 6 znějí:") while the other issues a
 * NARROW SUBSTITUTION into the text that replacement destroys ("se slova „X“ nahrazují slovy
 * „Y“", "se částka … nahrazuje"). Whichever enacts first defeats the other's instruction as
 * drafted. That is the stated reasoning of 121-120, 104-232, 28-64, 7-68, 7-90 and 102-111 —
 * six of the confirmed set, across four different statutes.
 *
 * That mechanism is DETERMINISTICALLY DETECTABLE from the excerpts the pre-check already
 * captured: does one side's excerpt carry a rewrite marker while the other side's carries a
 * substitution marker, on the same §? Unlike `moneyLiteral` (a property of the subject matter)
 * this is a property of the COLLISION MECHANISM itself, which is why it is worth testing.
 *
 * WHAT THIS SCRIPT DOES — and does NOT do. It computes the flag and emits a STRATIFIED SAMPLE
 * (flagged and unflagged in comparable numbers) for close-reading. It deliberately does not rank
 * the sweep by the flag, because that would confound the test: if you only read what the signal
 * selects, you can never measure its false-negative rate. The verdict is computed afterwards by
 * `measure-signal-009.ts` from the close-read results.
 *
 *   npx tsx scripts/case-loops/law/collision-signal-009.ts [--sample=16]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PAYLOADS = "docs/data-analysis/case-law/payloads";
const REPORT = join(PAYLOADS, "collision-report-v2-008.json");

const arg = (n: string, fb: string): string => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : fb;
};

/** Wholesale-replacement instructions. Czech drafting uses a small closed set of these:
 * "§ 5 odstavec 2 zní:", "odstavce 2 až 6 znějí:", "§ 17d zní:". The colon is load-bearing —
 * "zní" also appears inside quoted statutory text, but the instruction form ends the clause. */
const REWRITE_RE = /(?<![\p{L}])(zní|znějí)\s*:/u;

/** Narrow substitution / insertion into existing text. These presuppose the current wording
 * survives verbatim, which is exactly what a rewrite destroys.
 *
 * Match the instruction VERB in any inflected form, never verb-plus-expected-next-word. The
 * first draft of this regex listed `vkládá\s+se` and `vkládaj\p{L}*` and therefore missed
 * `vkládá slovo` / `vkládá nový odstavec` — the single commonest insertion form in the corpus
 * ("se za slovo „ukončené“ vkládá slovo „individuální“"). It silently under-flagged, which on a
 * signal being measured is worse than firing too often: it moves pairs into the control stratum
 * and biases the very comparison the sample exists to make. Caught on pair 5×64 by noticing the
 * flag disagreed with a hand read. Same family as P42 and batch-008's NFC bug: in this corpus,
 * always match the Czech stem, never the surrounding phrase. */
const SUBSTITUTE_RE = /(?<![\p{L}])(nahrazuj\p{L}*|vkládá\p{L}*|vkládaj\p{L}*|doplňuj\p{L}*|označuj\p{L}*)/u;

interface Shared {
  paragraph: string;
  excerptA: string;
  excerptB: string;
}
interface Collision {
  billA: number;
  billB: number;
  sharedParagraphs: Shared[];
}
interface Group {
  lawRef: string;
  lawTitle: string;
  collisions: Collision[];
}
interface RankedPair {
  lawRef: string;
  billA: number;
  billB: number;
  paragraphs: string[];
  sharedCount: number;
  moneyLiteral: boolean;
}

const report = JSON.parse(readFileSync(REPORT, "utf8")) as { rankedPairs: RankedPair[]; groups: Group[] };

/** Every (lawRef, billA, billB) already close-read in ANY prior batch — so the sample is drawn
 * only from genuinely unread pairs. Bill order is normalized; pairIds are not comparable across
 * payloads (4-121 exists twice on different statutes), so the statute is part of the key. */
function priorlyRead(): Set<string> {
  const out = new Set<string>();
  const files = [
    "collision-close-reads.json",
    "collision-close-reads-batch004.json",
    "collision-close-reads-batch005.json",
    "collision-close-reads-batch008.json",
    "collision-close-reads-group1.json",
    "collision-close-reads-group2.json",
    "collision-close-reads-group3.json",
  ];
  for (const f of files) {
    const p = join(PAYLOADS, f);
    if (!existsSync(p)) continue;
    const d = JSON.parse(readFileSync(p, "utf8")) as { pairs?: { billA: number; billB: number; lawRef: string }[] };
    for (const x of d.pairs ?? []) {
      const [a, b] = [x.billA, x.billB].sort((m, n) => m - n);
      out.add(`${x.lawRef}|${a}-${b}`);
    }
  }
  return out;
}

const keyOf = (lawRef: string, billA: number, billB: number) => {
  const [a, b] = [billA, billB].sort((m, n) => m - n);
  return `${lawRef}|${a}-${b}`;
};

// Index the per-§ excerpts by pair.
const sharedByPair = new Map<string, Shared[]>();
const lawTitleByRef = new Map<string, string>();
for (const g of report.groups) {
  if (g.lawTitle) lawTitleByRef.set(g.lawRef, g.lawTitle);
  for (const c of g.collisions) sharedByPair.set(keyOf(g.lawRef, c.billA, c.billB), c.sharedParagraphs);
}

interface Scored extends RankedPair {
  key: string;
  rewriteVsSubstitute: boolean;
  mechanismParagraphs: string[];
  alreadyRead: boolean;
}

const read = priorlyRead();
const scored: Scored[] = report.rankedPairs.map((p) => {
  const key = keyOf(p.lawRef, p.billA, p.billB);
  const shared = sharedByPair.get(key) ?? [];
  const hits: string[] = [];
  for (const s of shared) {
    const aRewrite = REWRITE_RE.test(s.excerptA);
    const bRewrite = REWRITE_RE.test(s.excerptB);
    const aSub = SUBSTITUTE_RE.test(s.excerptA);
    const bSub = SUBSTITUTE_RE.test(s.excerptB);
    // The asymmetry IS the mechanism: one side replaces, the other edits inside.
    if ((aRewrite && bSub && !bRewrite) || (bRewrite && aSub && !aRewrite)) hits.push(s.paragraph);
  }
  return { ...p, key, rewriteVsSubstitute: hits.length > 0, mechanismParagraphs: hits, alreadyRead: read.has(key) };
});

const unread = scored.filter((p) => !p.alreadyRead);
const flagged = unread.filter((p) => p.rewriteVsSubstitute);
const unflagged = unread.filter((p) => !p.rewriteVsSubstitute);

console.log(`Case ③ batch-009 collision signal · ${scored.length} partitioned pairs`);
console.log(`  already close-read : ${scored.filter((p) => p.alreadyRead).length}`);
console.log(`  unread             : ${unread.length}`);
console.log(`  ├─ rewrite-vs-substitute flagged : ${flagged.length} (${((flagged.length / unread.length) * 100).toFixed(1)}%)`);
console.log(`  └─ unflagged                     : ${unflagged.length}`);
console.log(`\nBase rate check (the kernel's degenerate-signal test): a signal firing on >50% of`);
console.log(`units cannot rank them. This one fires on ${((flagged.length / unread.length) * 100).toFixed(1)}% — ${flagged.length / unread.length > 0.5 ? "DEGENERATE, do not use" : "usable as a candidate"}.`);

/** Statute-diverse pick: round-robin across lawRefs so one heavily-amended statute cannot
 * dominate the sample and confound the measurement with its own idiosyncrasies. */
function diverseSample(pool: Scored[], n: number): Scored[] {
  const byLaw = new Map<string, Scored[]>();
  for (const p of pool) byLaw.set(p.lawRef, [...(byLaw.get(p.lawRef) ?? []), p]);
  for (const [, arr] of byLaw) arr.sort((a, b) => b.sharedCount - a.sharedCount || a.billA - b.billA);
  const laws = [...byLaw.keys()].sort();
  const out: Scored[] = [];
  let i = 0;
  while (out.length < n && laws.some((l) => (byLaw.get(l)?.length ?? 0) > 0)) {
    const law = laws[i % laws.length];
    const arr = byLaw.get(law);
    if (arr && arr.length > 0) out.push(arr.shift()!);
    i++;
  }
  return out;
}

const half = Math.floor(Number(arg("sample", "16")) / 2);
const sample = [...diverseSample(flagged, half), ...diverseSample(unflagged, half)];

console.log(`\nSTRATIFIED SAMPLE for close-reading (${sample.length}: ${Math.min(half, flagged.length)} flagged + ${Math.min(half, unflagged.length)} unflagged)`);
for (const p of sample) {
  console.log(
    `  ${p.rewriteVsSubstitute ? "FLAG" : "  · "}  ${p.lawRef.padEnd(10)} tisk ${String(p.billA).padStart(3)} × ${String(p.billB).padStart(3)}  §§ ${p.paragraphs.slice(0, 6).join(", ")}${p.mechanismParagraphs.length ? `  [mech: § ${p.mechanismParagraphs.join(", ")}]` : ""}`,
  );
}

const out = {
  generatedAt: new Date().toISOString(),
  signal: "rewriteVsSubstitute",
  hypothesis:
    "One bill replaces a provision wholesale (`zní:` / `znějí:`) while the other issues a narrow substitution or insertion into the text that replacement destroys. This is the stated mechanism of six of this case's confirmed collisions across four statutes (121-120, 104-232, 28-64, 7-68, 7-90, 102-111), unlike moneyLiteral which is a property of the subject matter rather than of the collision.",
  method:
    "Computed from the per-§ excerpts already captured in collision-report-v2-008.json. Flag = on at least one shared §, one side's excerpt carries a rewrite marker and the other's carries a substitution marker while NOT itself carrying a rewrite marker (the asymmetry is the mechanism).",
  testDesign:
    "STRATIFIED, not signal-ranked. Comparable numbers of flagged and unflagged pairs are close-read so the false-negative rate is measurable; ranking the sweep by the signal would confound the test. Statute-diverse round-robin within each stratum so one heavily-amended statute cannot dominate. Verdict computed afterwards by measure-signal-009.ts (Fisher exact), against the same partition-survivor baseline batch-005 used for moneyLiteral.",
  counts: {
    partitionedPairs: scored.length,
    alreadyRead: scored.filter((p) => p.alreadyRead).length,
    unread: unread.length,
    flagged: flagged.length,
    unflagged: unflagged.length,
    flaggedRate: Number((flagged.length / unread.length).toFixed(4)),
  },
  sample: sample.map((p) => ({
    lawRef: p.lawRef,
    lawTitle: lawTitleByRef.get(p.lawRef) ?? "",
    billA: p.billA,
    billB: p.billB,
    paragraphs: p.paragraphs,
    sharedCount: p.sharedCount,
    rewriteVsSubstitute: p.rewriteVsSubstitute,
    mechanismParagraphs: p.mechanismParagraphs,
    moneyLiteral: p.moneyLiteral,
  })),
  allScored: scored.map((p) => ({ key: p.key, rewriteVsSubstitute: p.rewriteVsSubstitute, alreadyRead: p.alreadyRead })),
};
writeFileSync(join(PAYLOADS, "batch-009-collision-signal.json"), JSON.stringify(out, null, 1));
console.log(`\n→ wrote ${PAYLOADS}/batch-009-collision-signal.json`);
