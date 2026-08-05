/* Case ③ Law loop — batch-018 P2: evidence-coordinate scan.
 *
 * The batch-016 evidence doctrine: an unstated effect's `evidence` anchors to the BILL's own
 * structural coordinates (čl./bod/ČÁST/DZ chapter) plus the psp.cz document URL — never to
 * line numbers of a cached transcript, which no reader can resolve (the cache is not the
 * published document, and its line numbering is an artifact of pdftotext). Batches ≤015 wrote
 * evidence before the doctrine; the batch-017 audit confirmed the class survives in published
 * records (verdict-217's „řádky 189–193" style) while the render gate cannot see it (the
 * sentences are ordinary Czech). This scan enumerates every live forensic field carrying a
 * transcript-line or cache-path reference so the migration is a reviewable payload, not an
 * in-place guess.
 *
 *   npx tsx scripts/case-loops/law/evidence-coordinate-scan-018.ts
 * → docs/data-analysis/case-law/payloads/batch-018-evidence-scan.json
 */
import { writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-law/payloads/batch-018-evidence-scan.json";

// „řádek/řádky/řádků/řádcích" — the stem alternates k/c and inserts -e- in the singular;
// a bare „řádk" prefix misses two of the four case forms (found live on tisk 46's singular).
const LINE_REF = /řád(?:ek|k\p{L}*|c\p{L}*)\s*(?:č\.\s*)?\d|(?<!\p{L})lines?\s+\d|\.txt(?!\p{L})|law-collision-cache|\bcache\b/iu;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const bills = await store.listKgNodes({ kind: "bill" });
  const rows: { cislo: number; field: string; text: string; match: string }[] = [];
  for (const b of bills) {
    const p = b.props as Record<string, unknown>;
    if (typeof p.forensic_severity !== "string") continue;
    const cislo = Number(p.cislo);
    const fields: [string, unknown][] = [
      ["forensic_stated_reasoning", p.forensic_stated_reasoning],
      ["forensic_researched_context", p.forensic_researched_context],
      ["forensic_conflict_assessment", p.forensic_conflict_assessment],
    ];
    for (const [i, e] of ((p.forensic_unstated_effects as Record<string, unknown>[]) ?? []).entries()) {
      fields.push(
        [`forensic_unstated_effects[${i}].effect`, e.effect],
        [`forensic_unstated_effects[${i}].whoBenefits`, e.whoBenefits],
        [`forensic_unstated_effects[${i}].evidence`, e.evidence],
      );
    }
    for (const [i, c] of ((p.forensic_citations as Record<string, unknown>[]) ?? []).entries()) {
      fields.push([`forensic_citations[${i}].claim`, c.claim]);
    }
    for (const [field, v] of fields) {
      if (typeof v !== "string") continue;
      const m = LINE_REF.exec(v);
      if (m) rows.push({ cislo, field, text: v, match: m[0] });
    }
  }
  rows.sort((a, b) => a.cislo - b.cislo || a.field.localeCompare(b.field));
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Every reader-facing forensic field on the live store matched against the transcript-line/cache-path shapes the batch-016 evidence doctrine forbids. Each row is a migration target: the rewrite must anchor the same claim to the bill's structural coordinates + the psp.cz URL, verified against the cached text, never invented.",
        count: rows.length,
        bills: [...new Set(rows.map((r) => r.cislo))].length,
        rows,
      },
      null,
      1,
    ),
  );
  console.log(`${rows.length} fields on ${new Set(rows.map((r) => r.cislo)).size} bills carry line/cache evidence refs → ${OUT}`);
  for (const r of rows) console.log(`  tisk ${r.cislo} · ${r.field} · "${r.match}"`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
