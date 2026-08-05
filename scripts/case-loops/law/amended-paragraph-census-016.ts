/* Case ③ Law loop — batch-016 P4: the amended-§ census.
 *
 * The §-level basis the sector-adjacency rework has needed since batch-004: for every bill,
 * WHICH §§ of WHICH statute does it operatively amend (instruction, not citation)? Everything
 * here reuses collision-core.ts's validated extractors — the same partitioner and the
 * instruction-vs-citation discriminator whose false-drop rate was measured to 0 on the hand
 * set in batch-009 — so no new text heuristics are introduced.
 *
 * Deterministic, read-only over the text cache; the payload also cross-checks the graph's
 * statute-level `amends` topology. DIRECTION OF TRUST (measured by the batch-016 audit, which
 * hand-verified 9/9 disagreements on that batch's bills IN THE GRAPH'S FAVOUR and ≥68 %
 * corpus-wide): the graph's edges were built by the audited census/regen pipeline and are
 * PRESUMED RIGHT; a disagreement is first evidence of THIS extractor's known limits (an
 * article-structured bill collapses to one bucket; annex-only amendments carry no §; the
 * discriminator rejects „se částka … nahrazuje" forms; cross-references can win a partition
 * label). Disagreements are therefore reported as EXTRACTOR DIAGNOSTICS, not graph defects,
 * and the per-§ rows are trustworthy exactly where the diagnostics are clean.
 *
 *   npx tsx scripts/case-loops/law/amended-paragraph-census-016.ts
 * → docs/data-analysis/case-law/payloads/batch-016-amended-paragraph-census.json
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

import { CACHE_DIR, amendsParagraph, operativeSlice, partitionParagraphsByStatute, readCachedBillText } from "./collision-core";

const OUT = "docs/data-analysis/case-law/payloads/batch-016-amended-paragraph-census.json";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const bills = await store.listKgNodes({ kind: "bill" });
  const laws = await store.listKgNodes({ kind: "law" });
  const amends = await store.listKgEdges({ rel: "amends" });
  const lawRefById = new Map(laws.map((l) => [l.id, String((l.props as Record<string, unknown>).ref)]));
  const graphRefsByBill = new Map<string, Set<string>>();
  for (const e of amends) {
    const ref = lawRefById.get(e.dst);
    if (!ref) continue;
    if (!graphRefsByBill.has(e.src)) graphRefsByBill.set(e.src, new Set());
    graphRefsByBill.get(e.src)!.add(ref);
  }

  const rows: {
    cislo: number;
    statutes: { lawRef: string; operativeParagraphs: string[]; citedOnlyParagraphs: string[] }[];
    extractorMissedRefs: string[];
    extractorExtraRefs: string[];
  }[] = [];
  let skipped = 0;
  for (const b of bills) {
    const p = b.props as Record<string, unknown>;
    const cislo = typeof p.cislo === "number" ? p.cislo : null;
    if (cislo === null) continue;
    if (!existsSync(`${CACHE_DIR}/tisk-${cislo}`) || readdirSync(`${CACHE_DIR}/tisk-${cislo}`).filter((f) => f.endsWith(".txt")).length === 0) {
      skipped++;
      continue;
    }
    const text = readCachedBillText(cislo);
    if (!text) {
      skipped++;
      continue;
    }
    const parts = partitionParagraphsByStatute(operativeSlice(text));
    const statutes: { lawRef: string; operativeParagraphs: string[]; citedOnlyParagraphs: string[] }[] = [];
    for (const [lawRef, part] of parts) {
      // the partitioner emits an "unknown" bucket when no statute header resolves — extractor
      // noise by definition (batch-016 audit B9: 3 of 8 "leads" were this literal string)
      if (lawRef === "unknown") continue;
      const operative: string[] = [];
      const citedOnly: string[] = [];
      for (const num of part.paragraphs) (amendsParagraph(part.text, num) ? operative : citedOnly).push(num);
      if (operative.length + citedOnly.length > 0)
        statutes.push({ lawRef, operativeParagraphs: operative.sort(), citedOnlyParagraphs: citedOnly.sort() });
    }
    const textRefs = new Set(statutes.filter((s) => s.operativeParagraphs.length > 0).map((s) => s.lawRef));
    const graphRefs = graphRefsByBill.get(b.id) ?? new Set();
    rows.push({
      cislo,
      statutes: statutes.sort((a, b2) => a.lawRef.localeCompare(b2.lawRef)),
      // extractor diagnostics, NOT graph defects — see the direction-of-trust note above
      extractorMissedRefs: [...graphRefs].filter((r) => !textRefs.has(r)).sort(),
      extractorExtraRefs: [...textRefs].filter((r) => !graphRefs.has(r)).sort(),
    });
  }
  rows.sort((a, b) => a.cislo - b.cislo);
  const totalOperativePairs = rows.reduce((a, r) => a + r.statutes.reduce((x, s) => x + s.operativeParagraphs.length, 0), 0);
  const withMissed = rows.filter((r) => r.extractorMissedRefs.length > 0).length;
  const withExtra = rows.filter((r) => r.extractorExtraRefs.length > 0).length;
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Per bill: collision-core's statute partitioner over the operative slice of the cached print, then the measured instruction-vs-citation discriminator per §. Cross-checked against the graph's statute-level amends topology, whose edges are PRESUMED RIGHT (the batch-016 audit hand-verified 9/9 disagreements in the graph's favour on that batch's bills): a disagreement is an EXTRACTOR DIAGNOSTIC — extractorMissedRefs marks statutes the audited graph carries that this extractor could not see (the LARGEST cause: an article-structured bill without statute headers collapses into a single partition bucket; also annex-only amendments and the substitution form beginning with the word „částka“), extractorExtraRefs marks partition labels the graph does not corroborate (typically cross-reference wins). Per-§ rows are trustworthy exactly where a bill's diagnostics are clean.",
        billsCensused: rows.length,
        billsSkippedNoText: skipped,
        totalOperativeBillParagraphPairs: totalOperativePairs,
        billsWithExtractorMissedRefs: withMissed,
        billsWithExtractorExtraRefs: withExtra,
        rows,
      },
      null,
      1,
    ),
  );
  console.log(`censused ${rows.length} bills (${skipped} skipped, no text) · ${totalOperativePairs} operative bill→§ pairs`);
  console.log(`extractor diagnostics: ${withMissed} bills with missed refs, ${withExtra} with extra refs (graph presumed right)`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
