/* Case ③ Law loop — batch-008, F2: title-derived per-citation syntactic-role gate.
 *
 * batch-007-round2-audit.md's F2 finding: of 106 `title_fallback` edges in the batch-007 payload,
 * 99 are corroborated by the bill's own census `realLaws`; of the remaining 7, 2 are genuine
 * census-recall rescues (tisk 107 -> 159/1999, tisk 243 -> 223/2016) and 5 are false — the ref
 * appears in the bill's own TITLE preamble not as an independent amend target but (a) as a
 * lineage citation ("ve znění zákona č. X Sb." — X is a PRIOR amending law of the real target, not
 * itself amended by THIS bill) or (b) nested inside another cited law's own official name
 * ("zákon č. Y Sb., kterým se mění zákon č. X Sb." / "... a o změně a doplnění zákona č. X Sb." —
 * X is part of describing what Y IS, not a second thing this bill changes).
 *
 * This script tests the two-pattern gate against ALL bills' title preambles (not just the 5+2
 * known cases) to verify it removes exactly the 5 known-false refs and none of the corroborated
 * or genuinely-rescued ones, before amends-regen-008.ts wires it in.
 *
 *   npx tsx scripts/case-loops/law/f2-title-gate-test.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getStore } from "@/lib/db/store";

const CACHE_DIR = ".data/law-collision-cache";

// Immediately-preceding-context gate (looks at the ~90 chars before the citation's "č." start).
// Whitespace-tolerant (pdftotext -layout wraps lines with \r\n and stray spaces).
// Note: the citation regex match itself STARTS at "č." — so the preceding-context slice ends
// right before "č.", not including it. Patterns therefore end at "zákon(a)", not "zákon(a) č.".
const LINEAGE_RE = /ve\s+zn[ěe]n[íi]\s+z[áa]kona\s*$/iu;
const NESTED_AMEND_RE = /kter(?:[ýy]m|ou|[ýy]mi)\s+se\s+m[ěe]n[íi]\s+z[áa]kon\s*$/iu;
const NESTED_NAME_RE = /(?:a\s+)?o\s+zm[ěe]n[ěe]\s+a\s+dopln[ěe]n[íi]\s+z[áa]kona\s*$/iu;

// isFirstCitation: the bill's OWN primary amend target always sits in the very first
// "kterým se mění zákon č. X" of the title preamble (the fixed enactment formula "ZÁKON ze dne
// ..., kterým se mění zákon č. X ..." names the real target first) — so NESTED_AMEND_RE must only
// suppress a SECOND-OR-LATER "kterým se mění zákon č." (nested inside an earlier-cited law's own
// name, e.g. tisk 36/42: "zákon č. 268/2025 Sb., kterým se mění zákon č. 89/2012 Sb." — 268/2025
// is the real target, cited first; 89/2012 is 268/2025's own descriptive name, cited second).
// LINEAGE_RE and NESTED_NAME_RE are inherently never the bill's own first/only citation (both
// describe an EARLIER-cited law), so they don't need the same guard.
function isSuppressedByRole(preamble: string, matchIndex: number, isFirstCitation: boolean): { suppressed: boolean; reason?: string } {
  const context = preamble.slice(Math.max(0, matchIndex - 90), matchIndex).replace(/\s+/g, " ");
  if (LINEAGE_RE.test(context)) return { suppressed: true, reason: "lineage (ve znění zákona č.)" };
  if (!isFirstCitation && NESTED_AMEND_RE.test(context)) return { suppressed: true, reason: "nested-amend (kterým se mění zákon č.)" };
  if (NESTED_NAME_RE.test(context)) return { suppressed: true, reason: "nested-name (o změně a doplnění zákona č.)" };
  return { suppressed: false };
}

function loadPreamble(cislo: number): string | null {
  const dir = path.join(CACHE_DIR, `tisk-${cislo}`);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (files.length === 0) return null;
  // NFC-normalize: pdftotext sometimes emits a decomposed "č" (bare "c" + U+030C combining
  // caron) instead of the precomposed U+010D, inconsistently within the SAME document — a
  // regex literal "č" only matches the precomposed form, so an unnormalized compare silently
  // misses citations (found live: tisk 36's FIRST "zákon č. 268/2025" citation used the
  // decomposed form, its second "zákon č. 89/2012" used precomposed — breaking first-citation
  // order detection). Normalize once at load time so every downstream regex sees one form.
  const text = readFileSync(path.join(dir, files[0]), "utf8").normalize("NFC");
  // preamble = up to "Parlament se usnesl" (the fixed enactment formula) or first 2500 chars,
  // whichever comes first — this comfortably covers the full title even when it wraps several
  // lines (tisk 36/42 titles run ~300-400 chars).
  const idx = text.search(/Parlament\s+se\s+usnesl/iu);
  return idx > 0 ? text.slice(0, idx) : text.slice(0, 2500);
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a copy");
  const nodes = await store.listKgNodes();
  const bills = nodes.filter((n) => n.kind === "bill");

  console.log(`Testing title-role gate against ${bills.length} bills' amended_laws props…\n`);
  let totalTitleRefs = 0;
  let suppressedCount = 0;
  const suppressedRows: { cislo: number; ref: string; reason: string }[] = [];
  const keptRows: { cislo: number; ref: string }[] = [];

  for (const bill of bills) {
    const p = bill.props as Record<string, unknown>;
    const cislo = Number(p.cislo);
    const titleLaws = Array.isArray(p.amended_laws) ? (p.amended_laws as string[]) : [];
    if (titleLaws.length === 0) continue;
    const preamble = loadPreamble(cislo);
    if (!preamble) continue;

    // Global citation order in this bill's preamble — needed so NESTED_AMEND_RE only fires on a
    // SECOND-OR-LATER "kterým se mění zákon č." (see isSuppressedByRole comment).
    const anyCitationRe = /č\.\s*(\d{1,4})\s*\/\s*(\d{4})\s*Sb\./g;
    let firstCitationIdx: number | null = null;
    let cm: RegExpExecArray | null;
    while ((cm = anyCitationRe.exec(preamble))) {
      if (firstCitationIdx === null) firstCitationIdx = cm.index;
    }

    for (const ref of titleLaws) {
      const [n, y] = ref.split("/");
      const re = new RegExp(`č\\.\\s*${n}\\s*/\\s*${y}\\s*Sb\\.`, "g");
      let m: RegExpExecArray | null;
      let anySuppressed = false;
      let anyReason = "";
      let found = false;
      while ((m = re.exec(preamble))) {
        found = true;
        const isFirst = firstCitationIdx !== null && m.index === firstCitationIdx;
        const check = isSuppressedByRole(preamble, m.index, isFirst);
        if (!check.suppressed) {
          anySuppressed = false;
          anyReason = "";
          break; // one un-suppressed occurrence is enough to keep the ref
        }
        anySuppressed = true;
        anyReason = check.reason!;
      }
      if (!found) continue; // ref not in preamble at all (title prop came from elsewhere) — leave untouched, out of scope
      totalTitleRefs++;
      if (anySuppressed) {
        suppressedCount++;
        suppressedRows.push({ cislo, ref, reason: anyReason });
      } else {
        keptRows.push({ cislo, ref });
      }
    }
  }

  console.log(`Title refs found in preamble text: ${totalTitleRefs}`);
  console.log(`Suppressed by role gate: ${suppressedCount}`);
  for (const r of suppressedRows) console.log(`  tisk ${r.cislo} -> ${r.ref}  [${r.reason}]`);
  console.log(`\nKept (${keptRows.length}) — first 20:`);
  for (const r of keptRows.slice(0, 20)) console.log(`  tisk ${r.cislo} -> ${r.ref}`);
  console.log(`\nSanity: tisk 107 kept? ${keptRows.some((r) => r.cislo === 107)} | tisk 243 kept? ${keptRows.some((r) => r.cislo === 243)}`);

  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
