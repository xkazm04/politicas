/* Money loop — batch 011: sweep AGROFERT's public contracts against the ownership windows.
 *
 * WHY THIS ONE COMPANY. The obchodní rejstřík records Ing. Andrej Babiš as the registered
 * **jediný akcionář** (sole shareholder — § 48 odst. 1 písm. k) zák. č. 304/2013 Sb.) of
 * AGROFERT, a.s. from 2025-10-15 to 2026-02-20, and psp.cz records him as **předseda
 * vlády from 2025-12-09**. The conflict-of-interest bars in §§ 4b/4c zák. č. 159/2006 Sb.
 * attach to a *člen vlády* whose company he controls at ≥ 25 % — not to an MP. So the
 * question this sweep asks is narrow and legally shaped:
 *
 *   Which public contracts involving AGROFERT were PUBLISHED during the window in which
 *   the register recorded a sole shareholder who was simultaneously a member of
 *   government?
 *
 * WHAT THIS IS NOT. `party_idnum` matches the NON-PUBLISHING party (batch-011 verification
 * corrected an earlier claim that it matched either side), so a row means "the company was a
 * counterparty to a published contract", not "the company was awarded public money".
 * DIRECTION IS NOT ENCODED IN THE SEARCH ROW AT ALL — only a minority of contracts carry an
 * explicit Plátce/Příjemce label, and it is on the detail page, not in the table. A row can
 * just as easily be the company PAYING the state (batch 011 found exactly that: a prison-labour
 * amendment where Kostelecké uzeniny pays Vězeňská služba). Direction must be read per contract
 * from the underlying document before any row is described as public money received. A published date is not an award
 * date. And the register does not establish when the shares were ACQUIRED (the akcionář
 * entries carry an empty `clenstvi`), so the window is a REGISTRATION window, not an
 * ownership window. Nothing here is a finding of illegality; §§ 4b/4c has its own
 * definitions, exemptions and enforcement path, and this loop does not adjudicate them.
 *
 * Every row is a LEAD. No graph write.
 *
 *   npx tsx scripts/case-loops/money/agrofert-sweep.ts                # AGROFERT a.s. only
 *   npx tsx scripts/case-loops/money/agrofert-sweep.ts --group        # + graphed group companies
 *   npx tsx scripts/case-loops/money/agrofert-sweep.ts --delay=45000 --max-pages=60
 */
import { SmlouvyClient, type SmlouvyRow } from "@/lib/ingest/sources/smlouvy";

const OUT = "docs/data-analysis/case-money/qmoney-agrofert-sweep-b11.json";
const flag = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Registered sole-shareholder window (registry entry/deletion dates, NOT acquisition). */
const SOLE_SHAREHOLDER_FROM = "2025-10-15";
const SOLE_SHAREHOLDER_TO = "2026-02-20";
/** Member-of-government window — the status §§ 4b/4c actually attach to. */
const PM_FROM = "2025-12-09";

/** AGROFERT, a.s. plus the group companies the graph already carries. Kept explicit:
 *  an IČO list is an accusatory surface, so it is never pattern-matched at runtime. */
const TARGETS: { ico: string; label: string; role: string }[] = [
  { ico: "26185610", label: "AGROFERT, a.s.", role: "the company under the registered sole shareholding" },
  { ico: "26124459", label: "IMOBA, a.s.", role: "graphed group company" },
  { ico: "26014343", label: "SynBiol, a.s.", role: "graphed group company" },
  { ico: "26872307", label: "PRECHEZA a.s.", role: "graphed group company" },
  { ico: "27465021", label: "Fatra, a.s.", role: "graphed group company" },
  { ico: "49100262", label: "Lovochemie, a.s.", role: "graphed group company" },
  { ico: "60108916", label: "Synthesia, a.s.", role: "graphed group company" },
  { ico: "46900411", label: "Kostelecké uzeniny a.s.", role: "graphed group company" },
  { ico: "00011835", label: "DEZA, a.s.", role: "graphed group company" },
];

interface Bucket { contracts: number; valued: number; czk: number }
const emptyBucket = (): Bucket => ({ contracts: 0, valued: 0, czk: 0 });
function add(b: Bucket, r: SmlouvyRow) {
  b.contracts++;
  if (typeof r.valueCzk === "number") {
    b.valued++;
    b.czk += r.valueCzk;
  }
}

async function withBackoff<T>(label: string, run: () => Promise<T>, waits: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /→ (?:429|5\d\d) /.test(msg) || msg.includes("fetch failed");
      if (!retryable || attempt >= waits.length) throw e;
      console.log(`\n      rate-limited on ${label} — backing off ${waits[attempt] / 1000}s (${attempt + 1}/${waits.length})`);
      await sleep(waits[attempt]);
    }
  }
}

