/* Case ③ Law loop — batch-002 REAL §-diff producer, via the e-Sbírka SPARQL endpoint.
 *
 * batch-001 scoped the flagship diff to a bulk-download problem (dataset 001PravniAktZneni
 * 176 MB + 003PravniAktZneniFragment 1.24 GB, observed ~1 MB/min — infeasible as a batch
 * subtask) and shipped evidence instead of a diff. batch-002 discovered the SAME underlying
 * data is exposed as **point queries** on a public SPARQL endpoint
 * (`https://opendata.eselpoint.gov.cz/sparql`, a Virtuoso store) — every enacted `znění`
 * (version) of a statute and every `§`-level `fragment`'s actual text is directly
 * addressable, at negligible bandwidth, with NO bulk download required. This supersedes the
 * bulk-download plan for point-in-time §-level diffs (the bulk dumps would still matter for a
 * FULL-corpus ingest, e.g. tsvector/GIN over every statute — out of scope here).
 *
 * IRI shape (verified against 586/1992, income tax, 152 enacted versions on record):
 *   version root:  https://opendata.eselpoint.gov.cz/esel-esb/eli/cz/sb/<rok>/<cislo>/<YYYY-MM-DD>
 *     rdf:type slovník.gov.cz/…/znění-právního-aktu
 *     …/účinnost-znění-od, …/účinnost-znění-do  (effective date range, may be open-ended)
 *     …/má-fragment-znění → many fragment IRIs (one per §/odst./písm./bod)
 *   fragment:      .../dokument/norma/cast_N/par_X[/odst_Y[/pism_Z]]
 *     …/citace-označení-fragmentu-znění-právního-aktu → "§ 35ba odst. 1 písm. b)" (label)
 *     …/obsahuje-fragment → a právní-akt-fragment/<id> resource
 *   fragment text: právní-akt-fragment/<id>
 *     …/text-fragmentu → the ACTUAL legal text (HTML-ish, with internal cross-ref <a> tags)
 *
 * Anti-fabrication: every hunk's before/after text is the verbatim `text-fragmentu` value
 * actually returned by the endpoint for that exact version+fragment — never synthesized,
 * never paraphrased. If a fragment is absent in one version (added/removed), that is recorded
 * as `op: "added"|"removed"` with the missing side `null`, never invented.
 *
 *   npx tsx scripts/case-loops/law/esbirka-sparql-diff.ts \
 *     --law=586/1992 --from=2021-01-01 --to=2024-01-01 --par="§ 35ba"
 * → docs/data-analysis/case-law/payloads/diffs/<law-ref>__<from>-<to>__<par-slug>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";

const SPARQL_ENDPOINT = "https://opendata.eselpoint.gov.cz/sparql";
const BASE = "https://opendata.eselpoint.gov.cz/esel-esb";
const P = {
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  znVer: "https://slovník.gov.cz/datový/sbírka/pojem/znění-právního-aktu",
  maFragment: "https://slovník.gov.cz/datový/sbírka/pojem/má-fragment-znění",
  citace: "https://slovník.gov.cz/datový/sbírka/pojem/citace-označení-fragmentu-znění-právního-aktu",
  obsahuje: "https://slovník.gov.cz/datový/sbírka/pojem/obsahuje-fragment",
  textFragmentu: "https://slovník.gov.cz/datový/sbírka/pojem/text-fragmentu",
  ucinnostOd: "https://slovník.gov.cz/datový/sbírka/pojem/účinnost-znění-od",
  ucinnostDo: "https://slovník.gov.cz/datový/sbírka/pojem/účinnost-znění-do",
};

const arg = (name: string, fb = ""): string => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};

interface SparqlBinding {
  [k: string]: { type: string; value: string };
}
async function sparql(query: string): Promise<SparqlBinding[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=${encodeURIComponent("application/sparql-results+json")}`;
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  const text = await res.text();
  let json: { results?: { bindings?: SparqlBinding[] } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`SPARQL endpoint returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  return json.results?.bindings ?? [];
}

function versionIri(lawRef: string, date: string): string {
  const [cislo, rok] = lawRef.split("/");
  return `${BASE}/eli/cz/sb/${rok}/${cislo}/${date}`;
}

async function versionMeta(iri: string): Promise<{ ucinnostOd: string | null; ucinnostDo: string | null }> {
  const rows = await sparql(`SELECT ?p ?o WHERE { <${iri}> ?p ?o . FILTER(?p != <${P.maFragment}>) }`);
  const get = (p: string) => rows.find((r) => r.p.value === p)?.o.value ?? null;
  return { ucinnostOd: get(P.ucinnostOd), ucinnostDo: get(P.ucinnostDo) };
}

interface Frag {
  citace: string;
  fragIri: string;
  text: string | null;
}
async function fragmentsFor(versionIri_: string, parPrefix: string): Promise<Frag[]> {
  const query = `SELECT ?frag ?citace ?text WHERE {
    <${versionIri_}> <${P.maFragment}> ?frag .
    ?frag <${P.citace}> ?citace .
    OPTIONAL { ?frag <${P.obsahuje}> ?c . ?c <${P.textFragmentu}> ?text . }
    FILTER(STRSTARTS(STR(?citace), "${parPrefix}"))
  } ORDER BY ?citace`;
  const rows = await sparql(query);
  return rows.map((r) => ({ citace: r.citace.value, fragIri: r.frag.value, text: r.text?.value ?? null }));
}

async function main() {
  const lawRef = arg("law", "586/1992");
  const fromDate = arg("from", "2021-01-01");
  const toDate = arg("to", "2024-01-01");
  const parPrefix = arg("par", "§ 35ba");
  if (!lawRef || !fromDate || !toDate || !parPrefix) throw new Error("usage: --law=N/RRRR --from=YYYY-MM-DD --to=YYYY-MM-DD --par='§ N'");

  const fromIri = versionIri(lawRef, fromDate);
  const toIri = versionIri(lawRef, toDate);
  console.log(`fetching ${lawRef} ${fromDate} …`);
  const [fromMeta, fromFrags] = await Promise.all([versionMeta(fromIri), fragmentsFor(fromIri, parPrefix)]);
  console.log(`fetching ${lawRef} ${toDate} …`);
  const [toMeta, toFrags] = await Promise.all([versionMeta(toIri), fragmentsFor(toIri, parPrefix)]);

  if (fromFrags.length === 0) throw new Error(`no fragments found for ${parPrefix} in ${fromDate} — check the version exists and the § prefix matches a real "citace" string`);
  if (toFrags.length === 0) throw new Error(`no fragments found for ${parPrefix} in ${toDate}`);

  const byFromCitace = new Map(fromFrags.map((f) => [f.citace, f]));
  const byToCitace = new Map(toFrags.map((f) => [f.citace, f]));
  const allCitace = [...new Set([...byFromCitace.keys(), ...byToCitace.keys()])].sort();

  const hunks = allCitace
    .map((citace) => {
      const before = byFromCitace.get(citace)?.text ?? null;
      const after = byToCitace.get(citace)?.text ?? null;
      let op: "modified" | "added" | "removed" | "unchanged";
      if (before === null && after !== null) op = "added";
      else if (before !== null && after === null) op = "removed";
      else if (before !== after) op = "modified";
      else op = "unchanged";
      return { fragment: citace, op, before, after };
    })
    .filter((h) => h.op !== "unchanged");

  if (hunks.length === 0) {
    console.log(`no differences found for ${parPrefix} between ${fromDate} and ${toDate} — not writing an artifact (nothing to show is a valid, honest result)`);
    return;
  }

  const artifact = {
    law: lawRef,
    source: "e-Sbírka SPARQL endpoint (opendata.eselpoint.gov.cz/sparql) — point queries, real fetched text",
    fetchedAt: new Date().toISOString(),
    from: { date: fromDate, effectiveFrom: fromMeta.ucinnostOd, effectiveTo: fromMeta.ucinnostDo, eli: fromIri },
    to: { date: toDate, effectiveFrom: toMeta.ucinnostOd, effectiveTo: toMeta.ucinnostDo, eli: toIri },
    parScope: parPrefix,
    hunks,
    provenance: { track: "law", pass: 0, method: "deterministic", ref: "esbirka-sparql-diff" },
  };

  const lawSlug = lawRef.replace("/", "-");
  const parSlug = parPrefix.replace(/[^\w]+/g, "").toLowerCase();
  const outDir = "docs/data-analysis/case-law/payloads/diffs";
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/${lawSlug}__${fromDate}_${toDate}__${parSlug}.json`;
  writeFileSync(outPath, JSON.stringify(artifact, null, 1));
  console.log(`\n${hunks.length} real hunks (${hunks.filter((h) => h.op === "modified").length} modified, ${hunks.filter((h) => h.op === "added").length} added, ${hunks.filter((h) => h.op === "removed").length} removed) → ${outPath}`);
  for (const h of hunks) console.log(`  [${h.op}] ${h.fragment}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
