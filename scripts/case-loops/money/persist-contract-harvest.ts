/* Money loop — batch 012: persist the harvested contract corpus into the graph.
 *
 * Consumes `contracts-harvest.jsonl` (produced by harvest-contract-dumps.ts) and lifts the
 * graph's contract corpus from the capped per-company sample batch 011 exposed to the
 * actual Registr smluv record.
 *
 * FOUR THINGS THIS GETS RIGHT, EACH THE RESULT OF A MEASUREMENT:
 *
 * 1. **Keyed on `idSmlouvy`.** The existing corpus keys `contract:<n>` on `idSmlouvy`,
 *    NOT on the id in the web URL (`idVerze`). Verified: `idSmlouvy` 1443766 is "Mořidla"
 *    (AGROFERT, 2017-03-08) exactly matching the existing node, while `idVerze` 1443766 is
 *    an unrelated contract. Keying on the URL id would have silently duplicated the corpus.
 *
 * 2. **Props are MERGED, never replaced.** `upsertKgNodes` replaces `props` wholesale, so
 *    a naive re-ingest would erase every later pass's annotations. Existing props win on
 *    conflict except for the fields this ingest owns.
 *
 * 3. **A `payer` contract never becomes a `supplies` edge.** `supplies` asserts the
 *    company supplied something. Batch 011 found real rows running the other way (a
 *    prison-labour amendment where the company pays the state). Direction is stated in
 *    only ~18 % of records; among those it runs recipient:payer ≈ 95:5. So: `recipient`
 *    and `unknown` get a `supplies` edge (preserving the corpus's existing semantics),
 *    `payer` never does — and EVERY edge carries `direction` so a consumer can filter on
 *    what is actually known rather than on an assumption.
 *
 * 4. **Values keep their basis.** `hodnotaBezDph`, `hodnotaVcetneDph` and a foreign
 *    currency amount are not the same quantity. All are stored; `amount` keeps the legacy
 *    field's meaning for compatibility and `amountBasis` says which one it is, so a total
 *    can disclose that it mixes bases instead of pretending not to.
 *
 * Also reports (never acts on) legacy contract nodes ABSENT from the current dumps — the
 * publisher retroactively removes records made inaccessible, and the GDPR condition on
 * this dataset obliges a recipient to propagate those deletions.
 *
 *   npx tsx scripts/case-loops/money/persist-contract-harvest.ts                 # dry run
 *   npx tsx scripts/case-loops/money/persist-contract-harvest.ts --commit --pass=41
 */
import { getStore } from "@/lib/db/store";
import { directionFor, type DumpRecord } from "@/lib/ingest/sources/smlouvy-dump";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const JSONL = "docs/data-analysis/case-money/contracts-harvest.jsonl";
const REPORT = "docs/data-analysis/case-money/qmoney-contract-reingest-b12.json";

const flag = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

