/* Tender loop — scoped measurement over cached ISVZ months (durable tool).
 *
 * THE CALIBRATION STEP. The skill forbids importing thresholds from papers or other
 * markets: every flag's cut-off comes from the scoped corpus's own distribution, read by a
 * human, recorded in the batch note. This tool produces those distributions — it flags
 * NOTHING. It also reports fill rates, because a flag a field cannot support must not
 * exist (case gate c).
 *
 *   npx tsx scripts/case-loops/tender/measure.ts --cpv=45 [--months=VZ-06-2026,...]
 */
import { readdirSync, writeFileSync } from "node:fs";
import { parseIsvzMonth, type IsvzLot } from "@/lib/ingest/sources/isvz";

const RAW = "data/raw/isvz";
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");

function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const cpv = arg("cpv") ?? "45";
  const wanted = arg("months")?.split(",").map((m) => m.trim());
  const zipNames = readdirSync(RAW).filter((f) => /^VZ-\d{2}-\d{4}\.zip$/.test(f) && (!wanted || wanted.includes(f.replace(".zip", ""))));
  if (!zipNames.length) throw new Error(`no cached months in ${RAW}`);

  // adm-zip is not a dependency; the python fallback below is the real path.
  const AdmZip = null as { new (p: string): { getEntries(): { getData(): Buffer }[] } } | null;
  const lots: IsvzLot[] = [];
  const perMonth: Record<string, { lots: number; scoped: number; dropped: number }> = {};
  for (const zn of zipNames.sort()) {
    let json: unknown;
    if (AdmZip) {
      const z = new AdmZip(`${RAW}/${zn}`);
      json = JSON.parse(z.getEntries()[0].getData().toString("utf8"));
    } else {
      // no adm-zip in deps — shell out once per file (zips hold a single JSON entry)
      const { execFileSync } = await import("node:child_process");
      json = JSON.parse(
        execFileSync("python", ["-c", `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);sys.stdout.buffer.write(z.read(z.namelist()[0]))`, `${RAW}/${zn}`], { maxBuffer: 1 << 30 }).toString("utf8"),
      );
    }
    const m = parseIsvzMonth(json);
    const scoped = m.lots.filter((l) => l.cpvDivision === cpv);
    lots.push(...scoped);
    perMonth[zn.replace(".zip", "")] = { lots: m.lots.length, scoped: scoped.length, dropped: m.droppedLots };
  }

  const n = lots.length;
  const fill = (f: (l: IsvzLot) => unknown) => {
    const k = lots.filter((l) => f(l) != null).length;
    return `${k} (${Math.round((k * 100) / Math.max(n, 1))} %)`;
  };

  // distributions
  const bidCounts = lots.map((l) => l.bidCount).filter((x): x is number => x != null);
  const deadlines = lots.map((l) => l.deadlineDays).filter((x): x is number => x != null && x >= 0).sort((a, b) => a - b);
  const spreads = lots
    .filter((l) => l.lowestBidCzk != null && l.highestBidCzk != null && l.lowestBidCzk > 0 && (l.evaluatedBidCount ?? 0) >= 2)
    .map((l) => (l.highestBidCzk! - l.lowestBidCzk!) / l.lowestBidCzk!)
    .sort((a, b) => a - b);
  const estGaps = lots
    .filter((l) => l.estimatedCzkNoVat != null && l.estimatedCzkNoVat > 0 && l.lowestBidCzk != null)
    .map((l) => l.lowestBidCzk! / l.estimatedCzkNoVat!)
    .sort((a, b) => a - b);

  const byProc = new Map<string, { n: number; single: number }>();
  for (const l of lots) {
    if (l.bidCount == null) continue;
    const k = l.procedureType ?? "(neuvedeno)";
    const cur = byProc.get(k) ?? { n: 0, single: 0 };
    cur.n++;
    if (l.bidCount === 1) cur.single++;
    byProc.set(k, cur);
  }

  const authorities = new Map<string, { name: string; lots: number; singleBid: number; czk: number }>();
  const winners = new Map<string, { name: string; wins: number; authorities: Set<string> }>();
  for (const l of lots) {
    const a = l.authority?.ico;
    if (a) {
      const cur = authorities.get(a) ?? { name: l.authority!.name, lots: 0, singleBid: 0, czk: 0 };
      cur.lots++;
      if (l.bidCount === 1) cur.singleBid++;
      cur.czk += l.lowestBidCzk ?? l.estimatedCzkNoVat ?? 0;
      authorities.set(a, cur);
    }
    for (const w of l.winners) {
      const key = w.ico ?? `foreign:${w.foreignId ?? w.name}`;
      const cur = winners.get(key) ?? { name: w.name, wins: 0, authorities: new Set<string>() };
      cur.wins++;
      if (a) cur.authorities.add(a);
      winners.set(key, cur);
    }
  }

  const singles = bidCounts.filter((b) => b === 1).length;
  const report = {
    generatedFor: "tender loop — calibration measurement",
    generatedAt: new Date().toISOString().slice(0, 16),
    scope: { cpvDivision: cpv, months: Object.keys(perMonth) },
    perMonth,
    lots: n,
    fillRates: {
      authorityIco: fill((l) => l.authority?.ico),
      procedureType: fill((l) => l.procedureType),
      bidCount: fill((l) => l.bidCount),
      participants: `${lots.filter((l) => l.participants.length).length}`,
      winners: `${lots.filter((l) => l.winners.length).length}`,
      deadlineDays: fill((l) => l.deadlineDays),
      estimatedCzk: fill((l) => l.estimatedCzkNoVat),
      spreadComputable: spreads.length,
      resultKind: fill((l) => l.resultKind),
    },
    distributions: {
      bidCount: { n: bidCounts.length, single: singles, singleShare: bidCounts.length ? +(singles / bidCounts.length).toFixed(3) : null, p50: pct([...bidCounts].sort((a, b) => a - b), 50), p90: pct([...bidCounts].sort((a, b) => a - b), 90) },
      deadlineDays: { n: deadlines.length, p5: pct(deadlines, 5), p10: pct(deadlines, 10), p25: pct(deadlines, 25), p50: pct(deadlines, 50) },
      spreadRatio: { n: spreads.length, p5: pct(spreads, 5), p10: pct(spreads, 10), p25: pct(spreads, 25), p50: pct(spreads, 50) },
      lowestBidVsEstimate: { n: estGaps.length, p10: pct(estGaps, 10), p50: pct(estGaps, 50), p90: pct(estGaps, 90) },
    },
    singleBidByProcedure: Object.fromEntries([...byProc.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, { lots: v.n, single: v.single, share: +(v.single / v.n).toFixed(3) }])),
    topAuthorities: [...authorities.entries()].sort((a, b) => b[1].lots - a[1].lots).slice(0, 20).map(([ico, v]) => ({ ico, ...v })),
    topWinners: [...winners.entries()].sort((a, b) => b[1].wins - a[1].wins).slice(0, 20).map(([k, v]) => ({ key: k, name: v.name, wins: v.wins, distinctAuthorities: v.authorities.size })),
  };

  // EXPLICIT minute stamp — the first two attempts sliced the ISO string by index, both
  // truncated at the hour, two same-hour runs shared a name, and the case's very first
  // evidence file was overwritten and then tidied away. The money-batch-017–019 filename
  // lesson, paid for AGAIN because the stamp was arithmetic instead of explicit.
  const d = new Date();
  const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
  const out = `docs/data-analysis/case-tender/measure-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...report, topAuthorities: report.topAuthorities.slice(0, 8), topWinners: report.topWinners.slice(0, 8) }, null, 1).slice(0, 4200));
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