async function main() {
  const fs = await import("node:fs/promises");
  const targets = flag("group") ? TARGETS : TARGETS.slice(0, 1);
  const delayMs = Number(arg("delay") ?? 40_000);
  const maxPages = Number(arg("max-pages") ?? 60);

  console.log(`AGROFERT contract sweep · ${targets.length} target(s) · pacing ${delayMs / 1000}s · maxPages ${maxPages}`);
  console.log(`registered sole-shareholder window: ${SOLE_SHAREHOLDER_FROM} → ${SOLE_SHAREHOLDER_TO} (registration dates, not acquisition)`);
  console.log(`member-of-government from: ${PM_FROM}\n`);

  interface Result {
    ico: string; label: string; role: string;
    contracts: number | null; truncated: boolean; error: string | null;
    earliest: string | null; latest: string | null;
    all: Bucket; inSoleShareholderWindow: Bucket; inPmOverlap: Bucket;
    windowRows: SmlouvyRow[];
    topPublishersInWindow: { name: string; contracts: number; czk: number }[];
    checkedAt: string;
  }
  const results: Result[] = [];
  const client = new SmlouvyClient();

  const persist = async () =>
    fs.writeFile(
      OUT,
      JSON.stringify(
        {
          batch: 11, track: "money", kind: "agrofert-contract-sweep",
          generatedAt: new Date().toISOString().slice(0, 10),
          source: "https://smlouvy.gov.cz/vyhledavani?party_idnum=<ico>&all_versions=0 (Registr smluv / ISRS, token-free)",
          windows: {
            registeredSoleShareholder: { from: SOLE_SHAREHOLDER_FROM, to: SOLE_SHAREHOLDER_TO },
            memberOfGovernmentFrom: PM_FROM,
            caveat:
              "These are REGISTRATION dates from the obchodní rejstřík (datumZapisu/datumVymazu). The akcionář " +
              "entries carry an empty `clenstvi`, so the register does not establish when the shares were acquired. " +
              "A contract's `publishedOn` is a PUBLICATION date, not an award or signature date — the two can differ " +
              "by months, and Registr smluv requires publication within 30 days of conclusion for most contracts.",
          },
          note:
            "LEADS ONLY — no graph write, no finding of illegality. `party_idnum` matches the NON-PUBLISHING party, " +
            "so a row means AGROFERT appears in a published contract, not that it was awarded public money; read " +
            "direction from the publisher. §§ 4b/4c zák. č. 159/2006 Sb. attach to a member of government whose " +
            "company he controls at >=25%, and have their own definitions, exemptions and enforcement path which " +
            "this loop does not adjudicate.",
          results,
        },
        null, 2,
      ),
    );

  let first = true;
  for (const t of targets) {
    if (!first) await sleep(delayMs);
    first = false;
    process.stdout.write(`  ${t.ico} ${t.label.padEnd(26)} … `);
    try {
      const { rows, truncated } = await withBackoff(t.ico, () => client.fetchAllForIco(t.ico, { maxPages }), [90_000, 180_000, 300_000]);
      const all = emptyBucket();
      const win = emptyBucket();
      const pm = emptyBucket();
      const windowRows: SmlouvyRow[] = [];
      const pubs = new Map<string, { name: string; contracts: number; czk: number }>();
      const dates: string[] = [];
      for (const r of rows) {
        add(all, r);
        if (r.publishedOn) dates.push(r.publishedOn);
        const d = r.publishedOn;
        if (d && d >= SOLE_SHAREHOLDER_FROM && d <= SOLE_SHAREHOLDER_TO) {
          add(win, r);
          windowRows.push(r);
          const e = pubs.get(r.publisher) ?? { name: r.publisher, contracts: 0, czk: 0 };
          e.contracts++;
          e.czk += r.valueCzk ?? 0;
          pubs.set(r.publisher, e);
          if (d >= PM_FROM) add(pm, r);
        }
      }
      dates.sort();
      results.push({
        ico: t.ico, label: t.label, role: t.role,
        contracts: rows.length, truncated, error: null,
        earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null,
        all, inSoleShareholderWindow: win, inPmOverlap: pm,
        windowRows: windowRows.sort((a, b) => (b.valueCzk ?? 0) - (a.valueCzk ?? 0)),
        topPublishersInWindow: [...pubs.values()].sort((a, b) => b.czk - a.czk),
        checkedAt: new Date().toISOString().slice(0, 10),
      });
      console.log(
        `${rows.length} contract(s) total${truncated ? " [TRUNCATED — raise --max-pages]" : ""}, ` +
          `${win.contracts} in the registered window (${win.czk.toLocaleString("cs-CZ")} CZK), ${pm.contracts} of those from ${PM_FROM}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        ico: t.ico, label: t.label, role: t.role, contracts: null, truncated: false, error: msg,
        earliest: null, latest: null, all: emptyBucket(), inSoleShareholderWindow: emptyBucket(),
        inPmOverlap: emptyBucket(), windowRows: [], topPublishersInWindow: [],
        checkedAt: new Date().toISOString().slice(0, 10),
      });
      console.log(`QUERY FAILED (UNMEASURED, not zero) — ${msg.slice(0, 70)}`);
    }
    await persist();
  }

  console.log(`\n── CONTRACTS PUBLISHED IN THE REGISTERED SOLE-SHAREHOLDER WINDOW ──`);
  for (const r of results.filter((x) => !x.error && x.inSoleShareholderWindow.contracts > 0)) {
    console.log(`\n  ${r.label} — ${r.inSoleShareholderWindow.contracts} contract(s), ${r.inSoleShareholderWindow.czk.toLocaleString("cs-CZ")} CZK stated` +
      ` (of ${r.all.contracts} total; ${r.inPmOverlap.contracts} published from ${PM_FROM})`);
    for (const p of r.topPublishersInWindow.slice(0, 8)) {
      console.log(`      ${p.name} — ${p.contracts}×, ${p.czk.toLocaleString("cs-CZ")} CZK`);
    }
    for (const w of r.windowRows.slice(0, 5)) {
      console.log(`      · ${w.publishedOn} ${(w.valueCzk ?? 0).toLocaleString("cs-CZ")} CZK — ${w.subject.slice(0, 80)} [${w.publisher.slice(0, 40)}]`);
    }
  }
  const failed = results.filter((r) => r.error);
  if (failed.length) console.log(`\nUNMEASURED (never counted as zero): ${failed.map((f) => f.label).join(", ")}`);
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
