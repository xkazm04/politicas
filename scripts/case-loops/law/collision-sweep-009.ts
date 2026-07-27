/* Case ③ Law loop — batch-009: deterministic sweep of the remaining collision backlog.
 *
 * 101 of the 176 partitioned survivor pairs are unread. Hand-reading them all is not available
 * (no subagents this session), and reading a sample has already been done. So this applies the
 * kernel's own ordering — "deterministic code before the army, not after it" — to the class that
 * dominates the backlog's waste: INCIDENTAL pairs, where a § number merely APPEARS in one bill
 * while another genuinely amends it.
 *
 * Every incidental pair the driver hand-read in batch-009 was of exactly this shape:
 *   · tisk 228's "§ 15"/"§ 18" are article numbers of its OWN new act, not amendments to 111/1998
 *   · tisk 124 cites § 30 inside a transitional clause; its real instructions target § 33
 *   · tisk 49 and tisk 67 both merely reference § 9a rather than amending it
 * Czech novelization is a small closed grammar, so "does this bill INSTRUCT against § N, or only
 * point at it?" is decidable in code (collision-core.ts's `amendsParagraph`).
 *
 * VALIDATION IS THE POINT, NOT A FORMALITY. This case has now proposed two ranking signals and
 * honestly falsified both. So this classifier is not trusted on plausibility: it is scored
 * against the 28 pairs from THIS SAME REPORT that already carry hand classifications (12 from
 * batch-008, 16 from batch-009) before any of its output is written anywhere. If it cannot
 * reproduce hand judgements it does not get to classify the other 101.
 *
 *   npx tsx scripts/case-loops/law/collision-sweep-009.ts            # validate only
 *   npx tsx scripts/case-loops/law/collision-sweep-009.ts --write    # + emit the sweep
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { amendsParagraph, operativeSlice, partitionParagraphsByStatute, readCachedBillText, targetedOdstavce } from "./collision-core";

const PAYLOADS = "docs/data-analysis/case-law/payloads";
const WRITE = process.argv.includes("--write");

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
}

const report = JSON.parse(readFileSync(join(PAYLOADS, "collision-report-v2-008.json"), "utf8")) as {
  rankedPairs: RankedPair[];
  groups: Group[];
};

const keyOf = (lawRef: string, a: number, b: number) => {
  const [x, y] = [a, b].sort((m, n) => m - n);
  return `${lawRef}|${x}-${y}`;
};

const sharedByPair = new Map<string, Shared[]>();
const lawTitleByRef = new Map<string, string>();
for (const g of report.groups) {
  if (g.lawTitle) lawTitleByRef.set(g.lawRef, g.lawTitle);
  for (const c of g.collisions) sharedByPair.set(keyOf(g.lawRef, c.billA, c.billB), c.sharedParagraphs);
}

/** A bill's operative text restricted to the statute in question — the tisk-248 partition fix.
 * Falls back to the whole operative text when no block cites that statute (a single-subject
 * bill whose citation sits outside any Čl. block), which is the same convention the census uses. */
const partCache = new Map<number, Map<string, { paragraphs: Set<string>; text: string }>>();
function statuteText(cislo: number, lawRef: string): string | null {
  if (!partCache.has(cislo)) {
    const raw = readCachedBillText(cislo);
    if (raw === null) {
      partCache.set(cislo, new Map());
      return null;
    }
    partCache.set(cislo, partitionParagraphsByStatute(operativeSlice(raw)));
  }
  const part = partCache.get(cislo)!;
  if (part.size === 0) return null;
  const hit = part.get(lawRef);
  if (hit) return hit.text;
  const unknown = part.get("unknown");
  return unknown ? unknown.text : null;
}

type Auto = "incidental" | "escalate" | "undecidable";

interface Assessment {
  key: string;
  lawRef: string;
  billA: number;
  billB: number;
  paragraphs: string[];
  auto: Auto;
  reason: string;
  /** §s where BOTH bills issue a real instruction — the genuine co-touch set. */
  genuineParagraphs: string[];
  /** §s where at least one side only cites — the artifact set. */
  citationOnlyParagraphs: { paragraph: string; citingBill: number }[];
  /** §s where both instruct AND their targeted odstavce intersect — close-read first. */
  odstavecOverlap: string[];
}

