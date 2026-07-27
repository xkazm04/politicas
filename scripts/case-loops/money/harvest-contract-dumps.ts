/* Money loop — batch 012: harvest the full contract history for our companies.
 *
 * Batch 011 proved the graph's contract corpus is a capped per-company sample (35
 * companies at exactly 25 `supplies` edges; nothing after 2019), so every CZK figure in
 * the case is a floor. This lifts it to the actual record, from the Registr smluv bulk
 * open-data dumps rather than the rate-limited HTML search.
 *
 * WHAT IT DOES. Walks the monthly dump index (2016-05 → present, ~123 files, ~26 GB),
 * downloads one file at a time, keeps only records touching one of the graph's company
 * IČOs, appends them to a JSONL, and DELETES the file before moving on — peak disk is one
 * dump, and no bulk personal-data corpus is ever retained (the publisher's GDPR condition
 * makes the recipient a data controller; see `lib/ingest/sources/smlouvy-dump.ts`).
 *
 * RESUMABLE by construction: a state file records each completed month, so a kill, a
 * network stall or a rate limit costs one file rather than the run. Re-running skips what
 * is done; `--refresh` re-harvests a month (dumps are retroactively updated when a
 * contract is amended or made inaccessible, so periodic re-harvest is how deletions and
 * corrections propagate into our copy).
 *
 * This script WRITES NOTHING TO THE GRAPH. It produces the evidence file that a separate,
 * gated persist step consumes — same discipline as every other batch.
 *
 *   npx tsx scripts/case-loops/money/harvest-contract-dumps.ts --from=2025-10
 *   npx tsx scripts/case-loops/money/harvest-contract-dumps.ts            # everything
 *   npx tsx scripts/case-loops/money/harvest-contract-dumps.ts --refresh=2026-07
 */
import { getStore } from "@/lib/db/store";
import { parseDump, parseDumpIndex, type DumpIndexEntry } from "@/lib/ingest/sources/smlouvy-dump";

const INDEX_URL = "https://data.smlouvy.gov.cz/";
const WORK_DIR = ".smlouvy-dump-cache";
const OUT_JSONL = "docs/data-analysis/case-money/contracts-harvest.jsonl";
const STATE = "docs/data-analysis/case-money/contracts-harvest-state.json";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const flag = (n: string) => process.argv.includes(`--${n}`);

interface HarvestState {
  /** "YYYY-MM" → what that month contributed, so a resumed run can report honestly. */
  months: Record<string, { records: number; publisherOnlyDropped: number; bytes: number; harvestedAt: string }>;
  /** Publisher-side matches dropped across the whole harvest, per IČO — the steward
   *  institutions' own contracting. Kept as an auditable total so the exclusion is
   *  visible rather than inferred from a missing number. */
  publisherOnlyByIco: Record<string, number>;
  icoCount: number;
  startedAt: string;
  updatedAt: string;
}

const key = (e: DumpIndexEntry) => `${e.rok}-${String(e.mesic).padStart(2, "0")}`;

