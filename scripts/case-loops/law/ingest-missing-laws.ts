/* Case ③ Law loop — batch-005 P1a: missing-law-node ingest (Q-law-12).
 *
 * batch-004's amends regen (`amends-regen.ts`) found 289 real amendment citations (50.6% of the
 * 571 considered) pointing at 188 statutes with NO `law` node in the graph — the regeneration
 * couldn't turn them into edges without fabricating targets. This script resolves those 188
 * statute refs against e-Sbírka's authoritative act-master registry and emits NODE payloads only
 * (never edges — that is `amends-regen.ts`'s job, re-run after this lands).
 *
 * Access-path note (kernel doctrine: "before a resource-constrained pull, probe whether the SAME
 * source exposes a cheaper access path"): the batch-005 brief named the SPARQL point-query
 * endpoint (`esbirka-sparql-diff.ts`'s method) as the resolution path. Investigation this batch
 * found the SPARQL endpoint exposes only versioned §-fragment text and a bare "N/RRRR Sb."
 * citation string on the act root — NO title/ELI metadata field is queryable there (confirmed by
 * exhausting the akt root's predicate list and testing rdfs:label/dc:title/name candidates, all
 * empty). The ALREADY-PROVEN cheaper path in this repo is `scripts/data-analysis/esbirka-laws.ts`'s
 * bulk act-master dump (002PravniAkt.json.gz, e-Sbírka's OFN JSON-LD registry, "the whole Sbírka
 * zákonů since 1918" per its own header comment) — it is what stamped `esbirka_title` +
 * `esbirka_exists` on all 101 existing law nodes at pass 11, is already cached at
 * .data/esbirka/002.json.gz (5.4 MB, fetched 2026-07-24), and carries BOTH the official title
 * (`akt-název-vyhlášený`) and a real ELI (`akt-iri`: "esel-esb:eli/cz/sb/<rok>/<cislo>") per act —
 * exactly the fields the brief asked for, at zero additional network cost. This is the same class
 * of substitution as batch-002's bulk→SPARQL-point-query pivot: same source, cheaper/more-complete
 * access path, negligible bandwidth, no LLM in the loop.
 *
 * Anti-fabrication: a node is emitted ONLY if the ref appears in the e-Sbírka bulk registry's
 * "akt-citace" index (a genuine Sbírka-zákonů act). Refs absent from the registry are recorded in
 * the `unresolvable` list with a reason — never invented as a node. Every emitted node's title is
 * the verbatim `akt-název-vyhlášený` string from the registry, truncated only for the display
 * label (same convention as esbirka-laws.ts), never paraphrased.
 *
 * PREPARE only — writes a node-payload JSON, does not touch any `.pglite` store (live or copy).
 * The orchestrator/persist step applies it under the write lock, same pattern as the amends regen.
 *
 *   npx tsx scripts/case-loops/law/ingest-missing-laws.ts
 * → docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

// --in= / --out= override the batch-005 defaults (batch-013 reuses this for the five refs
// batch-008's regen census flagged after the batch-005 ingest had already run).
const REGEN_IN =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ?? "docs/data-analysis/case-law/payloads/batch-005-amends-regen.json";
const OUT =
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json";
const ESBIRKA_DIR = ".data/esbirka";
const URL_002 = "https://opendata.eselpoint.gov.cz/datove-sady-esbirka/002PravniAkt.json.gz";
const CITATION = /^(\d{1,4})\/(\d{4})\s+Sb\.$/; // Sbírka zákonů only (excludes "Sb. m. s.")

interface Akt {
  "akt-citace"?: string;
  "akt-název-vyhlášený"?: string;
  "akt-iri"?: string;
}

interface RegenPayload {
  missingLawNodeCensus: { statute: string; citingBillCount: number; sampleBillIds: string[]; sampleBillCislo: number[] }[];
}

async function getBulk(): Promise<Uint8Array> {
  mkdirSync(ESBIRKA_DIR, { recursive: true });
  const p = join(ESBIRKA_DIR, "002.json.gz");
  if (existsSync(p)) {
    console.log(`using cached ${p} (rerun with the .data/esbirka dir removed to refetch)`);
    return new Uint8Array(readFileSync(p));
  }
  console.log(`fetching ${URL_002} …`);
  const res = await fetch(URL_002, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`GET 002PravniAkt → HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  writeFileSync(p, bytes);
  return bytes;
}

function normalizeEli(iri: string | undefined): string | null {
  if (!iri) return null;
  // registry uses the CURIE-ish "esel-esb:eli/cz/sb/<rok>/<cislo>" — expand to the real ELI URL
  // (same host esbirka-sparql-diff.ts already resolves fragments against).
  return iri.replace(/^esel-esb:/, "https://opendata.eselpoint.gov.cz/esel-esb/");
}

async function main() {
  const regen: RegenPayload = JSON.parse(readFileSync(REGEN_IN, "utf8"));
  const missing = regen.missingLawNodeCensus;
  console.log(`${missing.length} statutes to resolve (from ${REGEN_IN})`);

  const gz = await getBulk();
  const parsed = JSON.parse(gunzipSync(gz).toString("utf8")) as { položky?: Akt[] };
  const acts = parsed.položky ?? [];

  const byRef = new Map<string, { title: string | null; eli: string | null }>();
  for (const a of acts) {
    const m = (a["akt-citace"] ?? "").match(CITATION);
    if (!m) continue;
    const ref = `${Number(m[1])}/${m[2]}`;
    if (byRef.has(ref)) continue; // first occurrence wins (matches esbirka-laws.ts convention)
    byRef.set(ref, { title: a["akt-název-vyhlášený"] ?? null, eli: normalizeEli(a["akt-iri"]) });
  }
  console.log(`e-Sbírka bulk registry: ${acts.length.toLocaleString()} acts, ${byRef.size.toLocaleString()} distinct Sbírka-zákonů refs`);

  interface NodePayload {
    id: string;
    kind: "law";
    label: string;
    props: { ref: string; esbirka_title: string | null; esbirka_exists: true; esbirka_eli: string | null };
    provenance: { track: "law"; method: "deterministic"; ref: "missing-law-ingest"; computedAt: string };
    citingBillCount: number;
    sampleBillCislo: number[];
  }
  const resolved: NodePayload[] = [];
  const unresolvable: { statute: string; citingBillCount: number; sampleBillCislo: number[]; reason: string }[] = [];
  const now = new Date().toISOString();

  for (const m of missing) {
    const hit = byRef.get(m.statute);
    if (!hit) {
      const [, rokStr] = m.statute.split("/");
      const rok = Number(rokStr);
      const reason =
        rok < 1918
          ? "predates the e-Sbírka registry's coverage (Sbírka zákonů since 1918) — genuinely out of scope, not a bug"
          : "not present in the e-Sbírka act-master registry under this exact ref — likely a citation-extraction artifact (malformed ref, 'Sb. m. s.' international-treaty citation misparsed as a law, or a repealed/renumbered act not carried in 002PravniAkt) — needs a citation-string audit, not a fabricated node";
      unresolvable.push({ statute: m.statute, citingBillCount: m.citingBillCount, sampleBillCislo: m.sampleBillCislo, reason });
      continue;
    }
    resolved.push({
      id: `law:sb:${m.statute.replace("/", "-")}`,
      kind: "law",
      label: hit.title ? `zákon č. ${m.statute} Sb. — ${hit.title.slice(0, 120)}` : `zákon č. ${m.statute} Sb.`,
      props: { ref: m.statute, esbirka_title: hit.title, esbirka_exists: true, esbirka_eli: hit.eli },
      provenance: { track: "law", method: "deterministic", ref: "missing-law-ingest", computedAt: now },
      citingBillCount: m.citingBillCount,
      sampleBillCislo: m.sampleBillCislo,
    });
  }

  const preExisting1918 = unresolvable.filter((u) => u.reason.startsWith("predates"));
  const genuinelyUnresolvable = unresolvable.filter((u) => !u.reason.startsWith("predates"));

  const out = {
    generatedAt: now,
    method:
      "For each of the 188 statutes in batch-004's missingLawNodeCensus (real amendment citations with no law node), resolve against the e-Sbírka act-master bulk registry (002PravniAkt.json.gz, cached .data/esbirka/002.json.gz) by exact 'N/RRRR Sb.' citation match. A node is emitted ONLY for a registry hit; the title (esbirka_title) is the verbatim akt-název-vyhlášený string, the ELI (esbirka_eli) is the expanded akt-iri. No node is fabricated for a registry miss — those are recorded honestly in `unresolvable` with a reason, split into genuinely-out-of-scope (pre-1918, outside the registry's stated coverage) vs needs-audit (post-1918 ref not found — likely a citation-extraction artifact upstream, not a real gap in the law).",
    boundary: "PREPARE only — no .pglite read or write. Node payloads for the orchestrator's persist step; amends-regen.ts must be RE-RUN after these land so the now-resolvable citations become edges (that is Q-law-11's job, not this script's).",
    stats: {
      totalStatutes: missing.length,
      resolved: resolved.length,
      unresolvableTotal: unresolvable.length,
      unresolvablePre1918: preExisting1918.length,
      unresolvableNeedsAudit: genuinelyUnresolvable.length,
      totalCitingBillCitationsResolved: resolved.reduce((a, r) => a + r.citingBillCount, 0),
      totalCitingBillCitationsUnresolved: unresolvable.reduce((a, r) => a + r.citingBillCount, 0),
    },
    resolved,
    unresolvable,
  };

  mkdirSync("docs/data-analysis/case-law/payloads", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");

  console.log(`\nResolved: ${resolved.length} / ${missing.length} (${((resolved.length / missing.length) * 100).toFixed(1)}%)`);
  console.log(`Unresolvable: ${unresolvable.length} — ${preExisting1918.length} pre-1918 (out of scope), ${genuinelyUnresolvable.length} need a citation-extraction audit`);
  if (genuinelyUnresolvable.length > 0) {
    console.log(`\nNeeds-audit list:`);
    for (const u of genuinelyUnresolvable) console.log(`  ${u.statute} (${u.citingBillCount} citing bills, sample cislo ${u.sampleBillCislo.join(", ")})`);
  }
  console.log(`\n→ ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
