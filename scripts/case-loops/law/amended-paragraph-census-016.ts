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
 * PRESUMED RIGHT; a disagreement is first evidence of THIS extractor's known limits (a bill
 * with NO standalone article headers collapses to one bucket — all 7 collapsed bills carry
 * 0 „Čl." headers; annex-only amendments carry no §; the discriminator rejects „se částka …
 * nahrazuje" forms; cross-references can win a partition label). Disagreements are therefore
 * reported as EXTRACTOR DIAGNOSTICS, not graph defects, and the per-§ rows are trustworthy
 * exactly where the diagnostics are clean.
 *
 *   npx tsx scripts/case-loops/law/amended-paragraph-census-016.ts
 * → docs/data-analysis/case-law/payloads/batch-017-amended-paragraph-census.json
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

import { CACHE_DIR, amendsParagraph, operativeSlice, partitionParagraphsByStatute, readCachedBillText } from "./collision-core";

// batch-017 audit M12: the partitionFallback regeneration MUST NOT ship under the batch-016
// filename — overwriting a committed artifact in place is an undisclosed rewrite of history.
// The batch-016 payload stays as committed; this regeneration is its own artifact.
const OUT = "docs/data-analysis/case-law/payloads/batch-017-amended-paragraph-census.json";

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
    partitionFallback: boolean;
    insertionCorrections: number;
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
    let insertionCorrections = 0;
    for (const [lawRef, part] of parts) {
      // the partitioner emits an "unknown" bucket when no statute header resolves — extractor
      // noise by definition (batch-016 audit B9: 3 of 8 "leads" were this literal string)
      if (lawRef === "unknown") continue;
      let operative: string[] = [];
      let citedOnly: string[] = [];
      for (const num of part.paragraphs) (amendsParagraph(part.text, num) ? operative : citedOnly).push(num);
      // batch-017 closure M11 — DATA correction, not a disclosure: an insertion instruction
      // („Za § 14q se vkládá nový § 14r") amends nothing at its anchor; it CREATES the inserted
      // §. The upstream extractor (deliberately unchanged — its measured rates hold) records
      // the anchor as amended. Here: every § listed after „vkládá" is operative; the anchor is
      // demoted to citedOnly unless the text amends it OUTSIDE insertion sentences.
      // both statutory word orders occur: „Za § N se vkládá nový § M" and „se za § N vkládá nový § M"
      const inserts = [...part.text.matchAll(/(?:Za § ?(\d+[a-z]*) se (?:vkládá|vkládají)|se za § ?(\d+[a-z]*) (?:vkládá|vkládají))\s+(?:nov[ýéá]\p{L}*\s+)?§+ ?(\d+[a-z]*)((?:\s*(?:a|až|,)\s*(?:§+ ?)?\d+[a-z]*)*)/gu)];
      if (inserts.length > 0) {
        const anchors = new Set<string>();
        const inserted = new Set<string>();
        let stripped = part.text;
        for (const m of inserts) {
          anchors.add(m[1] ?? m[2]);
          inserted.add(m[3]);
          for (const tok of m[4]?.match(/\d+[a-z]*/g) ?? []) inserted.add(tok);
          stripped = stripped.replace(m[0], "");
        }
        for (const a of anchors) {
          if (inserted.has(a)) continue;
          if (operative.includes(a) && !amendsParagraph(stripped, a)) {
            operative = operative.filter((p) => p !== a);
            if (!citedOnly.includes(a)) citedOnly.push(a);
            insertionCorrections++;
          }
        }
        for (const i of inserted) {
          if (!operative.includes(i)) {
            operative.push(i);
            citedOnly = citedOnly.filter((p) => p !== i);
            insertionCorrections++;
          }
        }
      }
      if (operative.length + citedOnly.length > 0)
        statutes.push({ lawRef, operativeParagraphs: operative.sort(), citedOnlyParagraphs: citedOnly.sort() });
    }
    const textRefs = new Set(statutes.filter((s) => s.operativeParagraphs.length > 0).map((s) => s.lawRef));
    const graphRefs = graphRefsByBill.get(b.id) ?? new Set();
    rows.push({
      cislo,
      // per-row trustworthiness (batch-016 audit carry-over): true when the partitioner
      // collapsed a multi-statute bill into ≤1 bucket — the dominant missed-refs cause; a
      // consumer must not read this row's § lists as the bill's full footprint.
      partitionFallback: parts.size <= 1 && graphRefs.size > 1,
      insertionCorrections,
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
  const totalInsertionCorrections = rows.reduce((a, r) => a + r.insertionCorrections, 0);
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Regeneration of the batch-016 census (same extractors, one new field) — the batch-016 payload stays as committed; this file supersedes it for batch-017 consumers. Per bill: collision-core's statute partitioner over the operative slice of the cached print, then the measured instruction-vs-citation discriminator per §. Cross-checked against the graph's statute-level amends topology, whose edges are PRESUMED RIGHT (the batch-016 audit hand-verified 9/9 disagreements in the graph's favour on that batch's bills): a disagreement is an EXTRACTOR DIAGNOSTIC — extractorMissedRefs marks statutes the audited graph carries that this extractor could not see (the LARGEST cause: a bill with NO standalone article headers collapses into a single partition bucket — all 7 collapsed bills carry 0 „Čl.“ headers; also annex-only amendments, which contain no § token at all, and the substitution form beginning with the word „částka“), extractorExtraRefs marks partition labels the graph does not corroborate (typically cross-reference wins). partitionFallback (new in this regeneration) is true when the partitioner collapsed a multi-statute bill into ≤1 bucket — such a row's § lists must NOT be read as the bill's footprint, and its single bucket label may even be a footnote-harvested ref. Insertion instructions („Za § N se vkládá nový § M“) are CORRECTED IN THE DATA (batch-017 closure M11): the inserted §§ are operative, and the anchor § N is demoted to citedOnly unless the text amends it outside insertion sentences — insertionCorrections counts the moves per bill. One honest limit remains: citedOnlyParagraphs collects every § token in the partition block regardless of which statute it belongs to (quoted text about another act contributes its §§), so it is a lead list, never a claim that those §§ belong to this statute. Per-§ operative rows are trustworthy exactly where a bill's diagnostics are clean.",
        billsCensused: rows.length,
        billsSkippedNoText: skipped,
        totalOperativeBillParagraphPairs: totalOperativePairs,
        billsWithExtractorMissedRefs: withMissed,
        billsWithExtractorExtraRefs: withExtra,
        totalInsertionCorrections,
        rows,
      },
      null,
      1,
    ),
  );
  console.log(`censused ${rows.length} bills (${skipped} skipped, no text) · ${totalOperativePairs} operative bill→§ pairs`);
  console.log(`extractor diagnostics: ${withMissed} bills with missed refs, ${withExtra} with extra refs (graph presumed right) · ${totalInsertionCorrections} insertion corrections`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
