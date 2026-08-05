/* Case ③ Law loop — batch-018 P2: guarded apply of the evidence-coordinate migration.
 *
 * Applies `batch-018-evidence-sweep.json` (authored against the scan, one row per flagged
 * field) onto the live bill nodes under the whole-artifact guards this loop learned to
 * require (batch-015: pattern rewrites corrupt what they cannot see; batch-017: disclosure
 * is not correction):
 *   1. the live field must equal the payload's `before` byte-for-byte (stale extract → refuse);
 *   2. `after` must pass BOTH render gates (lawJargonIssues, Czech gate);
 *   3. `after` must carry NO transcript-line/cache reference (the class being migrated);
 *   4. DIGIT GUARD: a digit sequence may be REMOVED only if it occurs inside a
 *      line/cache-reference substring of `before`; new digits (coordinates, the psp.cz URL)
 *      are allowed — the migration adds anchors, it must never lose a figure;
 *   5. every guillemet quotation of `before` must survive character-identical.
 * Rows with after === before are recorded as skipped, never written.
 *
 *   npx tsx scripts/case-loops/law/evidence-coordinate-apply-018.ts [--commit] [--pass=N] [--ref=<ref>]
 */
import { readFileSync } from "node:fs";

import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { getStore } from "@/lib/db/store";

import { readCachedBillText } from "./collision-core";

const IN = "docs/data-analysis/case-law/payloads/batch-018-evidence-sweep.json";
const COMMIT = process.argv.includes("--commit");
const PASS = Number(process.argv.find((a) => a.startsWith("--pass="))?.slice(7) ?? 52);
const REF = process.argv.find((a) => a.startsWith("--ref="))?.slice(6) ?? "evidence-coordinates-018";

// „řádek/řádky/řádků/řádcích" — the stem alternates k/c and inserts -e- in the singular,
// so a bare „řádk" prefix misses two of the four case forms (caught live on tisk 46).
const LINE_REF = /řád(?:ek|k\p{L}*|c\p{L}*)\s*(?:č\.\s*)?\d|(?<!\p{L})lines?\s+\d|\.txt(?!\p{L})|law-collision-cache|\bcache\b/iu;
// a line reference is often a LIST of ranges („řádky 38–43, 201–202 a 474–476") — the
// capture must run through commas and „a", or the guard flags the reference's own digits.
const LINE_REF_ALL =
  /řád(?:ek|k\p{L}*|c\p{L}*)\s*(?:č\.\s*|cca\s*|přibližně\s*)?\d+(?:\s*[–-]\s*\d+)?(?:(?:,|\s+a)\s*(?:cca\s*)?\d+(?:\s*[–-]\s*\d+)?)*|lines?\s+\d+(?:\s*[–-]\s*\d+)?|[\w./\\-]*law-collision-cache[\w./\\-]*|[\w./\\-]+\.txt|[\w-]+\.pdf/giu;

