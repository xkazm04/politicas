/* Money loop — batch 010: sweep the un-contract-queried company population.
 *
 * Batch 009 found the case's ceiling: `supplies` edges exist only for the 149 companies
 * the original money feed happened to query. Batch 010's enumeration
 * (`unqueried-population-b10.ts`) shows what that leaves out — most importantly **18
 * `owner-operator` companies**, the one tie class where money reaching the company can
 * plausibly reach the MP. Nobody has ever asked whether they hold public contracts.
 *
 * This sweeps them via the token-free Registr smluv client, in the ranked order the
 * enumeration produced (owner-operator → manager → steward → parents).
 *
 * TWO THINGS BATCH 009 GOT WRONG AND THIS FIXES:
 *  1. **Results were lost on kill.** The batch-009 sweep wrote its payload only at the
 *     end; when the process died mid-run, 8 completed queries went with it. This writes
 *     the payload after EVERY company and supports `--resume`, so rate-limit deaths cost
 *     one query, not the run.
 *  2. **A 429 read as an answer.** Failures are recorded as explicit `error` rows and are
 *     never counted as "no contracts" — and `--resume` retries exactly those.
 *
 * Every result is a LEAD. `party_idnum` matches EITHER contracting party, so a hit means
 * "appears in a published public contract", never "was paid public money"; each row keeps
 * its publisher so direction can be read. Nothing here is written to the graph.
 *
 *   npx tsx scripts/case-loops/money/company-contract-sweep.ts --class=owner-operator
 *   npx tsx scripts/case-loops/money/company-contract-sweep.ts --resume --limit=10
 *   npx tsx scripts/case-loops/money/company-contract-sweep.ts --delay=30000 --only=64258998
 */
import { SmlouvyClient, type SmlouvyRow } from "@/lib/ingest/sources/smlouvy";

const POPULATION = "docs/data-analysis/case-money/qmoney-unqueried-population-b10.json";
const OUT = "docs/data-analysis/case-money/qmoney-company-sweep-b10.json";

const flag = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface PopRow {
  id: string; label: string; ico: string | null; bestTieClass: string | null;
  tieCount: number; mps: string[]; corroborations: string[]; reason: string;
  isOwnershipParent: boolean;
}

interface Result {
  id: string; label: string; ico: string; tieClass: string | null; mps: string[];
  corroborations: string[]; reason: string;
  contracts: number | null; valuedContracts: number; unvaluedContracts: number;
  totalCzk: number; earliest: string | null; latest: string | null; truncated: boolean;
  /** Distinct publishers — the contracting authorities. Direction is read from these. */
  publishers: { name: string; contracts: number; czk: number }[];
  topRows: SmlouvyRow[];
  error: string | null;
  checkedAt: string;
}

async function withBackoff<T>(label: string, run: () => Promise<T>, waits: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 429 (rate limit), any 5xx (the site returned a real 500 mid-sweep on 2026-07-27),
      // and transport failures are all transient. A header-drift or parse error is NOT —
      // retrying those just repeats a bug.
      const retryable = /→ (?:429|5\d\d) /.test(msg) || msg.includes("fetch failed");
      if (!retryable || attempt >= waits.length) throw e;
      console.log(`\n      rate-limited on ${label} — backing off ${waits[attempt] / 1000}s (${attempt + 1}/${waits.length})`);
      await sleep(waits[attempt]);
    }
  }
}

