/* Tender loop — deterministic red flags over the persisted tender corpus (durable).
 *
 * THE RULES (skill gates, all enforced here):
 *  • a flag is a REGISTER FACT restated, never a judgment — each carries its inputs;
 *  • thresholds come from the SCOPED CORPUS's own distribution, computed in this run and
 *    written into the payload + report (gate e: a threshold change re-runs everything);
 *  • a lot missing the field gets NO flag (absence ≠ zero — gate c);
 *  • fire rates are printed WITH SAMPLES for hand-reading BEFORE any persist (the kernel's
 *    guard-fire-rate rule); this script never writes the store — it emits a payload for
 *    persist-batch.
 *
 * FLAGS (b001 calibration, confirmed against the 7-month corpus in this run):
 *  single_bid       competitive procedure & bid_count === 1
 *  tight_spread     ≥2 evaluated bids & (highest−lowest)/lowest < corpus p10
 *  short_deadline   deadline_days < per-PROCEDURE-CLASS p10 (norms differ by procedure;
 *                   a class needs ≥ MIN_CLASS lots with a window to get a threshold)
 *  exceptional_procedure   JŘBU / přímé zadání — lawful instruments with legitimate uses;
 *                   the flag says „výjimečný postup", nothing more
 *
 * TRAILING-WINDOW FLAGS (b006 — need >= 12 months of corpus behind the window):
 *  repeat_winner    at award time, the same winner already took >= REPEAT_N (corpus p95)
 *                   dated wins from the SAME authority in the trailing 365 days
 *  supplier_lock    at award time, the winner already held a MAJORITY (>= LOCK_SHARE_MIN
 *                   = 0.5) of the authority's dated wins in the trailing 365 days,
 *                   authority window >= MIN_AUTH_WINS wins. NOT a corpus percentile: the
 *                   hand-read showed p90 = 0.125 fires on "3 wins of 23" — locks are tail
 *                   events, so a percentile lands in ordinary territory. 0.5 sits above
 *                   the corpus p99 (distribution disclosed in the report), and the flag
 *                   reads as what it says. Denominator is DATED wins only (disclosed in
 *                   inputs) — a poorly-dated authority could inflate the share, which the
 *                   MIN_AUTH_WINS floor and the majority bar keep tolerable.
 *  Both evaluate only wins whose full window sits inside corpus coverage
 *  (decided_on - 365 d >= COVERAGE_START — absence ≠ zero, gate c), only DATED wins
 *  (decided_on fills ~74 %), and SKIP monopoly counterparties (statutory single-source —
 *  see monopoly.ts; skipped wins are counted and disclosed, never silently dropped).
 *
 *   npx tsx scripts/case-loops/tender/compute-flags.ts --cpv=45 [--samples=8]
 *   npx tsx scripts/case-loops/persist-batch.ts --payload=<out> --pass=<n> --track=tender --ns=flags --commit
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { MONOPOLY_COUNTERPARTIES, isMonopolyCounterparty } from "./monopoly";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Procedures where competition is the design intent — single bid is an outlier there.
 *  JŘBU / přímé zadání are NOT here: their absence of competition is by construction and
 *  carries its own flag. Names verbatim from the register (b001 census). */
const COMPETITIVE = new Set([
  "Otevřené řízení",
  "Zjednodušené podlimitní řízení",
  "Užší řízení",
  "Otevřená výzva při zadávání veřejných zakázek malého rozsahu",
  "Jednací řízení s uveřejněním",
  "Postup s obnovením soutěže",
  "Zadávání VZ v dynamickém nákupním systému",
]);
/** ONLY JŘBU. The first run also flagged „přímé zadání … malého rozsahu" — 2 734 hits,
 *  and the hand-read showed why that is noise: below-limit direct award is a lawful,
 *  routine instrument (fence repairs, servicing), not an exception to competition. Its
 *  interesting statistic is VOLUME PER AUTHORITY, which is an authority-level view, not a
 *  per-lot flag. (The same hand-read confirmed tight_spread and single_bid honest.) */