function assess(p: RankedPair): Assessment {
  const key = keyOf(p.lawRef, p.billA, p.billB);
  const shared = sharedByPair.get(key) ?? [];
  const tA = statuteText(p.billA, p.lawRef);
  const tB = statuteText(p.billB, p.lawRef);

  const base = { key, lawRef: p.lawRef, billA: p.billA, billB: p.billB, paragraphs: p.paragraphs };
  if (tA === null || tB === null) {
    return { ...base, auto: "undecidable", reason: `no cached text for tisk ${tA === null ? p.billA : p.billB}`, genuineParagraphs: [], citationOnlyParagraphs: [], odstavecOverlap: [] };
  }

  const genuine: string[] = [];
  const citationOnly: { paragraph: string; citingBill: number }[] = [];
  const overlap: string[] = [];

  for (const s of shared) {
    const par = s.paragraph;
    const aAmends = amendsParagraph(tA, par);
    const bAmends = amendsParagraph(tB, par);
    if (aAmends && bAmends) {
      genuine.push(par);
      const oa = targetedOdstavce(tA, par);
      const ob = targetedOdstavce(tB, par);
      // Overlap only counts when BOTH sides name an odstavec and they intersect. When either
      // side edits the § as a whole (no odst. named — a full rewrite, a repeal, an appended
      // odstavec) the interaction is not decidable here and the pair still escalates.
      if (oa.size > 0 && ob.size > 0 && [...oa].some((x) => ob.has(x))) overlap.push(par);
      else if (oa.size === 0 || ob.size === 0) overlap.push(par);
    } else if (!aAmends && !bAmends) {
      citationOnly.push({ paragraph: par, citingBill: 0 }); // neither instructs — pure artifact
    } else {
      citationOnly.push({ paragraph: par, citingBill: aAmends ? p.billB : p.billA });
    }
  }

  if (genuine.length === 0) {
    return {
      ...base,
      auto: "incidental",
      reason:
        citationOnly.every((c) => c.citingBill === 0)
          ? `neither bill issues a novelization instruction against any shared § (${p.paragraphs.join(", ")}) — the § numbers only appear as references`
          : `on every shared § (${p.paragraphs.join(", ")}) at least one bill only CITES the § rather than amending it`,
      genuineParagraphs: [],
      citationOnlyParagraphs: citationOnly,
      odstavecOverlap: [],
    };
  }
  return { ...base, auto: "escalate", reason: `${genuine.length} § with a real instruction on both sides: ${genuine.join(", ")}`, genuineParagraphs: genuine, citationOnlyParagraphs: citationOnly, odstavecOverlap: overlap };
}

// ---------- validation against hand-classified ground truth ----------

interface HandPair {
  billA: number;
  billB: number;
  lawRef: string;
  classification: string;
}
function handClassified(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of ["collision-close-reads-batch008.json", "collision-close-reads-batch009.json"]) {
    const p = join(PAYLOADS, f);
    if (!existsSync(p)) continue;
    const d = JSON.parse(readFileSync(p, "utf8")) as { pairs?: HandPair[] };
    for (const x of d.pairs ?? []) {
      const c = x.classification === "confirmed" ? "confirmed-collision" : x.classification === "coordination_risk" ? "coordination-risk" : x.classification;
      out.set(keyOf(x.lawRef, x.billA, x.billB), c);
    }
  }
  return out;
}

/** Every pair close-read in ANY batch — the sweep reports only genuinely unread ones. `truth`
 * above is deliberately narrower (batches 008/009 only) because those are the pairs classified
 * against THIS report's topology; earlier batches read a different edge set. */
function allPreviouslyRead(): Set<string> {
  const out = new Set<string>();
  for (const f of [
    "collision-close-reads.json",
    "collision-close-reads-batch004.json",
    "collision-close-reads-batch005.json",
    "collision-close-reads-batch008.json",
    "collision-close-reads-batch009.json",
    "collision-close-reads-group1.json",
    "collision-close-reads-group2.json",
    "collision-close-reads-group3.json",
  ]) {
    const p = join(PAYLOADS, f);
    if (!existsSync(p)) continue;
    const d = JSON.parse(readFileSync(p, "utf8")) as { pairs?: HandPair[] };
    for (const x of d.pairs ?? []) out.add(keyOf(x.lawRef, x.billA, x.billB));
  }
  return out;
}

const truth = handClassified();
const alreadyRead = allPreviouslyRead();
const assessments = report.rankedPairs.map(assess);
const byKey = new Map(assessments.map((a) => [a.key, a]));

let tp = 0; // auto-incidental AND hand-incidental
let fp = 0; // auto-incidental BUT hand says genuine  ← the dangerous error
let fn = 0; // auto-escalate BUT hand-incidental      ← merely wasteful
let tn = 0;
const fpDetail: string[] = [];
for (const [key, hand] of truth) {
  const a = byKey.get(key);
  if (!a || a.auto === "undecidable") continue;
  const autoInc = a.auto === "incidental";
  const handInc = hand === "incidental";
  if (autoInc && handInc) tp++;
  else if (autoInc && !handInc) {
    fp++;
    fpDetail.push(`    ${key} — auto=incidental but hand=${hand}: ${a.reason}`);
  } else if (!autoInc && handInc) fn++;
  else tn++;
}

