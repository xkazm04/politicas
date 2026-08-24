/* Tender loop — bidder-POOL statistic per authority (KEPT AS A NEGATIVE RESULT — b009).
 *
 * THE STATISTIC FAILED ITS HAND-READ, twice over (evidence pool-stat-cpv45-*.json):
 *  1. 176 of 186 measured authorities fall below MIN_IDENTIFIED_SHARE — the register
 *     anonymises losing bidders (b002), so the pool is INVISIBLE for ~95 % of buyers,
 *     Havířov and Moravská galerie included. A statistic whose denominator does not exist
 *     for the population it targets is not a marker.
 *  2. avg_appearances confounds VOLUME with CLOSURE: ŘSD "tops" the closed-pool list with
 *     1 002 distinct bidders (DNS minitender machine) — the opposite of a closed pool.
 * The payload is therefore never persisted. The rotation species' marker must be built
 * from WINNER sequences (identified, dated) instead — see winner-circle in b010.
 *
 * Original intent (b008's rotation marker):
 *
 * The rotation species (Moravská galerie, b008): the SAME handful of bidders on every
 * micro-lot, wins alternating inside the pool. Its deterministic, authority-level marker:
 * how concentrated is the set of IDENTIFIED bidders across an authority's lots?
 *
 *   avg_appearances   identified bid entries / distinct identified bidders — a diverse
 *                     market sits near 1–2; a closed pool climbs with every lot
 *   top5_share        share of identified entries by the authority's 5 most frequent bidders
 *   identified_share  identified entries / all bid entries — the DENOMINATOR'S honesty:
 *                     the register anonymises losing bidders (b002), so a low share means
 *                     the pool is mostly invisible and the statistic must not be read
 *
 * AUTHORITY-level, not a lot flag (the estimate_gap doctrine, b001): a pool is a property
 * of the buyer's practice, not of one tender. This script measures and prints — the top
 * of the distribution gets hand-read BEFORE any persist (kernel rule); the payload it
 * emits (props-merge onto the authority's company node, ns=pool) is only committed after
 * that read.
 *
 *   npx tsx scripts/case-loops/tender/pool-stat.ts --cpv=45
 *   npx tsx scripts/case-loops/persist-batch.ts --payload=<out> --pass=<n> --track=tender --ns=pool --commit
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const MIN_LOTS = 20; // same floor as compose-pictures — a pool needs volume to be a pool
const MIN_IDENTIFIED = 50; // and enough identified entries for the ratio to mean anything
const MIN_IDENTIFIED_SHARE = 0.5; // below this, the pool is mostly anonymised — do not read

async function main() {
  const cpv = arg("cpv") ?? "45";
  const d = new Date();
  const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;

  const store = await getStore();
  if (!store) throw new Error("no store");
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const bids = await store.listKgEdges({ rel: "bids_on", limit: KG_READ_CAP });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));
  const label = (id: string) => byId.get(id)?.label ?? id;
  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  const authorityByTender = new Map(scoped.map((t) => [t.id, str(t.props?.authority_ico)]));

  interface Pool {
    ico: string;
    lots: Set<string>;
    entriesIdentified: number;
    entriesTotal: number; // identified + register-declared bid_count where larger
    byBidder: Map<string, number>;
  }
  const pools = new Map<string, Pool>();
  // register-declared bid counts (include anonymised bidders) — the honest denominator
  const declared = new Map<string, number>();
  for (const t of scoped) {
    const a = authorityByTender.get(t.id);
    if (!a) continue;
    declared.set(a, (declared.get(a) ?? 0) + (num(t.props?.bid_count) ?? 0));
  }
  for (const e of bids) {
    const a = authorityByTender.get(e.dst);
    if (!a) continue;
    const p = pools.get(a) ?? { ico: a, lots: new Set(), entriesIdentified: 0, entriesTotal: 0, byBidder: new Map() };
    p.lots.add(e.dst);
    p.entriesIdentified++;
    p.byBidder.set(e.src, (p.byBidder.get(e.src) ?? 0) + 1);
    pools.set(a, p);
  }

  const rows = [...pools.values()]
    .filter((p) => p.lots.size >= MIN_LOTS && p.entriesIdentified >= MIN_IDENTIFIED)
    .map((p) => {
      const declaredN = Math.max(declared.get(p.ico) ?? 0, p.entriesIdentified);
      const distinct = p.byBidder.size;
      const top5 = [...p.byBidder.values()].sort((a, b) => b - a).slice(0, 5).reduce((s, n) => s + n, 0);
      return {
        ico: p.ico,
        name: label(`company:ico:${p.ico}`),
        lots: p.lots.size,
        entriesIdentified: p.entriesIdentified,
        distinctBidders: distinct,
        avgAppearances: +(p.entriesIdentified / distinct).toFixed(2),
        top5Share: +(top5 / p.entriesIdentified).toFixed(3),
        identifiedShare: +(p.entriesIdentified / declaredN).toFixed(3),
        topBidders: [...p.byBidder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ id, name: label(id), entries: n })),
      };
    });
  const readable = rows.filter((r) => r.identifiedShare >= MIN_IDENTIFIED_SHARE);
  const unreadable = rows.length - readable.length;
  readable.sort((a, b) => b.avgAppearances - a.avgAppearances);

  const evid = {
    generatedFor: "tender loop — bidder-pool statistic per authority",
    generatedAt: stamp,
    scope: { cpv, authoritiesMeasured: rows.length, readable: readable.length, unreadableLowIdentifiedShare: unreadable, MIN_LOTS, MIN_IDENTIFIED, MIN_IDENTIFIED_SHARE },
    authorities: readable,
  };
  writeFileSync(`docs/data-analysis/case-tender/pool-stat-cpv${cpv}-${stamp}.json`, JSON.stringify(evid, null, 2) + "\n", "utf8");

  const payload = {
    proposals: readable.map((r) => ({
      id: `company:ico:${r.ico}`,
      props: {
        tender_pool: {
          cpv_division: cpv,
          lots: r.lots,
          entries_identified: r.entriesIdentified,
          distinct_bidders: r.distinctBidders,
          avg_appearances: r.avgAppearances,
          top5_share: r.top5Share,
          identified_share: r.identifiedShare,
          source: "ISVZ RVZ open data, record-level 2024-12 → 2026-07",
        },
      },
    })),
  };
  const out = `docs/data-analysis/case-tender/payloads/pool-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(payload) + "\n", "utf8");

  console.log(`authorities ≥${MIN_LOTS} lots & ≥${MIN_IDENTIFIED} identified entries: ${rows.length} · readable (identified ≥ ${MIN_IDENTIFIED_SHARE}): ${readable.length} · anonymised-out: ${unreadable}\n`);
  console.log(`TOP avg_appearances (closed pools) — READ BY HAND BEFORE PERSISTING:`);
  for (const r of readable.slice(0, 12))
    console.log(`  ${String(r.avgAppearances).padStart(6)}×  top5 ${(100 * r.top5Share).toFixed(0).padStart(3)} %  ${String(r.lots).padStart(4)} lots  ${String(r.distinctBidders).padStart(4)} bidders  id.${(100 * r.identifiedShare).toFixed(0).padStart(3)} %  ${r.name.slice(0, 40)}`);
  console.log(`\nBOTTOM (diverse markets, the contrast):`);
  for (const r of readable.slice(-5))
    console.log(`  ${String(r.avgAppearances).padStart(6)}×  top5 ${(100 * r.top5Share).toFixed(0).padStart(3)} %  ${String(r.lots).padStart(4)} lots  ${String(r.distinctBidders).padStart(4)} bidders  ${r.name.slice(0, 40)}`);
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
