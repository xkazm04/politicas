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
    // In every observed occurrence the urn sits in a parenthetical directly AFTER the entity's
    // own name — substituting the label back would echo it („Olga Richterová (Olga Richterová)").
    // So: company urn → bare „IČO N" (the name precedes it); person urn in a parenthetical of
    // its own → drop the parenthetical entirely; person urn inline → the person's name.
    t = t.replace(/company:ico:(\d{8})/g, (_, ico) => `IČO ${ico}`);
    t = t.replace(/\s*\(psp:person:\d+\)/g, "");
    t = t.replace(/psp:person:(\d+)/g, (_, id) => label.get(`psp:person:${id}`) ?? `poslanec s psp id ${id}`);
    t = t.replace(/bill:tisk:(\d+)/g, (_, tid) => {
      const c = cisloOf.get(`bill:tisk:${tid}`);
      return c ? `sněmovní tisk ${c}` : `sněmovní tisk (interní id ${tid})`;
    });
    // „dávka" is AMBIGUOUS (closure audit N5/N6: the same corpus carries „paušální dávkou
    // 15 000 Kč" — a social benefit whose 15 the digit-form rule ATE — and batch ids). Only
    // the zero-padded id „001" and ENUMERATED batch-sense phrases are rewritten; everything
    // else stays. „zpracování" is neuter and fills the same case slot, so agreement survives.
    t = t.replace(/\bdávka 001\b/g, "dřívější zpracování");
    t = t.replace(/\bdávky 001\b/g, "dřívějšího zpracování");
    t = t.replace(/\bdávce 001\b/g, "dřívějším zpracování");
    t = t.replace(/\btéto dávky\b/g, "tohoto zpracování");
    t = t.replace(/\btéto dávce\b/g, "tomto zpracování");
    t = t.replace(/\bkoordinátora dávky\b/g, "koordinátora zpracování");
    t = t.replace(/\bs předchozími dávkami\b/g, "s předchozími zpracováními");
    t = t.replace(/\bdávkového\s+scanu\b/gi, "hromadného prověřování");
    // adjective + noun together, BEFORE the bare-noun rules — otherwise the noun swap runs
    // first and leaves a masc-adj/neut-noun clash („Dávkový prověření", closure audit B8),
    // destroying the very evidence the adjectival detector rule keys on.
    t = t.replace(/\bDávkový scan\b/g, "Hromadné prověření");
    t = t.replace(/\bdávkový scan\b/g, "hromadné prověření");
    t = t.replace(/\bv této i předchozí dávce\b/g, "v tomto i předchozím zpracování");
    t = t.replace(/\bscanu\b/gi, "prověřování");
    t = t.replace(/\bscan\b/gi, "prověření");
    // json: a bare format token becomes plain Czech; a verdict FILENAME keeps its checkable
    // identity in Czech (closure audit N7 — the first fix destroyed the artefact id).
    t = t.replace(/\bverdict-(\d+)\.json\b/gi, "archivovaný posudek k tisku $1");
    t = t.replace(/\b[\w-]+\.json\b/gi, "archivní podklad tohoto projektu");
    t = t.replace(/(?<!\.)\bjson\b/gi, "strojově čitelný výstup");
    // gender agreement where the neuter „zpracování" replaced the feminine „dávka" as a
    // sentence subject (batch-015 B8 class — enumerated from the actual strings).
    t = t.replace(/\bzpracování (zjistil|potvrdil|našel|uvedl|popsal)a\b/g, "zpracování $1o");
    // tisk 40's meta-sentence talks about urn TYPES and raw prop names — one bespoke rewrite
    // (a generic rule would mangle other strings; this is the only occurrence in the corpus).
    t = t.replace(
      "(sponsorContractCzk: 0, sponsors: []), takže v tomto zadání není k dispozici žádné urn typu company:ico: ani psp:person:, vůči kterému by šlo osobní obohacení testovat, a žádné by se vyrábět nemělo",
      "(v datech není evidován žádný předkladatel ani peněžní vazba), takže neexistuje osoba ani firma, vůči které by šlo osobní obohacení testovat, a žádná by se vyrábět neměla",
    );
    t = t.replace("(tiedCompanies: [], flaggedConflict: false, sponsorContractCzk: 0)", "(bez evidovaných vazeb i příznaků střetu v datech)");
    const remaining = lawJargonIssues(t);
    if (remaining.length > 0) throw new Error(`tisk ${r.cislo} ${r.field}: still failing after rewrite — ${remaining[0]}`);
    if (czechCopyOrNull(t) === null) throw new Error(`tisk ${r.cislo} ${r.field}: fails the Czech gate after rewrite`);
    // DIGIT INVARIANT (closure audit N5/N6, the auditor's own recommendation): a jargon sweep
    // must never alter a digit sequence. The ONLY permitted digit deletions are the batch id
    // "001" (rewritten by the enumerated rules) and a dropped "(psp:person:NNNN)" parenthetical
    // whose person is named by the surrounding sentence.
    const digitsOf = (s: string) => (s.match(/\d+/g) ?? []).sort();
    const droppedIds = [...r.text.matchAll(/\(psp:person:(\d+)\)/g)].map((m) => m[1]);
    const addedCisla: string[] = [];
    // a bill urn's internal id is legitimately TRANSFORMED into the public cislo
    for (const m of r.text.matchAll(/bill:tisk:(\d+)/g)) {
      if (!t.includes(`bill:tisk:${m[1]}`)) {
        droppedIds.push(m[1]);
        const c = cisloOf.get(`bill:tisk:${m[1]}`);
        if (c) addedCisla.push(String(c));
      }
    }
    // the two bespoke meta-sentence rewrites deliberately drop prop VALUES ("…Czk: 0")
    for (const bespoke of ["sponsorContractCzk: 0, sponsors: []", "flaggedConflict: false, sponsorContractCzk: 0"]) {
      if (r.text.includes(bespoke) && !t.includes(bespoke)) droppedIds.push(...(bespoke.match(/\d+/g) ?? []));
    }
    const expected = [...digitsOf(r.text).filter((d) => {
      if (d === "001" && !t.includes("001")) return false;
      const i = droppedIds.indexOf(d);
      if (i >= 0) {
        droppedIds.splice(i, 1);
        return false;
      }
      return true;
    }), ...addedCisla].sort();
    const actual = digitsOf(t);
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      throw new Error(`tisk ${r.cislo} ${r.field}: DIGIT INVARIANT violated — expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    // SYNTAX INVARIANT (the closure audit's generalization of the digit invariant — N10/N11
    // were splice wounds a whole-string structural check catches): a sweep must not worsen
    // parenthesis balance nor introduce a sentence break into a lowercase continuation.
    const parenSkew = (s: string) => Math.abs((s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length);
    if (parenSkew(t) > parenSkew(r.text)) throw new Error(`tisk ${r.cislo} ${r.field}: SYNTAX INVARIANT — parenthesis balance worsened`);
    const midStops = (s: string) => (s.match(/\.\s+\p{Ll}/gu) ?? []).length;
    if (midStops(t) > midStops(r.text)) throw new Error(`tisk ${r.cislo} ${r.field}: SYNTAX INVARIANT — introduced a full stop before a lowercase continuation`);
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
