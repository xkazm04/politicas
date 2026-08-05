/* batch-015 P1: deterministic rewrite of the 16 withheld strings on the original 27 verdicts.
 * Three mechanical classes, each replaced meaning-preservingly:
 *   urn in prose      → the entity's own public identifier (company „s IČO N" + label; person's
 *                       name from the graph; bill's „tisk N")
 *   „dávka 0XX"       → plain Czech („dřívější zpracování tohoto projektu")
 *   "json"            → plain Czech („strojově čitelný výstup")
 * PREPARE by default (writes the patch payload + verifies every rewritten string passes BOTH
 * render gates); --commit merge-writes the patched fields onto the live bill nodes (pass 49).
 *
 *   npx tsx scripts/case-loops/law/sweep-old27-015.ts [--commit] [--pass=49]
 */
import { readFileSync, writeFileSync } from "node:fs";

import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { getStore } from "@/lib/db/store";

const IN = "docs/data-analysis/case-law/payloads/batch-015-old27-jargon.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-015-old27-sweep.json";
const COMMIT = process.argv.includes("--commit");
const PASS = Number(process.argv.find((a) => a.startsWith("--pass="))?.slice(7) ?? 49);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const nodes = await store.listKgNodes();
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const cisloOf = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [n.id, Number((n.props as Record<string, unknown>).cislo)]));

  const { rows } = JSON.parse(readFileSync(IN, "utf8")) as { rows: { cislo: number; field: string; text: string }[] };
  const patched: { cislo: number; field: string; before: string; after: string }[] = [];
  for (const r of rows) {
    let t = r.text;
    t = t.replace(/company:ico:(\d{8})/g, (_, ico) => {
      const l = label.get(`company:ico:${ico}`);
      return l ? `${l} (IČO ${ico})` : `společnost s IČO ${ico}`;
    });
    t = t.replace(/psp:person:(\d+)/g, (_, id) => label.get(`psp:person:${id}`) ?? `poslanec s psp id ${id}`);
    t = t.replace(/bill:tisk:(\d+)/g, (_, tid) => {
      const c = cisloOf.get(`bill:tisk:${tid}`);
      return c ? `sněmovní tisk ${c}` : `sněmovní tisk (interní id ${tid})`;
    });
    t = t.replace(/dávk[ayeou]{1,2}\s*0*(\d{1,3})/gi, "dřívější zpracování tohoto projektu");
    t = t.replace(/\bjson\b/gi, "strojově čitelný výstup");
    const remaining = lawJargonIssues(t);
    if (remaining.length > 0) throw new Error(`tisk ${r.cislo} ${r.field}: still failing after rewrite — ${remaining[0]}`);
    if (czechCopyOrNull(t) === null) throw new Error(`tisk ${r.cislo} ${r.field}: fails the Czech gate after rewrite`);
    patched.push({ cislo: r.cislo, field: r.field, before: r.text, after: t });
  }
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), method: "deterministic pattern rewrite (urn→public identifier via graph labels; dávka/json→plain Czech); every rewritten string re-verified against lawJargonIssues + the Czech gate before emit", count: patched.length, patched }, null, 1));
  console.log(`${patched.length} strings rewritten → ${OUT}`);

  if (COMMIT) {
    const billByCislo = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [Number((n.props as Record<string, unknown>).cislo), n]));
    const byBill = new Map<number, typeof patched>();
    for (const p of patched) byBill.set(p.cislo, [...(byBill.get(p.cislo) ?? []), p]);
    const toWrite = [];
    for (const [cislo, fixes] of byBill) {
      const bill = billByCislo.get(cislo);
      if (!bill) throw new Error(`tisk ${cislo} not found`);
      const props = structuredClone(bill.props) as Record<string, unknown>;
      for (const f of fixes) {
        const m = f.field.match(/^(\w+)(?:\[(\d+)\]\.(\w+))?$/);
        if (!m) throw new Error(`unparseable field ${f.field}`);
        if (m[2] !== undefined) {
          const arr = props[m[1]] as Record<string, unknown>[];
          if (arr[Number(m[2])][m[3]] !== f.before) throw new Error(`tisk ${cislo} ${f.field}: live text differs from extract — re-run extract first`);
          arr[Number(m[2])][m[3]] = f.after;
        } else {
          if (props[m[1]] !== f.before) throw new Error(`tisk ${cislo} ${f.field}: live text differs from extract`);
          props[m[1]] = f.after;
        }
      }
      (props.forensic_provenance as Record<string, unknown>).jargon_sweep = { pass: PASS, ref: "old27-jargon-sweep-015", computedAt: new Date().toISOString() };
      toWrite.push({ ...bill, props });
    }
    const n = await store.upsertKgNodes(toWrite);
    console.log(`COMMITTED: ${n} bill nodes swept (pass ${PASS}).`);
  } else {
    console.log("PREPARE only — add --commit after the batch closure to write.");
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
