/* Case ③ Law loop — batch-014 P1: bill-dependency census, phase 1 (dangling citations).
 *
 * Motivated by two batch-013 findings: tisk 53's own new provisions cite a civil-code § its
 * article never creates, with the amending clause closing on an UNASSIGNED „zákona č. …/2025
 * Sb." — the text was drafted assuming a companion bill already enacted and numbered. That is
 * an enactment-order dependency invisible to the amends topology and to §-overlap collision
 * checks alike. This detector finds the deterministic signature: a Sbírka citation whose
 * NUMBER is a literal ellipsis („…" or „...") — the drafter's placeholder for a companion act
 * not yet promulgated.
 *
 * Scope note (disclosed): phase 1 catches only the placeholder-citation signature. The other
 * dependency shape batch-012/013 found — a platné-znění annex that BAKES IN another pending
 * bill's insertions (tisk 53 ⊂ tisk 16's § 24) — needs cross-bill text containment and is not
 * attempted here. A hit is a LEAD for close reading, never a finding by itself.
 *
 *   npx tsx scripts/case-loops/law/dependency-census-014.ts
 * → docs/data-analysis/case-law/payloads/batch-014-dependency-census.json
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE = ".data/law-collision-cache";
const OUT = "docs/data-analysis/case-law/payloads/batch-014-dependency-census.json";
// „zákona č. …/2025 Sb." — ellipsis (U+2026) or three dots in the number slot; year 202x/20xx.
const DANGLING = /(?:zákon[aueyů]?(?:m)?|č\.)\s*(?:č\.\s*)?(…|\.{3})\s*\/\s*(20\d{2})\s*Sb\./giu;

function main() {
  const rows: { cislo: number; hits: { year: string; context: string }[] }[] = [];
  const dirs = readdirSync(CACHE).filter((d) => /^tisk-\d+$/.test(d));
  for (const d of dirs) {
    const cislo = Number(d.replace("tisk-", ""));
    const dir = join(CACHE, d);
    const hits: { year: string; context: string }[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
      const t = readFileSync(join(dir, f), "utf8").normalize("NFC");
      DANGLING.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DANGLING.exec(t))) {
        const ctx = t
          .slice(Math.max(0, m.index - 160), m.index + 120)
          .replace(/\s+/g, " ")
          .trim();
        // de-dup identical contexts within a bill (annex + body often repeat)
        if (!hits.some((h) => h.context === ctx)) hits.push({ year: m[2], context: ctx });
      }
    }
    if (hits.length > 0) rows.push({ cislo, hits });
  }
  rows.sort((a, b) => b.hits.length - a.hits.length);
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Deterministic scan of all cached bill texts (NFC-normalized) for Sbírka citations whose number slot is a literal ellipsis — the drafter's placeholder for a companion act not yet promulgated. Phase 1 of the dependency census; annex-containment detection (the tisk 53 ⊂ tisk 16 shape) is future work. A hit is a lead for close reading, not a finding.",
        billsScanned: dirs.length,
        billsWithDanglingRefs: rows.length,
        rows,
      },
      null,
      1,
    ),
  );
  console.log(`scanned ${dirs.length} bills · ${rows.length} carry dangling companion-act citations → ${OUT}`);
  for (const r of rows) console.log(`  tisk ${String(r.cislo).padStart(3)} · ${r.hits.length} hit(s) · years ${[...new Set(r.hits.map((h) => h.year))].join(",")}`);
}
main();
