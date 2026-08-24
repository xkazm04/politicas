/* Tender loop — WINNER-CIRCLE statistic per authority (durable; b010).
 *
 * The rotation species' marker rebuilt on data the register actually shows (b009 killed
 * the bidder-pool version: losing bidders are anonymised for ~95 % of authorities).
 * Winners are always identified and 74 % dated, so the sequence of an authority's dated
 * wins is readable. Per authority:
 *
 *   circle3_share   share of dated wins taken by the 3 most frequent winners
 *   distinct        distinct winners across the dated sequence
 *   switch_rate     fraction of consecutive win pairs INSIDE the circle where the winner
 *                   changes — separates ROTATION (high circle share, winners alternating)
 *                   from LOCK (one winner, few switches). Both are shapes; the label the
 *                   reader sees states the numbers, never intent.
 *
 * AUTHORITY-level statistic (estimate_gap doctrine). Measures and prints with samples;
 * the payload (props-merge onto the authority company node, ns=circle) is persisted only
 * after the printed top survives a hand-read. Floors disclosed; dated wins only,
 * disclosed (a poorly-dated authority simply is not measured — absence ≠ zero).
 *
 *   npx tsx scripts/case-loops/tender/winner-circle.ts --cpv=45
 *   npx tsx scripts/case-loops/persist-batch.ts --payload=<out> --pass=<n> --track=tender --ns=circle --commit
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { isMonopolyCounterparty } from "./monopoly";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const MIN_DATED_WINS = 20; // a circle needs a sequence, not an anecdote

async function main() {
  const cpv = arg("cpv") ?? "45";
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
  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  const authorityByTender = new Map(scoped.map((t) => [t.id, str(t.props?.authority_ico)]));

  const seqByAuthority = new Map<string, { winner: string; date: string }[]>();
  let undated = 0;
  for (const e of wins) {
    const a = authorityByTender.get(e.dst);
    if (!a) continue;
    const date = str(e.props?.decided_on);
    if (!date) { undated++; continue; }
    if (isMonopolyCounterparty(e.src)) continue; // statutory single-source — not a circle
    seqByAuthority.set(a, [...(seqByAuthority.get(a) ?? []), { winner: e.src, date }]);
  }

  interface Circle {
    ico: string;
    name: string;
    datedWins: number;
    distinct: number;
    circle3: { id: string; name: string; wins: number }[];
    circle3Share: number;
    switchRate: number; // over consecutive pairs inside the circle
  }
  const rows: Circle[] = [];
  for (const [a, seq0] of seqByAuthority) {
    if (seq0.length < MIN_DATED_WINS) continue;
    const seq = [...seq0].sort((x, y) => (x.date < y.date ? -1 : 1));
    const counts = new Map<string, number>();
    for (const w of seq) counts.set(w.winner, (counts.get(w.winner) ?? 0) + 1);
    const top3 = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
    const circleIds = new Set(top3.map(([id]) => id));
    const inCircle = seq.filter((w) => circleIds.has(w.winner));
    let switches = 0;
    for (let i = 1; i < inCircle.length; i++) if (inCircle[i].winner !== inCircle[i - 1].winner) switches++;
    rows.push({
      ico: a,
      name: label(`company:ico:${a}`),
      datedWins: seq.length,
      distinct: counts.size,
      circle3: top3.map(([id, n]) => ({ id, name: label(id), wins: n })),
      circle3Share: +(inCircle.length / seq.length).toFixed(3),
      switchRate: inCircle.length > 1 ? +(switches / (inCircle.length - 1)).toFixed(3) : 0,
    });
  }

  const shares = rows.map((r) => r.circle3Share).sort((a, b) => a - b);
  const pct = (p: number) => shares[Math.min(shares.length - 1, Math.floor((p / 100) * shares.length))];
  rows.sort((a, b) => b.circle3Share - a.circle3Share);

  const evid = {
    generatedFor: "tender loop — winner-circle statistic per authority",
    generatedAt: stamp,
    scope: { cpv, authoritiesMeasured: rows.length, undatedWinsExcluded: undated, MIN_DATED_WINS, datedWinsOnly: true, monopolyCounterpartiesSkipped: true },
    circle3ShareDistribution: { p50: pct(50), p75: pct(75), p90: pct(90), p95: pct(95) },
    authorities: rows,
  };
  writeFileSync(`docs/data-analysis/case-tender/winner-circle-cpv${cpv}-${stamp}.json`, JSON.stringify(evid, null, 2) + "\n", "utf8");

  const payload = {
    proposals: rows.map((r) => ({
      id: `company:ico:${r.ico}`,
      props: {
        tender_winner_circle: {
          cpv_division: cpv,
          dated_wins: r.datedWins,
          distinct_winners: r.distinct,
          circle3_share: r.circle3Share,
          switch_rate: r.switchRate,
          circle3: r.circle3.map((c) => ({ ico: c.id.slice("company:ico:".length), name: c.name, wins: c.wins })),
          dated_wins_only: true,
          source: "ISVZ RVZ open data, record-level 2024-12 → 2026-07",
        },
      },
    })),
  };
  const out = `docs/data-analysis/case-tender/payloads/circle-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(payload) + "\n", "utf8");

  console.log(`authorities with ≥${MIN_DATED_WINS} dated wins: ${rows.length} (undated wins excluded: ${undated})`);
  console.log(`circle3_share distribution: p50=${pct(50)} p75=${pct(75)} p90=${pct(90)} p95=${pct(95)}\n`);
  console.log(`TOP circle3_share — READ BY HAND BEFORE PERSISTING:`);
  for (const r of rows.slice(0, 12))
    console.log(
      `  ${(100 * r.circle3Share).toFixed(0).padStart(4)} %  switch ${(100 * r.switchRate).toFixed(0).padStart(3)} %  ${String(r.datedWins).padStart(4)} wins  ${String(r.distinct).padStart(3)} distinct  ${r.name.slice(0, 34)}  [${r.circle3.map((c) => `${c.name.slice(0, 18)}:${c.wins}`).join(" · ")}]`,
    );
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