function main0() {
  return getStore().then(async (store) => {
    if (!store) throw new Error("no store");
    const nodes = await store.listKgNodes({ kind: "bill" });
    const billByCislo = new Map(nodes.map((n) => [Number((n.props as Record<string, unknown>).cislo), n]));
    const { patched } = JSON.parse(readFileSync(IN, "utf8")) as {
      patched: { cislo: number; field: string; before: string; after: string; note?: string }[];
    };
    let writes = 0;
    let skipped = 0;
    const byBill = new Map<number, { field: string; before: string; after: string }[]>();
    for (const p of patched) {
      if (p.after === p.before) {
        skipped++;
        console.log(`  skip tisk ${p.cislo} ${p.field}${p.note ? ` — ${p.note}` : ""}`);
        continue;
      }
      const isEn = /_en(?:\[|$)/.test(p.field);
      const issues = lawJargonIssues(p.after);
      if (issues.length > 0) throw new Error(`tisk ${p.cislo} ${p.field}: after fails jargon gate — ${issues[0]}`);
      // an _en mirror field is deliberately English — the Czech gate binds only the cs fields
      if (!isEn && czechCopyOrNull(p.after) === null) throw new Error(`tisk ${p.cislo} ${p.field}: after fails the Czech gate`);
      if (LINE_REF.test(p.after)) throw new Error(`tisk ${p.cislo} ${p.field}: after still carries a line/cache reference`);
      // DIGIT GUARD, batch-018 closure M19 hardening — a MULTISET, not a Set (a Set passed any
      // permutation of existing tokens and any deletion of a duplicated token).
      const digitsOf = (s: string) => (s.match(/\d+/g) ?? []) as string[];
      const countOf = (arr: string[]) => arr.reduce((m2, x) => m2.set(x, (m2.get(x) ?? 0) + 1), new Map<string, number>());
      const beforeCnt = countOf(digitsOf(p.before));
      const refCnt = countOf((p.before.match(LINE_REF_ALL) ?? []).flatMap((s) => digitsOf(s)));
      const afterCnt = countOf(digitsOf(p.after));
      for (const [d, n] of beforeCnt) {
        const removed = n - (afterCnt.get(d) ?? 0);
        if (removed > (refCnt.get(d) ?? 0))
          throw new Error(`tisk ${p.cislo} ${p.field}: DIGIT GUARD — "${d}" removed outside a line/cache reference`);
      }
      // digit ADDITIONS are allowed only inside the appended psp.cz URL or in coordinate
      // context (Čl./ČÁST/bod/§/odst./písm./kapitola) — an amount can no longer be inflated.
      const URL_RE = /https:\/\/www\.psp\.cz\/sqw\/text\/tiskt\.sqw\?o=10&ct=\d+&ct1=0/g;
      const afterNoUrl = p.after.replace(URL_RE, "");
      const afterNoUrlCnt = countOf(digitsOf(afterNoUrl));
      // the tail may cross a law-ref's own digits („zákona č. 235/2004" → token „2004")
      // the tail admits list syntax („body 1 a 2", „bodů 1, 2 a 3") and an opening guillemet
      const COORD_CTX = /(?:Čl\.|ČÁST|bod\p{L}*|§|odst\.|písm\.|kapitol\p{L}*|oddíl\p{L}*|část\p{L}*|č\.|tisk\p{L}*)\s*[„\d/.,\- a]{0,18}$/u;
      for (const [d, n] of afterNoUrlCnt) {
        const added = n - (beforeCnt.get(d) ?? 0);
        if (added <= 0) continue;
        let inContext = 0;
        for (const m2 of afterNoUrl.matchAll(new RegExp(`(?<!\\d)${d}(?!\\d)`, "g"))) {
          const pre = afterNoUrl.slice(Math.max(0, (m2.index ?? 0) - 26), m2.index);
          const post = afterNoUrl.slice((m2.index ?? 0) + d.length, (m2.index ?? 0) + d.length + 3);
          // second accepted shape: a numbered section heading quoted in guillemets („2. Odůvodnění…")
          if (COORD_CTX.test(pre) || (pre.endsWith("„") && /^\.\s?\p{Lu}/u.test(post))) inContext++;
        }
        if (inContext < added)
          throw new Error(`tisk ${p.cislo} ${p.field}: DIGIT GUARD — "${d}" added outside coordinate/URL context`);
      }
      // QUOTATION GUARD — top-level guillemet spans with depth tracking (Czech legislative
      // quotations nest; the flat regex left inter-quotation connectives unguarded).
      const spansOf = (s: string) => {
        const out: string[] = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < s.length; i++) {
          if (s[i] === "„") {
            if (depth === 0) start = i;
            depth++;
          } else if (s[i] === "“") {
            depth--;
            if (depth === 0 && start >= 0) out.push(s.slice(start, i + 1));
            if (depth < 0) depth = 0;
          }
        }
        return out;
      };
      for (const q of spansOf(p.before)) {
        if (!p.after.includes(q)) throw new Error(`tisk ${p.cislo} ${p.field}: quotation lost — ${q.slice(0, 60)}`);
      }
      // COORDINATE TRUTH — the guard that would have caught B5: every Čl./ČÁST token the
      // rewrite INTRODUCES must exist in the cached print, and a new „Čl. X bod N … § M"
      // must find both the bod marker and the § inside that article's own span.
      const cacheRaw = readCachedBillText(p.cislo);
      if (cacheRaw) {
        const norm = cacheRaw.normalize("NFC").replace(/\s+/g, " ");
        const COORD_RE = /Čl\.\s*[IVXLC]+(?![IVXLC])|ČÁST(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,}){1,3}/gu;
        const beforeCoords = new Set((p.before.match(COORD_RE) ?? []).map((c) => c.replace(/\s+/g, " ")));
        for (const cRaw of p.after.match(COORD_RE) ?? []) {
          const c = cRaw.replace(/\s+/g, " ");
          if (beforeCoords.has(c)) continue;
          const marker = c.startsWith("Čl.") ? new RegExp(`${c.replace(".", "\\.")}(?![IVXLC])`, "u") : new RegExp(c, "u");
          if (!marker.test(norm)) throw new Error(`tisk ${p.cislo} ${p.field}: COORDINATE GUARD — „${c}" not found in the cached print`);
        }
        for (const m2 of p.after.matchAll(/Čl\.\s*([IVXLC]+)(?![IVXLC])[^.;()]{0,30}?bod\p{L}*\s*(\d+)((?:[^.;)]{0,40}?§\s*\d+[a-z]*)?)/gu)) {
          const pair = `Čl. ${m2[1]} bod ${m2[2]}`;
          if (p.before.replace(/\s+/g, " ").includes(pair.replace(/\s+/g, " "))) continue;
          const artRe = new RegExp(`Čl\\.\\s*${m2[1]}(?![IVXLC])`, "u");
          const artIdx = norm.search(artRe);
          if (artIdx < 0) throw new Error(`tisk ${p.cislo} ${p.field}: COORDINATE GUARD — Čl. ${m2[1]} not found in the cached print`);
          const nextIdx = norm.slice(artIdx + 4).search(/Čl\.\s*[IVXLC]+(?![IVXLC])/u);
          const span = norm.slice(artIdx, nextIdx < 0 ? undefined : artIdx + 4 + nextIdx);
          if (!span.includes(`${m2[2]}.`))
            throw new Error(`tisk ${p.cislo} ${p.field}: COORDINATE GUARD — bod ${m2[2]} not inside Čl. ${m2[1]} of the cached print`);
          const par = /§\s*(\d+[a-z]*)/u.exec(m2[3] ?? "");
          if (par && !span.includes(`§ ${par[1]}`))
            throw new Error(`tisk ${p.cislo} ${p.field}: COORDINATE GUARD — § ${par[1]} not inside Čl. ${m2[1]} of the cached print`);
        }
      }
      byBill.set(p.cislo, [...(byBill.get(p.cislo) ?? []), p]);
      writes++;
    }
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
          if (arr[Number(m[2])][m[3]] !== f.before) throw new Error(`tisk ${cislo} ${f.field}: live text differs from payload — re-run the scan`);
          arr[Number(m[2])][m[3]] = f.after;
        } else {
          if (props[m[1]] !== f.before) throw new Error(`tisk ${cislo} ${f.field}: live text differs from payload — re-run the scan`);
          props[m[1]] = f.after;
        }
      }
      // m18: report a missing provenance capsule in PREPARE rather than TypeError at write
      if (!props.forensic_provenance || typeof props.forensic_provenance !== "object")
        throw new Error(`tisk ${cislo}: bill carries no forensic_provenance capsule — cannot stamp the migration`);
      (props.forensic_provenance as Record<string, unknown>).evidence_migration = { pass: PASS, ref: REF, computedAt: new Date().toISOString() };
      toWrite.push({ ...bill, props });
    }
    console.log(`${writes} field rewrites across ${toWrite.length} bills verified (${skipped} skipped rows).`);
    if (COMMIT) {
      const n = await store.upsertKgNodes(toWrite);
      console.log(`COMMITTED: ${n} bill nodes migrated (pass ${PASS}, ${REF}).`);
    } else {
      console.log("PREPARE only — add --commit after the batch closure to write.");
    }
    await store.close();
  });
}
main0().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