async function main() {
  const fs = await import("node:fs/promises");
  const { createWriteStream } = await import("node:fs");
  const { Readable } = await import("node:stream");
  const { pipeline } = await import("node:stream/promises");

  // 1) the allow-list — required, and drawn from the graph so it can never drift
  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  await store.close();
  const icos = new Set(
    companies
      .map((c) => String((c.props as Record<string, unknown>)?.ico ?? ""))
      .filter((i) => /^\d{8}$/.test(i)),
  );
  if (icos.size === 0) throw new Error("refusing to harvest with an empty IČO allow-list");
  console.log(`allow-list: ${icos.size} company IČOs from the graph`);

  await fs.mkdir(WORK_DIR, { recursive: true });

  // 2) resume state
  const state: HarvestState = await fs
    .readFile(STATE, "utf8")
    .then((s) => JSON.parse(s) as HarvestState)
    .catch((e: unknown) => {
      console.log(`  (starting a fresh harvest: ${e instanceof Error ? e.message : String(e)})`);
      return { months: {}, publisherOnlyByIco: {}, icoCount: icos.size, startedAt: new Date().toISOString(), updatedAt: "" };
    });

  // 3) index
  const indexXml = await (await fetch(INDEX_URL, { signal: AbortSignal.timeout(120_000) })).text();
  const all = parseDumpIndex(indexXml);
  // Daily increments are subsets of their month — harvesting both would double-count.
  let months = all.filter((e) => e.isMonthly).sort((a, b) => a.rok - b.rok || a.mesic - b.mesic);
  const from = arg("from");
  const to = arg("to");
  if (from) months = months.filter((e) => key(e) >= from);
  if (to) months = months.filter((e) => key(e) <= to);
  const refresh = arg("refresh");
  const todo = months.filter((e) => (refresh ? key(e) === refresh : !state.months[key(e)]));

  const totalBytes = todo.reduce((s, e) => s + e.velikostDumpu, 0);
  console.log(
    `monthly dumps: ${months.length} in range · ${Object.keys(state.months).length} already harvested · ` +
      `${todo.length} to do (${(totalBytes / 1e9).toFixed(2)} GB)\n`,
  );
  if (todo.length === 0) {
    console.log("nothing to do.");
    return;
  }

  // Appending (not rewriting) keeps a killed run's work; the persist step dedupes on
  // idSmlouvy anyway, and `--refresh` deliberately re-appends a corrected month.
  if (flag("restart")) await fs.rm(OUT_JSONL, { force: true });

  let grandTotal = 0;
  let grandDropped = 0;
  for (const entry of todo) {
    const k = key(entry);
    const file = `${WORK_DIR}/dump_${k.replace("-", "_")}.xml`;
    const started = Date.now();
    process.stdout.write(`  ${k}  ${(entry.velikostDumpu / 1e6).toFixed(0).padStart(4)} MB … `);
    try {
      const res = await fetch(entry.odkaz, { signal: AbortSignal.timeout(900_000) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(file));

      const xml = await fs.readFile(file, "utf8");
      const { party, publisherOnly, publisherOnlyByIco } = parseDump(xml, icos);
      if (party.length) {
        await fs.appendFile(
          OUT_JSONL,
          party.map((r) => JSON.stringify({ ...r, _month: k })).join("\n") + "\n",
        );
      }
      grandTotal += party.length;
      grandDropped += publisherOnly;
      for (const [ico, n] of Object.entries(publisherOnlyByIco)) {
        state.publisherOnlyByIco[ico] = (state.publisherOnlyByIco[ico] ?? 0) + n;
      }
      state.months[k] = {
        records: party.length,
        publisherOnlyDropped: publisherOnly,
        bytes: entry.velikostDumpu,
        harvestedAt: new Date().toISOString(),
      };
      state.updatedAt = new Date().toISOString();
      await fs.writeFile(STATE, JSON.stringify(state, null, 2));
      console.log(
        `${String(party.length).padStart(5)} party record(s)` +
          `  (+${String(publisherOnly).padStart(5)} publisher-side, excluded)` +
          `  [${((Date.now() - started) / 1000).toFixed(0)}s, running total ${grandTotal}]`,
      );
    } catch (e) {
      // A failed month is recorded as NOT done, so a resume retries it. Never silently
      // treated as "zero contracts that month".
      console.log(`FAILED — ${e instanceof Error ? e.message : String(e)} (will retry on resume)`);
    } finally {
      // One dump on disk at a time, and no retained bulk personal-data corpus.
      await fs.rm(file, { force: true });
    }
  }

  console.log(`\nharvested ${grandTotal} PARTY-side record(s) into ${OUT_JSONL}`);
  console.log(
    `excluded ${grandDropped} publisher-side match(es) — allow-listed public bodies publishing their OWN ` +
      `contracts, which the steward rule never attributes to a politician (per-IČO totals in the state file).`,
  );
  console.log(`state: ${STATE} (${Object.keys(state.months).length}/${months.length} months done)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
