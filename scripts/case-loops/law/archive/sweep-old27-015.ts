/* batch-015 P1: deterministic rewrite of the 16 withheld strings on the original 27 verdicts.
 * Three mechanical classes, each replaced meaning-preservingly:
 *   urn in prose      → the entity's own public identifier (company „s IČO N" + label; person's
 *                       name from the graph; bill's „tisk N")
 *   „dávka 0XX"       → plain Czech („dřívější zpracování tohoto projektu")
 *   "json"            → plain Czech („strojově čitelný výstup")
 * PREPARE by default (writes the patch payload + verifies every rewritten string passes BOTH
 * render gates); --commit merge-writes the patched fields onto the live bill nodes (pass 49).
 *
 *   npx tsx scripts/case-loops/law/sweep-old27-015.ts [--commit] [--pass=N] [--ref=<provenance ref>]
 *     [--in=<jargon extract payload>] [--out=<sweep payload>]
 *   (defaults are the batch-015 paths/ref; later batches MUST pass their own --pass/--ref —
 *    the batch-016 audit caught a pass-50 run that would have stamped the 015 ref.)
 */
import { readFileSync, writeFileSync } from "node:fs";

import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { getStore } from "@/lib/db/store";

const IN = process.argv.find((a) => a.startsWith("--in="))?.slice(5) ?? "docs/data-analysis/case-law/payloads/batch-015-old27-jargon.json";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/data-analysis/case-law/payloads/batch-015-old27-sweep.json";
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
    // batch-016 residuals (the batch-015 closure audit's inventory) — digit-preserving forms
    t = t.replace(/\(churn 6: tisky/g, "(6 souběžných novel téhož zákona: tisky");
    // „již dříve zpracovanému", not „prověřenému" — the batch-016 audit's language note: on a
    // pending_review corpus, „prověřený" connotes the human verification that has NOT happened.
    t = t.replace(/\bjiž gatovanému\b/g, "již dříve zpracovanému");
    t = t.replace(/v grafu případu law/g, "v datovém grafu tohoto projektu");
    t = t.replace(/\(uzel sněmovní tisk (\d+)\)/g, "(záznam sněmovního tisku $1)");
    // batch-016 --all sweep: the widened detector's retroactive catches (pspId/cache/steward)
    t = t.replace(/\s*\(pspId \d+\)/g, "");
    t = t.replace(/\bpspId \d+ (?=\p{Lu})/gu, ""); // inline form: „je pspId 5513 Jeroným Tejc"
    t = t.replace(/\(cache tisk-(\d+)\)/g, "(archivovaný text tisku $1)");
    t = t.replace(/, cache tisk-(\d+)\)/g, ", archivovaný text tisku $1)");
    // no \b next to Czech letters — ASCII \b cannot see them (the batch-007 lesson, third
    // recurrence, this time in this very script's own rules); the phrases are specific enough.
    t = t.replace(/součástí zkoumaného cache/g, "součástí zkoumaného archivu textů");
    t = t.replace(/z primárního textu v cache/g, "z primárního archivovaného textu");
    t = t.replace(/řádků cache/g, "řádků strojového přepisu");
    t = t.replace(/dvě cache verze tisku/g, "dvě archivované verze tisku");
    t = t.replace(/Text novely v cache \(tisk (\d+)\)/g, "Archivovaný text novely (tisk $1)");
    t = t.replace(/stewardské/g, "svěřenecké");
    t = t.replace(/stewardskou/g, "svěřeneckou");
    // batch-017 structural-rule catches: internal field names cross-referenced in prose become
    // the UI's own Czech section names; the pending_review parenthetical drops (the Czech
    // phrase always precedes it). POSITION-NEUTRAL wording (batch-017 audit M8): most of these
    // references sit in conflictAssessment, which BillDetail renders ABOVE the sections they
    // point at — „výše" was false on the shipped surface, so no rewrite may claim a direction.
    t = t.replace(/\s*\(pending_review\)/g, "");
    // bespoke inline-case fixes BEFORE the generic rules (locative government — the generic
    // nominative phrase inside „popsaného v …" shipped ungrammatical Czech in the first cut)
    t = t.replace(/popsaného v unstatedEffects\[1\]/g, "popsaného ve druhém z popsaných nedeklarovaných dopadů");
    t = t.replace(/věcný přesah titulu popsaný výše v unstatedEffects/g, "věcný přesah titulu popsaný v části nedeklarovaných dopadů");
    t = t.replace(/unstatedEffects\[0\]/g, "první z popsaných nedeklarovaných dopadů");
    t = t.replace(/unstatedEffects\[1\]/g, "druhý z popsaných nedeklarovaných dopadů");
    t = t.replace(/unstatedEffects\[2\]/g, "třetí z popsaných nedeklarovaných dopadů");
    t = t.replace(/unstatedEffects/g, "oddíl nedeklarovaných dopadů");
    // this one lives in an unstatedEffects field and points at conflictAssessment, which IS
    // above it in the render order — the direction word is true here and stays.
    t = t.replace(/viz conflictAssessment/g, "viz posouzení střetu zájmů výše");
    t = t.replace(/viz researchedContext/g, "viz oddíl nezávislého kontextu");
    // bare lowercase „amends" joined the gate after the batch-017 audit measured it LIVE in a
    // shipped rewrite — the graph-edge relation name is not Czech prose.
    t = t.replace(/topologie hran amends v grafu/g, "topologie novelizačních hran v grafu");
    t = t.replace(/na hranách [„"]amends[“"] v grafu/gu, "na novelizačních hranách v grafu");
    t = t.replace(/regenerovaná topologie amends hran v grafu/g, "regenerovaná topologie novelizačních hran v grafu");
    t = t.replace(/regenerovaná topologie amends v grafu/g, "regenerovaná topologie novelizačních hran v grafu");
    t = t.replace(/v grafové topologii amends hran tohoto tisku/g, "v grafové topologii novelizačních hran tohoto tisku");
    t = t.replace(/pole amendedLaws u tohoto tisku/g, "grafový přehled novelizovaných zákonů u tohoto tisku");
    t = t.replace(/v poli amendedLaws tohoto tisku/g, "v grafovém přehledu novelizovaných zákonů tohoto tisku");
    t = t.replace(/na pole amendedLaws/g, "na grafový přehled novelizovaných zákonů");
    t = t.replace(/pole `tie_class`/g, "údaj o třídě vazby");
    t = t.replace(/\(sponsors: \[\], flaggedConflict: false, sponsorContractCzk: 0\)/g, "(bez evidovaných předkladatelských vazeb i příznaků střetu v datech)");
    t = t.replace(/\("cast_captions": "/g, "(„");
    const remaining = lawJargonIssues(t);
    if (remaining.length > 0) throw new Error(`tisk ${r.cislo} ${r.field}: still failing after rewrite — ${remaining[0]}`);
    if (czechCopyOrNull(t) === null) throw new Error(`tisk ${r.cislo} ${r.field}: fails the Czech gate after rewrite`);
    // DIGIT INVARIANT (closure audit N5/N6, the auditor's own recommendation): a jargon sweep
    // must never alter a digit sequence. The ONLY permitted digit deletions are the batch id
    // "001" (rewritten by the enumerated rules) and a dropped "(psp:person:NNNN)" parenthetical
    // whose person is named by the surrounding sentence.
    const digitsOf = (s: string) => (s.match(/\d+/g) ?? []).sort();
    const droppedIds = [...r.text.matchAll(/\(psp:person:(\d+)\)/g)].map((m) => m[1]);
    // pspId drops (parenthetical after a name, or inline before the name) — same class
    droppedIds.push(...[...r.text.matchAll(/\(pspId (\d+)\)/g)].map((m) => m[1]));
    droppedIds.push(...[...r.text.matchAll(/\bpspId (\d+) (?=\p{Lu})/gu)].map((m) => m[1]));
    const addedCisla: string[] = [];
    // a bill urn's internal id is legitimately TRANSFORMED into the public cislo
    for (const m of r.text.matchAll(/bill:tisk:(\d+)/g)) {
      if (!t.includes(`bill:tisk:${m[1]}`)) {
        droppedIds.push(m[1]);
        const c = cisloOf.get(`bill:tisk:${m[1]}`);
        if (c) addedCisla.push(String(c));
      }
    }
    // effect-index drops (unstatedEffects[N] → Czech ordinal phrases) are allowlisted digits
    droppedIds.push(...[...r.text.matchAll(/unstatedEffects\[(\d)\]/g)].map((m) => m[1]));
    // the bespoke meta-sentence rewrites deliberately drop prop VALUES ("…Czk: 0")
    for (const bespoke of ["sponsorContractCzk: 0, sponsors: []", "flaggedConflict: false, sponsorContractCzk: 0", "sponsors: [], flaggedConflict: false, sponsorContractCzk: 0"]) {
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
      (props.forensic_provenance as Record<string, unknown>).jargon_sweep = {
        pass: PASS,
        ref: process.argv.find((a) => a.startsWith("--ref="))?.slice(6) ?? "old27-jargon-sweep-015",
        computedAt: new Date().toISOString(),
      };
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