console.log(`Case ③ batch-009 collision sweep · ${assessments.length} partitioned pairs\n`);
console.log(`VALIDATION against ${tp + fp + fn + tn} hand-classified pairs from this same report (batches 008+009):`);
console.log(`  auto-incidental & hand-incidental (correct)   : ${tp}`);
console.log(`  auto-incidental & hand-GENUINE   (FALSE DROP) : ${fp}   ← the error that matters`);
console.log(`  auto-escalate   & hand-incidental (wasteful)  : ${fn}`);
console.log(`  auto-escalate   & hand-genuine    (correct)   : ${tn}`);
if (fpDetail.length) {
  console.log(`\n  FALSE DROPS — a genuine finding this classifier would have discarded:`);
  for (const d of fpDetail) console.log(d);
}
const recall = tp + fn > 0 ? tp / (tp + fn) : NaN;
const precision = tp + fp > 0 ? tp / (tp + fp) : NaN;
console.log(`\n  incidental-class precision ${(precision * 100).toFixed(0)}% · recall ${(recall * 100).toFixed(0)}%`);
console.log(
  `  Gate: ANY false drop means this must not auto-classify — a discarded pair is never read again,\n  so a false drop is a silently lost public finding, while a false escalate only costs reading time.`,
);

const ready = fp === 0;
console.log(`\n  → ${ready ? "PASSES: no genuine pair would be dropped" : "FAILS: does not get to classify the backlog"}`);

const unread = assessments.filter((a) => !alreadyRead.has(a.key));
const autoInc = unread.filter((a) => a.auto === "incidental");
const esc = unread.filter((a) => a.auto === "escalate");
const und = unread.filter((a) => a.auto === "undecidable");

console.log(`\nSWEEP over the ${unread.length} unread pairs:`);
console.log(`  incidental (artifact, closed deterministically) : ${autoInc.length}`);
console.log(`  escalate   (genuine co-touch, needs a read)     : ${esc.length}`);
console.log(`  undecidable (no cached text)                    : ${und.length}`);

if (esc.length) {
  const byLaw = new Map<string, number>();
  for (const e of esc) byLaw.set(e.lawRef, (byLaw.get(e.lawRef) ?? 0) + 1);
  console.log(`\n  escalated by statute:`);
  for (const [law, n] of [...byLaw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${law.padEnd(12)} ${n}`);
  }
}

if (!WRITE) {
  console.log(`\n(validation only — pass --write to emit the sweep)`);
  process.exit(ready ? 0 : 1);
}
if (!ready) {
  console.error(`\nrefusing to write: the classifier dropped a genuine pair in validation`);
  process.exit(1);
}

writeFileSync(
  join(PAYLOADS, "batch-009-collision-sweep.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      method:
        "Deterministic instruction-vs-citation discrimination over each bill's cached operative text, partitioned per target statute (the batch-004 tisk-248 fix, shared via collision-core.ts). A pair is INCIDENTAL when, on every shared §, at least one bill merely references the § rather than issuing a novelization instruction against it. Czech novelization is a small closed grammar, so this is decidable in code rather than by model.",
      validation: {
        against: "the 28 pairs from this same report already hand-classified in batches 008 and 009",
        correctlyIncidental: tp,
        falseDrops: fp,
        wastefulEscalations: fn,
        correctlyEscalated: tn,
        precision: Number(precision.toFixed(3)),
        recall: Number(recall.toFixed(3)),
        gate: "ANY false drop blocks the write — a discarded pair is never read again, so a false drop is a silently lost public finding while a false escalation only costs reading time.",
      },
      counts: { unread: unread.length, incidental: autoInc.length, escalate: esc.length, undecidable: und.length },
      incidental: autoInc.map((a) => ({ lawRef: a.lawRef, billA: a.billA, billB: a.billB, paragraphs: a.paragraphs, reason: a.reason, citationOnly: a.citationOnlyParagraphs })),
      escalate: esc.map((a) => ({
        lawRef: a.lawRef,
        lawTitle: lawTitleByRef.get(a.lawRef) ?? "",
        billA: a.billA,
        billB: a.billB,
        paragraphs: a.paragraphs,
        genuineParagraphs: a.genuineParagraphs,
        citationOnlyParagraphs: a.citationOnlyParagraphs,
        odstavecOverlap: a.odstavecOverlap,
        reason: a.reason,
      })),
      undecidable: und.map((a) => ({ lawRef: a.lawRef, billA: a.billA, billB: a.billB, reason: a.reason })),
    },
    null,
    1,
  ),
);
console.log(`\n→ wrote ${PAYLOADS}/batch-009-collision-sweep.json`);
