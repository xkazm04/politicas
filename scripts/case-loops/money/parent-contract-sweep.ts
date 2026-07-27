/* Money loop — batch 009: give the indirect-ownership layer its first real power.
 *
 * Batch 008 asked whether ownership PARENTS of MP-tied companies hold public money and
 * got 0. Batch 009's power check proved that null was arithmetically guaranteed: the
 * graph's `supplies` edges cover exactly the 149 MP-tied companies the money feed ever
 * contract-queried, and 0/19 ownership parents were among them. The question had never
 * actually been asked of the contract registry.
 *
 * This script asks it, via the token-free Registr smluv party search
 * (`lib/ingest/sources/smlouvy.ts`, batch 009) — one query per parent IČO.
 *
 * WHAT IT DOES NOT DO. It writes nothing to the graph. Registr smluv's `party_idnum`
 * matches EITHER contracting party, so a hit says "this company appears in a published
 * public contract", NOT "this company was paid public money" — the direction has to be
 * read off each row (publisher = the contracting authority). Rows are therefore emitted
 * as LEADS with their publisher intact, for a later gated pass.
 *
 * TIE-CLASS DISCIPLINE (the case's hardest-won rule) is applied at report time: a parent
 * that is itself a public body — a ministry, region, or municipality — has contract
 * activity that is the BODY'S OWN, and must never be attributed to an MP. Those parents
 * are queried and reported, but under a separate, explicitly non-attributable heading.
 *
 * BE POLITE. smlouvy.gov.cz rate-limits (429) an unthrottled sweep within a handful of
 * requests — hit on the first batch-009 run. This script therefore paces itself
 * (`--delay`, default 12 s between parents) and backs off on 429 rather than hammering.
 * A 429 is NEVER recorded as "no contracts": it is an explicit query failure.
 *
 *   npx tsx scripts/case-loops/money/parent-contract-sweep.ts            # all parents
 *   npx tsx scripts/case-loops/money/parent-contract-sweep.ts --private  # private only
 *   npx tsx scripts/case-loops/money/parent-contract-sweep.ts --delay=20000
 *
 * Reads the graph (safe on the live DB — read-only), then hits the network once per parent.
 */
import { getStore } from "@/lib/db/store";
import { SmlouvyClient, type SmlouvyRow } from "@/lib/ingest/sources/smlouvy";

const PAYLOAD_PATH = "docs/data-analysis/case-money/qmoney-parent-contract-sweep-b9.json";
const flag = (name: string) => process.argv.includes(`--${name}`);
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry a 429 with escalating backoff. Returns the result, or rethrows the last error —
 *  never converts a rate-limit into an empty result set. */
