/* Tender loop — DEEP-READ case file for one authority or one winner (durable).
 *
 * The doctrine's manual step made repeatable: pull every scoped lot touching one subject
 * out of the store, lay it out as a readable case file (cadence, procedure mix, winner or
 * authority table, flag mix, the flagged lots verbatim), and dump the lot labels + inputs
 * for hand-reading. Evidence JSON out; prints the file; NO store writes and NO judgments —
 * the reader judges, the tool only arranges the register's own numbers.
 *
 *   npx tsx scripts/case-loops/tender/deep-read.ts --authority=00297488 [--cpv=45]
 *   npx tsx scripts/case-loops/tender/deep-read.ts --winner=27805425   [--cpv=45]
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

async function main() {
  const cpv = arg("cpv") ?? "45";
  const authority = arg("authority");
  const winner = arg("winner");
  if (!authority && !winner) throw new Error("pass --authority=<ico> or --winner=<ico>");
  const subjectIco = (authority ?? winner)!;
  const mode = authority ? "authority" : "winner";
  const d = new Date();
  const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;

  const store = await getStore();
  if (!store) throw new Error("no store");
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const wins = await store.listKgEdges({ rel: "wins", limit: KG_READ_CAP });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));
  const label = (id: string) => byId.get(id)?.label ?? id;
  const subjectId = `company:ico:${subjectIco}`;

  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  const winsByTender = new Map<string, string[]>();
  for (const e of wins) winsByTender.set(e.dst, [...(winsByTender.get(e.dst) ?? []), e.src]);
  const decidedByTender = new Map<string, string>();
  for (const e of wins) {
    const d0 = str(e.props?.decided_on);
    if (d0) decidedByTender.set(e.dst, d0);
  }

  const lots = scoped.filter((t) =>
    mode === "authority" ? str(t.props?.authority_ico) === subjectIco : (winsByTender.get(t.id) ?? []).includes(subjectId),
  );
  if (!lots.length) throw new Error(`no scoped lots for ${mode} ${subjectIco}`);

  // ── cadence + mixes ─────────────────────────────────────────────────────────────────────
  // month: lhůta end, else procedure start, else the win decision date — else honest absence
  // (Havířov's výzva lots carry NO endedOn at all; the first run's cadence was one bucket)
  const monthOf = (t: (typeof lots)[number]) =>
    (str(t.props?.endedOn) ?? str(t.props?.startedOn) ?? decidedByTender.get(t.id))?.slice(0, 7) ?? "bez data";
  const cadence = new Map<string, number>();
  const procMix = new Map<string, number>();
  const flagMix = new Map<string, number>();
  const counterparty = new Map<string, { n: number; czk: number }>();
  let czkFloor = 0;
  let flaggedLots = 0;
  for (const t of lots) {
    const p = t.props ?? {};
    cadence.set(monthOf(t), (cadence.get(monthOf(t)) ?? 0) + 1);
    const proc = str(p.procedure_type) ?? "neuvedeno";
    procMix.set(proc, (procMix.get(proc) ?? 0) + 1);
    const czk = num(p.lowest_bid_czk) ?? num(p.estimated_czk_no_vat) ?? 0;
    czkFloor += czk;
    const flags = Array.isArray(p.flags) ? (p.flags as string[]) : [];
    if (flags.length) flaggedLots++;
    for (const f of flags) flagMix.set(f, (flagMix.get(f) ?? 0) + 1);
    const others = mode === "authority" ? (winsByTender.get(t.id) ?? []) : [`company:ico:${str(p.authority_ico) ?? "?"}`];
    for (const o of others) {
      const c = counterparty.get(o) ?? { n: 0, czk: 0 };
      c.n++;
      c.czk += czk;
      counterparty.set(o, c);
    }
  }

  // ── the flagged lots, verbatim, for the hand-read ──────────────────────────────────────
  const flagged = lots
    .filter((t) => Array.isArray(t.props?.flags) && (t.props!.flags as string[]).length)
    .map((t) => ({
      id: t.id,
      label: t.label,
      month: monthOf(t),
      procedure: str(t.props?.procedure_type),
      czk: num(t.props?.lowest_bid_czk),
      // the register's own bid_count — NOT a count of bids_on edges: anonymised losing
      // bidders (the b002 `unidentified` class) carry no edges, so edges undercount
      bidCount: num(t.props?.bid_count),
      winners: (winsByTender.get(t.id) ?? []).map(label),
      flags: t.props!.flags as string[],
      inputs: t.props!.flag_inputs ?? {},
      source: str(t.props?.source),
    }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  const top = [...counterparty.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20);
  const evid = {
    generatedFor: `tender loop — deep-read case file (${mode})`,
    generatedAt: stamp,
    subject: { ico: subjectIco, name: label(subjectId), mode },
    scope: { cpv, lots: lots.length, czkFloor, flaggedLots, source: "ISVZ RVZ open data, record-level 2024-12 → 2026-07" },
    cadenceByMonth: Object.fromEntries([...cadence.entries()].sort()),
    procedureMix: Object.fromEntries([...procMix.entries()].sort((a, b) => b[1] - a[1])),
    flagMix: Object.fromEntries([...flagMix.entries()].sort((a, b) => b[1] - a[1])),
    counterparties: top.map(([id, c]) => ({ id, name: label(id), lots: c.n, czkFloor: c.czk })),
    flaggedLots: flagged,
  };
  const out = `docs/data-analysis/case-tender/deep-read-${mode}-${subjectIco}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(evid, null, 2) + "\n", "utf8");

  const czkM = (n: number) => `${(n / 1e6).toFixed(1)} M`;
  console.log(`CASE FILE — ${mode.toUpperCase()} ${label(subjectId)} (IČO ${subjectIco}) · CPV ${cpv}`);
  console.log(`${lots.length} lots · CZK floor ${czkM(czkFloor)} · ${flaggedLots} flagged (${((100 * flaggedLots) / lots.length).toFixed(0)} %)\n`);
  console.log(`cadence: ${[...cadence.entries()].sort().map(([m, n]) => `${m}:${n}`).join("  ")}\n`);
  console.log(`procedures:`);
  for (const [p, n] of [...procMix.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${p}`);
  console.log(`\nflags:`);
  for (const [f, n] of [...flagMix.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${f}`);
  console.log(`\ntop ${mode === "authority" ? "winners" : "authorities"}:`);
  for (const [id, c] of top.slice(0, 12)) console.log(`  ${String(c.n).padStart(4)} lots  ${czkM(c.czk).padStart(9)}  ${label(id).slice(0, 56)}`);
  console.log(`\n-> ${out}  (${flagged.length} flagged lots inside, verbatim — read them)`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