async function main() {
  const fs = await import("node:fs/promises");
  const pop = JSON.parse(await fs.readFile(POPULATION, "utf8")) as { sweepOrder: PopRow[] };

  // Prior results (for --resume): keep successes, retry failures.
  let prior: Result[] = [];
  if (flag("resume")) {
    const raw = await fs.readFile(OUT, "utf8").catch((e: unknown) => {
      // An absent file is a legitimate "nothing to resume", not an error to hide.
      console.log(`  (no prior results to resume: ${e instanceof Error ? e.message : String(e)})`);
      return null;
    });
    if (raw) prior = (JSON.parse(raw) as { results: Result[] }).results ?? [];
  }
  const done = new Map(prior.filter((r) => !r.error).map((r) => [r.ico, r]));

  const wantClass = arg("class");
  const only = arg("only");
  const limit = Number(arg("limit") ?? Number.POSITIVE_INFINITY);
  const delayMs = Number(arg("delay") ?? 30_000);

  let queue = pop.sweepOrder.filter((r): r is PopRow & { ico: string } => Boolean(r.ico));
  if (wantClass) queue = queue.filter((r) => (r.bestTieClass ?? r.reason) === wantClass);
  if (only) queue = queue.filter((r) => r.ico === only);
  queue = queue.filter((r) => !done.has(r.ico)).slice(0, limit);

  console.log(`sweep queue: ${queue.length} compan${queue.length === 1 ? "y" : "ies"}` +
    `${wantClass ? ` (class=${wantClass})` : ""}${done.size ? ` · ${done.size} already done (resumed)` : ""}`);
  console.log(`pacing: ${delayMs / 1000}s between companies\n`);

  const results: Result[] = [...done.values()];
  const client = new SmlouvyClient();

  const persist = async () => {
    const ok = results.filter((r) => !r.error);
    const hits = ok.filter((r) => (r.contracts ?? 0) > 0);
    await fs.writeFile(
      OUT,
      JSON.stringify(
        {
          batch: 10, track: "money", kind: "company-contract-sweep",
          generatedAt: new Date().toISOString().slice(0, 10),
          source: "https://smlouvy.gov.cz/vyhledavani?party_idnum=<ico>&all_versions=0 (Registr smluv / ISRS, token-free)",
          note:
            "LEADS ONLY — no graph write. `party_idnum` matches EITHER contracting party, so a row means 'this " +
            "company appears in a published public contract', not 'this company was paid public money'; the " +
            "`publishers` breakdown is what direction must be read from. Registr smluv carries contracts published " +
            "from 2016 only, so a 0 for an entity dissolved or dormant before then is structural, not a finding. " +
            "An `error` row is an UNMEASURED company, never a zero.",
          counts: {
            attempted: results.length,
            answered: ok.length,
            failed: results.length - ok.length,
            withContracts: hits.length,
            byTieClass: ok.reduce<Record<string, { n: number; withContracts: number; czk: number }>>((a, r) => {
              const k = r.tieClass ?? r.reason;
              a[k] ??= { n: 0, withContracts: 0, czk: 0 };
              a[k].n++;
              if ((r.contracts ?? 0) > 0) a[k].withContracts++;
              a[k].czk += r.totalCzk;
              return a;
            }, {}),
          },
          results,
        },
        null, 2,
      ),
    );
  };

  let first = true;
  for (const c of queue) {
    if (!first) await sleep(delayMs);
    first = false;
    process.stdout.write(`  [${(c.bestTieClass ?? c.reason).padEnd(14)}] ${c.ico} ${c.label.slice(0, 40)} … `);
    const base = {
      id: c.id, label: c.label, ico: c.ico, tieClass: c.bestTieClass, mps: c.mps,
      corroborations: c.corroborations, reason: c.reason, checkedAt: new Date().toISOString().slice(0, 10),
    };
    try {
      const { rows, truncated } = await withBackoff(c.ico, () => client.fetchAllForIco(c.ico), [60_000, 120_000, 240_000]);
      const valued = rows.filter((r) => typeof r.valueCzk === "number");
      const dates = rows.map((r) => r.publishedOn).filter((d): d is string => Boolean(d)).sort();
      const byPub = new Map<string, { name: string; contracts: number; czk: number }>();
      for (const r of rows) {
        const e = byPub.get(r.publisher) ?? { name: r.publisher, contracts: 0, czk: 0 };
        e.contracts++;
        e.czk += r.valueCzk ?? 0;
        byPub.set(r.publisher, e);
      }
      results.push({
        ...base,
        contracts: rows.length, valuedContracts: valued.length, unvaluedContracts: rows.length - valued.length,
        totalCzk: valued.reduce((s, r) => s + (r.valueCzk ?? 0), 0),
        earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null, truncated,
        publishers: [...byPub.values()].sort((a, b) => b.czk - a.czk),
        topRows: [...valued].sort((a, b) => (b.valueCzk ?? 0) - (a.valueCzk ?? 0)).slice(0, 5),
        error: null,
      });
      const t = results[results.length - 1];
      console.log(`${t.contracts} contract(s), ${t.totalCzk.toLocaleString("cs-CZ")} CZK${truncated ? " [TRUNCATED]" : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        ...base, contracts: null, valuedContracts: 0, unvaluedContracts: 0, totalCzk: 0,
        earliest: null, latest: null, truncated: false, publishers: [], topRows: [], error: msg,
      });
      console.log(`QUERY FAILED (UNMEASURED, not zero) — ${msg.slice(0, 70)}`);
    }
    await persist(); // after EVERY company — a kill costs one query, not the run
  }

  const ok = results.filter((r) => !r.error);
  const hits = ok.filter((r) => (r.contracts ?? 0) > 0);
  console.log(`\n── HITS (${hits.length}/${ok.length} answered) ──`);
  for (const r of hits.sort((a, b) => b.totalCzk - a.totalCzk)) {
    console.log(`  [${r.tieClass ?? r.reason}] ${r.label} — ${r.contracts} contract(s), ${r.totalCzk.toLocaleString("cs-CZ")} CZK · MP: ${r.mps.join(", ")}`);
    for (const p of r.publishers.slice(0, 3)) console.log(`        payer: ${p.name} (${p.contracts}× , ${p.czk.toLocaleString("cs-CZ")} CZK)`);
  }
  const failed = results.filter((r) => r.error);
  if (failed.length) console.log(`\nUNMEASURED (query failed, never counted as zero): ${failed.length} — re-run with --resume`);
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