async function withBackoff<T>(label: string, run: () => Promise<T>, waits: number[]): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = msg.includes("429") || msg.includes("fetch failed");
      if (!retryable || attempt === waits.length) throw e;
      const wait = waits[attempt];
      console.log(`\n      rate-limited on ${label} — backing off ${wait / 1000}s (attempt ${attempt + 1}/${waits.length})`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** A parent whose contract activity is its own public mandate, never an MP's exposure.
 *  Keyed on the label pattern the graph actually carries (ministries, kraje, města). */
const PUBLIC_BODY_RE = /^(ministerstvo|.*\bkraj$|hlavní město|statutární město|město |obec )/i;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const byId = new Map(companies.map((c) => [c.id, c]));
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });
  const tied = new Set(linked.map((e) => e.dst));
  const everQueried = new Set(supplies.map((e) => e.src));
  await store.close();

  // The population: ownership parents that are NOT themselves MP-tied and were never
  // contract-queried — i.e. exactly the blind spot the power check identified.
  const parents = [...new Set(ownsStake.map((e) => e.src))]
    .filter((id) => !tied.has(id) && !everQueried.has(id))
    .map((id) => {
      const node = byId.get(id);
      const label = node?.label ?? id;
      return {
        id,
        label,
        ico: String((node?.props as Record<string, unknown>)?.ico ?? ""),
        isPublicBody: PUBLIC_BODY_RE.test(label),
        /** which MP-tied companies sit under this parent — the reason it is in scope */
        children: ownsStake.filter((e) => e.src === id).map((e) => byId.get(e.dst)?.label ?? e.dst),
      };
    })
    .filter((p) => p.ico.length === 8);

  const scope = flag("private") ? parents.filter((p) => !p.isPublicBody) : parents;
  console.log(`ownership parents in scope: ${scope.length} (${parents.filter((p) => !p.isPublicBody).length} private, ${parents.filter((p) => p.isPublicBody).length} public bodies)\n`);

  const client = new SmlouvyClient();
  interface Result {
    parentId: string;
    parent: string;
    ico: string;
    isPublicBody: boolean;
    children: string[];
    contracts: number;
    truncated: boolean;
    valuedContracts: number;
    totalCzk: number;
    unvaluedContracts: number;
    earliest: string | null;
    latest: string | null;
    topRows: SmlouvyRow[];
    error: string | null;
  }
  const results: Result[] = [];

  const delayMs = Number(arg("delay") ?? 12_000);
  let first = true;
  for (const p of scope) {
    if (!first) await sleep(delayMs);
    first = false;
    process.stdout.write(`  ${p.ico} ${p.label} … `);
    try {
      const { rows, truncated } = await withBackoff(p.ico, () => client.fetchAllForIco(p.ico), [60_000, 120_000, 240_000]);
      const valued = rows.filter((r) => typeof r.valueCzk === "number");
      const total = valued.reduce((s, r) => s + (r.valueCzk ?? 0), 0);
      const dates = rows.map((r) => r.publishedOn).filter((d): d is string => Boolean(d)).sort();
      results.push({
        parentId: p.id,
        parent: p.label,
        ico: p.ico,
        isPublicBody: p.isPublicBody,
        children: p.children,
        contracts: rows.length,
        truncated,
        valuedContracts: valued.length,
        totalCzk: total,
        unvaluedContracts: rows.length - valued.length,
        earliest: dates[0] ?? null,
        latest: dates[dates.length - 1] ?? null,
        topRows: [...valued].sort((a, b) => (b.valueCzk ?? 0) - (a.valueCzk ?? 0)).slice(0, 5),
        error: null,
      });
      console.log(`${rows.length} contract(s), ${total.toLocaleString("cs-CZ")} CZK across ${valued.length} valued${truncated ? " [TRUNCATED at maxPages]" : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Never silently absorb a failed query — an un-queried parent must not read as a zero.
      results.push({
        parentId: p.id, parent: p.label, ico: p.ico, isPublicBody: p.isPublicBody, children: p.children,
        contracts: 0, truncated: false, valuedContracts: 0, totalCzk: 0, unvaluedContracts: 0,
        earliest: null, latest: null, topRows: [], error: msg,
      });
      console.log(`QUERY FAILED — ${msg}`);
    }
  }

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const priv = ok.filter((r) => !r.isPublicBody);
  const pub = ok.filter((r) => r.isPublicBody);
  const privHits = priv.filter((r) => r.contracts > 0);

  console.log(`\n── PRIVATE ownership parents (attributable indirect exposure — leads) ──`);
  for (const r of priv.sort((a, b) => b.totalCzk - a.totalCzk)) {
    console.log(
      `  ${r.parent} (${r.ico}) — ${r.contracts} contract(s), ${r.totalCzk.toLocaleString("cs-CZ")} CZK` +
        `${r.unvaluedContracts ? ` (+${r.unvaluedContracts} without a stated value)` : ""}` +
        `${r.earliest ? `, ${r.earliest}–${r.latest}` : ""}\n      owns MP-tied: ${r.children.join(", ")}`,
    );
  }
  console.log(`\n── PUBLIC-BODY parents (own mandate — NEVER attributed to an MP) ──`);
  for (const r of pub.sort((a, b) => b.contracts - a.contracts)) {
    console.log(`  ${r.parent} (${r.ico}) — ${r.contracts} contract(s) [not attributable]`);
  }
  if (failed.length) {
    console.log(`\n── QUERY FAILURES (reported, never counted as zero) ──`);
    for (const r of failed) console.log(`  ${r.parent} (${r.ico}): ${r.error}`);
  }

  console.log(
    `\nSUMMARY: ${privHits.length}/${priv.length} private ownership parents hold at least one published public contract` +
      ` — exposure the direct linked_to join structurally cannot see. ${failed.length} query failure(s).`,
  );

  await fs.writeFile(
    PAYLOAD_PATH,
    JSON.stringify(
      {
        batch: 9,
        track: "money",
        kind: "parent-contract-sweep",
        generatedAt: new Date().toISOString().slice(0, 10),
        source: "https://smlouvy.gov.cz/vyhledavani?party_idnum=<ico>&all_versions=0 (Registr smluv / ISRS, token-free)",
        note:
          "LEADS ONLY — no graph write. `party_idnum` matches EITHER contracting party, so a row means 'this company " +
          "appears in a published public contract', not 'this company was paid public money'; each row keeps its " +
          "publisher (the contracting authority) so direction can be read. Public-body parents are reported " +
          "separately and are NEVER attributable to an MP (the tie_class steward rule).",
        counts: {
          parentsInScope: scope.length,
          queried: ok.length,
          failed: failed.length,
          privateParents: priv.length,
          privateParentsWithContracts: privHits.length,
          publicBodyParents: pub.length,
        },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nwritten: ${PAYLOAD_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