async function main() {
  const commit = flag("commit");
  const pass = Number(arg("pass") ?? 0);
  if (commit && !Number.isFinite(pass)) throw new Error("--commit requires --pass=<n>");
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Point PGLITE_PATH at a copy, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }

  const fs = await import("node:fs/promises");
  const store = await getStore();
  if (!store) throw new Error("no store");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const icoToCompany = new Map<string, string>();
  for (const c of companies) {
    const ico = String((c.props as Record<string, unknown>)?.ico ?? "");
    if (/^\d{8}$/.test(ico)) icoToCompany.set(ico, c.id);
  }
  const existingContracts = await store.listKgNodes({ kind: "contract", limit: 500_000 });
  const existingById = new Map(existingContracts.map((c) => [c.id, c]));
  const existingSupplies = await store.listKgEdges({ rel: "supplies", limit: 500_000 });
  const existingEdgeKeys = new Set(existingSupplies.map((e) => `${e.src}|${e.dst}`));

  console.log(`graph: ${icoToCompany.size} companies with IČO · ${existingContracts.length} contract nodes · ${existingSupplies.length} supplies edges`);

  // ── read + dedupe the harvest ────────────────────────────────────────────────
  const raw = await fs.readFile(JSONL, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  /** idSmlouvy → the record to keep. Dumps carry every VERSION of a contract; the current
   *  one is `platnyZaznam=1`, and among equals the highest idVerze wins. */
  const best = new Map<string, DumpRecord>();
  let superseded = 0;
  for (const line of lines) {
    const rec = JSON.parse(line) as DumpRecord;
    if (!rec.platnyZaznam) {
      superseded++;
      continue;
    }
    const prev = best.get(rec.idSmlouvy);
    if (!prev || Number(rec.idVerze) > Number(prev.idVerze)) best.set(rec.idSmlouvy, rec);
  }
  console.log(`harvest: ${lines.length} row(s) → ${best.size} distinct contract(s) (${superseded} superseded version(s) dropped)`);

  // ── build node + edge rows ───────────────────────────────────────────────────
  const nodeRows: KgNodeRow[] = [];
  const edgeRows: KgEdgeRow[] = [];
  const stats = {
    newNodes: 0,
    updatedNodes: 0,
    newEdges: 0,
    existingEdges: 0,
    payerEdgesRefused: 0,
    directions: { recipient: 0, payer: 0, unknown: 0 } as Record<string, number>,
    amountBasis: { vcetneDph: 0, bezDph: 0, ciziMena: 0, none: 0 } as Record<string, number>,
  };
  const provenance = {
    track: "money",
    pass,
    method: "deterministic",
    ref: "smlouvy.gov.cz bulk open-data dumps (batch 012 re-ingest; keyed on idSmlouvy)",
    computedAt: new Date().toISOString(),
  };

  for (const rec of best.values()) {
    const id = `contract:${rec.idSmlouvy}`;
    const prior = existingById.get(id);
    const amount = rec.hodnotaVcetneDph ?? rec.hodnotaBezDph ?? null;
    const amountBasis =
      rec.hodnotaVcetneDph !== null ? "vcetneDph" : rec.hodnotaBezDph !== null ? "bezDph" : rec.ciziMena ? "ciziMena" : "none";
    stats.amountBasis[amountBasis]++;

    // Our companies on the non-publishing side — the ones that get an edge.
    const ourParties = rec.smluvniStrany
      .map((s) => s.ico)
      .filter((i): i is string => i !== null && icoToCompany.has(i));

    const dirs = Object.fromEntries(ourParties.map((ico) => [ico, directionFor(ico, rec)]));

    const ingestProps: Record<string, unknown> = {
      // Legacy-compatible fields, same meaning as the original money-feed corpus.
      amount,
      signedOn: rec.datumUzavreni,
      // New, and the reason this re-ingest exists.
      amountBasis,
      hodnotaBezDph: rec.hodnotaBezDph,
      hodnotaVcetneDph: rec.hodnotaVcetneDph,
      ciziMena: rec.ciziMena,
      idVerze: rec.idVerze,
      publishedAt: rec.casZverejneni,
      publisher: rec.subjekt ? { ico: rec.subjekt.ico, nazev: rec.subjekt.nazev } : null,
      parties: rec.smluvniStrany.map((s) => ({ ico: s.ico, nazev: s.nazev, platce: s.platce, prijemce: s.prijemce })),
      partyDirections: dirs,
      cisloSmlouvy: rec.cisloSmlouvy,
      sourceUrl: rec.odkaz,
      amendmentOf: rec.navazanyZaznam.length ? rec.navazanyZaznam : undefined,
      // Kernel pattern: annotation provenance is NESTED IN PROPS so the row's identity
      // provenance column is never clobbered. For an existing node that means the
      // original money-feed provenance survives and this re-ingest is separately auditable.
      reingest_provenance: provenance,
    };
    // MERGE: prior props win, except the fields this ingest owns (which are refreshed).
    const merged = { ...((prior?.props ?? {}) as Record<string, unknown>), ...ingestProps };
    // The legacy corpus carried `supplierIco`; keep it if it was there, but do not invent
    // one — with direction now known, `parties`+`partyDirections` is the honest shape.
    nodeRows.push({
      id,
      kind: "contract",
      label: rec.predmet || prior?.label || `smlouva ${rec.idSmlouvy}`,
      props: merged,
      provenance: prior?.provenance ?? provenance,
    } as KgNodeRow);
    if (prior) stats.updatedNodes++;
    else stats.newNodes++;

    for (const ico of ourParties) {
      const direction = dirs[ico] as "recipient" | "payer" | "unknown";
      stats.directions[direction]++;
      if (direction === "payer") {
        // `supplies` asserts the company supplied. It did not.
        stats.payerEdgesRefused++;
        continue;
      }
      const src = icoToCompany.get(ico)!;
      if (existingEdgeKeys.has(`${src}|${id}`)) stats.existingEdges++;
      else stats.newEdges++;
      edgeRows.push({
        src,
        rel: "supplies",
        dst: id,
        weight: amount ?? 0,
        props: { direction, amountBasis },
        provenance,
      } as KgEdgeRow);
    }
  }

  // ── legacy nodes absent from the current dumps (GDPR / withdrawal signal) ────
  const harvestedIds = new Set([...best.keys()].map((i) => `contract:${i}`));
  const legacyAbsent = existingContracts.filter((c) => !harvestedIds.has(c.id));

  console.log(`\nplan:`);
  console.log(`  contract nodes: ${stats.newNodes} new, ${stats.updatedNodes} updated (props MERGED, not replaced)`);
  console.log(`  supplies edges: ${stats.newEdges} new, ${stats.existingEdges} already present`);
  console.log(`  direction: ${JSON.stringify(stats.directions)}`);
  console.log(`  payer contracts refused a supplies edge: ${stats.payerEdgesRefused}`);
  console.log(`  amount basis: ${JSON.stringify(stats.amountBasis)}`);
  console.log(`  legacy contract nodes absent from current dumps: ${legacyAbsent.length} (reported, NOT deleted)`);

  let applied = false;
  if (commit) {
    console.log(`\n--commit passed (pass ${pass}) — writing…`);
    const n = await store.upsertKgNodes(nodeRows);
    const e = await store.upsertKgEdges(edgeRows);
    console.log(`  upserted ${n} contract node(s), ${e} supplies edge(s)`);
    applied = true;
  } else {
    console.log(`\nDRY-RUN: nothing written. Re-run with --commit --pass=<n>.`);
  }

  await fs.writeFile(
    REPORT,
    JSON.stringify(
      {
        batch: 12, track: "money", kind: "contract-corpus-reingest",
        generatedAt: new Date().toISOString(),
        pass: commit ? pass : null,
        applied,
        note:
          "Re-ingest of the contract corpus from the Registr smluv bulk open-data dumps, keyed on idSmlouvy (the " +
          "graph's existing key — the web URL uses idVerze, a different sequence). Props are MERGED so earlier " +
          "passes' annotations survive. A contract where our company is the PAYER never receives a `supplies` " +
          "edge; direction is recorded on every edge because the register states it in only a minority of records.",
        stats,
        superseded,
        distinctContracts: best.size,
        legacyAbsentFromDumps: legacyAbsent.slice(0, 500).map((c) => ({ id: c.id, label: c.label })),
        legacyAbsentCount: legacyAbsent.length,
      },
      null, 2,
    ),
  );
  console.log(`\nreport: ${REPORT}`);
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