const EXCEPTIONAL = new Set(["Jednací řízení bez uveřejnění"]);
const MIN_CLASS = 100; // a per-procedure deadline threshold needs at least this many windows
const WINDOW_DAYS = 365; // trailing window for repeat_winner / supplier_lock
const MIN_AUTH_WINS = 10; // supplier_lock needs this many dated authority wins in the window
const LOCK_SHARE_MIN = 0.5; // a lock is a MAJORITY of the window, not a percentile (see header)
const COVERAGE_START = "2024-12-01"; // first month with record-level RVZ coverage in the store

const pct = (sorted: number[], p: number): number | null =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null;

async function main() {
  const cpv = arg("cpv") ?? "45";
  const nSamples = Number(arg("samples") ?? 8);
  const stamp = `${new Date().toISOString().slice(0, 10)}-${String(new Date().getUTCHours()).padStart(2, "0")}${String(new Date().getUTCMinutes()).padStart(2, "0")}`;

  const store = await getStore();
  if (!store) throw new Error("no store");
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const winsEdges = await store.listKgEdges({ rel: "wins", limit: KG_READ_CAP });
  await store.close();
  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  console.log(`tenders in scope (CPV ${cpv}): ${scoped.length}`);

  // ── thresholds from THIS corpus ───────────────────────────────────────────────────────
  const spreads = scoped
    .map((t) => {
      const lo = num(t.props?.lowest_bid_czk);
      const hi = num(t.props?.highest_bid_czk);
      const ev = num(t.props?.evaluated_bid_count) ?? 0;
      return lo != null && hi != null && lo > 0 && ev >= 2 ? (hi - lo) / lo : null;
    })
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const SPREAD_P10 = pct(spreads, 10);

  const deadlineByProc = new Map<string, number[]>();
  for (const t of scoped) {
    const d = num(t.props?.deadline_days);
    const p = str(t.props?.procedure_type);
    if (d == null || d < 0 || !p) continue;
    deadlineByProc.set(p, [...(deadlineByProc.get(p) ?? []), d]);
  }
  // p5, competitive classes only. The first run used p10 across ALL classes and the
  // hand-read caught two defects: "30 days vs threshold 31" fired at the boundary of a
  // discrete distribution (noise), and deadlines were being flagged INSIDE JŘBU/přímé
  // zadání, whose short windows are the procedure's nature, not a signal.
  const DEADLINE_P5: Record<string, number> = {};
  for (const [p, arr0] of deadlineByProc) {
    if (arr0.length < MIN_CLASS || !COMPETITIVE.has(p)) continue;
    DEADLINE_P5[p] = pct(arr0.sort((a, b) => a - b), 5)!;
  }

  // ── trailing windows (per authority, dated wins only) ─────────────────────────────────
  const scopedIds = new Set(scoped.map((t) => t.id));
  const authorityByTender = new Map(scoped.map((t) => [t.id, str(t.props?.authority_ico)]));
  interface Win { lotId: string; winner: string; date: string }
  const winsByAuthority = new Map<string, Win[]>();
  let undatedWins = 0;
  for (const e of winsEdges) {
    if (!scopedIds.has(e.dst)) continue;
    const aIco = authorityByTender.get(e.dst);
    const date = str(e.props?.decided_on);
    if (!aIco) continue;
    if (!date) { undatedWins++; continue; }
    winsByAuthority.set(aIco, [...(winsByAuthority.get(aIco) ?? []), { lotId: e.dst, winner: e.src, date }]);
  }
  for (const arr of winsByAuthority.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1));

  const windowStartCutoff = new Date(new Date(COVERAGE_START).getTime() + WINDOW_DAYS * 86400e3).toISOString();
  interface TrailingEval { lotId: string; winner: string; authority: string; date: string; nAuth: number; nWinner: number; share: number }
  const evals: TrailingEval[] = [];
  let monopolySkipped = 0;
  for (const [aIco, arr] of winsByAuthority) {
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i];
      if (w.date < windowStartCutoff) continue; // window would reach before coverage — no flag possible
      if (isMonopolyCounterparty(w.winner)) { monopolySkipped++; continue; }
      const from = new Date(new Date(w.date.slice(0, 10)).getTime() - WINDOW_DAYS * 86400e3).toISOString();
      let nAuth = 0, nWinner = 0;
      for (let j = i - 1; j >= 0 && arr[j].date >= from; j--) {
        nAuth++;
        if (arr[j].winner === w.winner) nWinner++;
      }
      evals.push({ lotId: w.lotId, winner: w.winner, authority: aIco, date: w.date, nAuth, nWinner, share: nAuth > 0 ? nWinner / nAuth : 0 });
    }
  }
  const repeatCounts = evals.map((e) => e.nWinner).sort((a, b) => a - b);
  const lockShares = evals.filter((e) => e.nAuth >= MIN_AUTH_WINS).map((e) => e.share).sort((a, b) => a - b);
  const REPEAT_N = pct(repeatCounts, 95);
  const trailingByLot = new Map<string, TrailingEval[]>();
  for (const e of evals) trailingByLot.set(e.lotId, [...(trailingByLot.get(e.lotId) ?? []), e]);

  // ── flags ─────────────────────────────────────────────────────────────────────────────
  interface Flagged {
    id: string;
    name: string;
    flags: string[];
    inputs: Record<string, unknown>;
  }
  const flagged: Flagged[] = [];
  const counts = new Map<string, number>();
  const samples = new Map<string, Flagged[]>();

  for (const t of scoped) {
    const p = t.props ?? {};
    const proc = str(p.procedure_type);
    const bid = num(p.bid_count);
    const lo = num(p.lowest_bid_czk);
    const hi = num(p.highest_bid_czk);
    const ev = num(p.evaluated_bid_count) ?? 0;
    const dl = num(p.deadline_days);
    const flags: string[] = [];
    const inputs: Record<string, unknown> = {};

    if (proc && COMPETITIVE.has(proc) && bid === 1) {
      flags.push("single_bid");
      inputs.single_bid = { procedure: proc, bid_count: 1 };
    }
    if (proc && EXCEPTIONAL.has(proc)) {
      flags.push("exceptional_procedure");
      inputs.exceptional_procedure = { procedure: proc };
    }
    if (SPREAD_P10 != null && lo != null && hi != null && lo > 0 && ev >= 2) {
      const spread = (hi - lo) / lo;
      if (spread < SPREAD_P10) {
        flags.push("tight_spread");
        inputs.tight_spread = { lowest: lo, highest: hi, spread: +spread.toFixed(4), threshold_p10: +SPREAD_P10.toFixed(4) };
      }
    }
    if (proc && dl != null && DEADLINE_P5[proc] != null && dl < DEADLINE_P5[proc]) {
      flags.push("short_deadline");
      inputs.short_deadline = { deadline_days: dl, procedure: proc, threshold_p5: DEADLINE_P5[proc] };
    }
    for (const te of trailingByLot.get(t.id) ?? []) {
      if (REPEAT_N != null && REPEAT_N > 0 && te.nWinner >= REPEAT_N && !flags.includes("repeat_winner")) {
        flags.push("repeat_winner");
        inputs.repeat_winner = { winner: te.winner, prior_wins_365d: te.nWinner, threshold_p95: REPEAT_N, decided_on: te.date.slice(0, 10) };
      }
      if (te.nAuth >= MIN_AUTH_WINS && te.share >= LOCK_SHARE_MIN && !flags.includes("supplier_lock")) {
        flags.push("supplier_lock");
        inputs.supplier_lock = { winner: te.winner, authority_wins_365d: te.nAuth, winner_wins_365d: te.nWinner, share: +te.share.toFixed(3), threshold_min: LOCK_SHARE_MIN, dated_wins_only: true, decided_on: te.date.slice(0, 10) };
      }
    }

    if (!flags.length) continue;
    const f: Flagged = { id: t.id, name: t.label, flags, inputs };
    flagged.push(f);
    for (const fl of flags) {
      counts.set(fl, (counts.get(fl) ?? 0) + 1);
      const s = samples.get(fl) ?? [];
      if (s.length < nSamples) s.push(f);
      samples.set(fl, s);
    }
  }

  // ── payload (props-merge via persist-batch; nodes only) ──────────────────────────────
  const payload = {
    proposals: flagged.map((f) => ({
      id: f.id,
      props: { flags: f.flags, flag_inputs: f.inputs, flag_thresholds: { spread_p10: SPREAD_P10, deadline_p5_by_procedure: DEADLINE_P5, repeat_winner_p95: REPEAT_N, supplier_lock_share_min: LOCK_SHARE_MIN, window_days: WINDOW_DAYS, min_auth_wins: MIN_AUTH_WINS, coverage_start: COVERAGE_START } },
    })),
  };
  const out = `docs/data-analysis/case-tender/payloads/flags-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(payload) + "\n", "utf8");
  const report = {
    generatedFor: "tender loop — flag computation",
    generatedAt: stamp,
    scope: { cpv, tenders: scoped.length },
    thresholds: { SPREAD_P10, DEADLINE_P5, MIN_CLASS, REPEAT_N, LOCK_SHARE_MIN, WINDOW_DAYS, MIN_AUTH_WINS, COVERAGE_START },
    lockShareDistribution: { p50: pct(lockShares, 50), p75: pct(lockShares, 75), p90: pct(lockShares, 90), p95: pct(lockShares, 95), p99: pct(lockShares, 99), n: lockShares.length },
    trailingWindow: { evaluableWins: evals.length, undatedWinsExcluded: undatedWins, monopolySkipped, monopolyClass: Object.fromEntries(Object.entries(MONOPOLY_COUNTERPARTIES).map(([k, v]) => [k, v.name])) },
    fireRates: Object.fromEntries([...counts.entries()].map(([k, v]) => [k, { n: v, share: +(v / scoped.length).toFixed(4) }])),
    flaggedLots: flagged.length,
  };
  writeFileSync(`docs/data-analysis/case-tender/flags-report-cpv${cpv}-${stamp}.json`, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`\ntrailing window: ${evals.length} evaluable wins (dated, window inside coverage) / ${undatedWins} undated excluded / ${monopolySkipped} monopoly-counterparty skipped`);
  console.log(`  repeat distribution (prior wins, same authority, 365 d): p50=${pct(repeatCounts, 50)} p75=${pct(repeatCounts, 75)} p90=${pct(repeatCounts, 90)} p95=${REPEAT_N} p99=${pct(repeatCounts, 99)}`);
  console.log(`  lock-share distribution (nAuth >= ${MIN_AUTH_WINS}, n=${lockShares.length}): p50=${pct(lockShares, 50)?.toFixed(2)} p75=${pct(lockShares, 75)?.toFixed(2)} p90=${pct(lockShares, 90)?.toFixed(2)} p95=${pct(lockShares, 95)?.toFixed(2)} p99=${pct(lockShares, 99)?.toFixed(2)} -> LOCK_SHARE_MIN=${LOCK_SHARE_MIN}`);
  console.log(`\nthresholds: spread p10 = ${SPREAD_P10?.toFixed(4)} · deadline p5 (competitive classes):`);
  for (const [k, v] of Object.entries(DEADLINE_P5)) console.log(`   ${String(v).padStart(3)} d  ${k}`);
  console.log(`\nfire rates over ${scoped.length} lots:`);
  for (const [k, v] of counts) console.log(`   ${k.padEnd(24)} ${String(v).padStart(6)}  (${((v * 100) / scoped.length).toFixed(1)} %)`);
  console.log(`\nSAMPLES — READ THESE BY HAND BEFORE PERSISTING:`);
  for (const [fl, ss] of samples) {
    console.log(`\n== ${fl} ==`);
    for (const s of ss) console.log(`   ${s.id}  ${s.name.slice(0, 70)}  ${JSON.stringify(s.inputs[fl] ?? {})}`);
  }
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
