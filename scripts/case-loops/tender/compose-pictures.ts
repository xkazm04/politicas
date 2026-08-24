/* Tender loop — compose authority and winner PICTURES from the flagged corpus (durable).
 *
 * The doctrine step: single tenders are needles; the picture is the shape they compose
 * per AUTHORITY (how does this buyer behave?) and per WINNER (how does this supplier
 * win?). Deterministic aggregation, no LLM, no store writes — evidence out, and the top
 * shapes printed for reading. Small-n floors everywhere: a percentage computed on three
 * lots is not a picture, it is noise wearing one (MIN_LOTS / MIN_WINS below, disclosed).
 *
 *   npx tsx scripts/case-loops/tender/compose-pictures.ts --cpv=45
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { MONOPOLY_COUNTERPARTIES, isMonopolyCounterparty } from "./monopoly";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const MIN_LOTS = 20; // an authority picture needs at least this many lots
const MIN_WINS = 10; // a winner picture needs at least this many wins
const DIRECT = new Set(["Přímé zadání při zadávání veřejných zakázek malého rozsahu", "Uzavřená výzva při zadávání veřejných zakázek malého rozsahu", "Jednací řízení bez uveřejnění"]);

async function main() {
  const cpv = arg("cpv") ?? "45";
  const stamp = `${new Date().toISOString().slice(0, 10)}-${String(new Date().getUTCHours()).padStart(2, "0")}${String(new Date().getUTCMinutes()).padStart(2, "0")}`;

  const store = await getStore();
  if (!store) throw new Error("no store");
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const wins = await store.listKgEdges({ rel: "wins", limit: KG_READ_CAP });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));
  const mpTied = new Set(linked.map((e) => e.dst));
  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  const tenderById = new Map(scoped.map((t) => [t.id, t]));
  const winnersByTender = new Map<string, string[]>();
  for (const e of wins) {
    if (!tenderById.has(e.dst)) continue;
    winnersByTender.set(e.dst, [...(winnersByTender.get(e.dst) ?? []), e.src]);
  }

  // ── authority pictures ────────────────────────────────────────────────────────────────
  interface APic {
    ico: string;
    name: string;
    lots: number;
    czk: number; // lowest bid, else estimate — a floor, and named as such
    flagged: number;
    flaggedCzk: number;
    flagMix: Record<string, number>;
    directLots: number;
    singleBidLots: number;
    bidCountLots: number;
    topWinner: string | null;
    topWinnerWins: number;
    winsTotal: number;
    mpTied: boolean;
  }
  const authorities = new Map<string, APic>();
  const winnerPerAuthority = new Map<string, Map<string, number>>();

  for (const t of scoped) {
    const p = t.props ?? {};
    const aIco = str(p.authority_ico);
    if (!aIco) continue;
    const aId = `company:ico:${aIco}`;
    const pic = authorities.get(aIco) ?? {
      ico: aIco,
      name: byId.get(aId)?.label ?? aIco,
      lots: 0, czk: 0, flagged: 0, flaggedCzk: 0, flagMix: {}, directLots: 0,
      singleBidLots: 0, bidCountLots: 0, topWinner: null, topWinnerWins: 0, winsTotal: 0,
      mpTied: mpTied.has(aId),
    };
    const czk = num(p.lowest_bid_czk) ?? num(p.estimated_czk_no_vat) ?? 0;
    pic.lots++;
    pic.czk += czk;
    const flags = Array.isArray(p.flags) ? (p.flags as string[]) : [];
    if (flags.length) {
      pic.flagged++;
      pic.flaggedCzk += czk;
      for (const f of flags) pic.flagMix[f] = (pic.flagMix[f] ?? 0) + 1;
    }
    if (str(p.procedure_type) && DIRECT.has(str(p.procedure_type)!)) pic.directLots++;
    const bc = num(p.bid_count);
    if (bc != null) {
      pic.bidCountLots++;
      if (bc === 1) pic.singleBidLots++;
    }
    for (const w of winnersByTender.get(t.id) ?? []) {
      pic.winsTotal++;
      const m = winnerPerAuthority.get(aIco) ?? new Map<string, number>();
      m.set(w, (m.get(w) ?? 0) + 1);
      winnerPerAuthority.set(aIco, m);
    }
    authorities.set(aIco, pic);
  }
  for (const [aIco, m] of winnerPerAuthority) {
    const pic = authorities.get(aIco)!;
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      pic.topWinner = byId.get(top[0])?.label ?? top[0];
      pic.topWinnerWins = top[1];
    }
  }

  // ── winner pictures ───────────────────────────────────────────────────────────────────
  interface WPic {
    id: string;
    name: string;
    wins: number;
    winsFlagged: number;
    winsSingleBid: number;
    czk: number;
    authorities: Map<string, number>;
    mpTied: boolean;
  }
  const winners = new Map<string, WPic>();
  for (const [tid, ws] of winnersByTender) {
    const t = tenderById.get(tid)!;
    const p = t.props ?? {};
    const flags = Array.isArray(p.flags) ? (p.flags as string[]) : [];
    const czk = num(p.lowest_bid_czk) ?? 0;
    const aIco = str(p.authority_ico);
    for (const w of ws) {
      const pic = winners.get(w) ?? { id: w, name: byId.get(w)?.label ?? w, wins: 0, winsFlagged: 0, winsSingleBid: 0, czk: 0, authorities: new Map<string, number>(), mpTied: mpTied.has(w) };
      pic.wins++;
      pic.czk += czk;
      if (flags.length) pic.winsFlagged++;
      if (flags.includes("single_bid")) pic.winsSingleBid++;
      if (aIco) pic.authorities.set(aIco, (pic.authorities.get(aIco) ?? 0) + 1);
      winners.set(w, pic);
    }
  }

  // ── shape listings (floors applied, disclosed) ────────────────────────────────────────
  const aPics = [...authorities.values()].filter((a) => a.lots >= MIN_LOTS);
  // Monopoly counterparties (statutory single-source — monopoly.ts) leave the SIGNAL
  // listings and go to their own disclosed section: their flagged wins are the nature of
  // the counterparty, not a market shape. Excluded, never silently dropped.
  const wAll = [...winners.values()].filter((w) => w.wins >= MIN_WINS);
  const wPics = wAll.filter((w) => !isMonopolyCounterparty(w.id));
  const wMonopoly = wAll.filter((w) => isMonopolyCounterparty(w.id));

  const byFlagShare = [...aPics].filter((a) => a.flagged > 0).sort((a, b) => b.flagged / b.lots - a.flagged / a.lots).slice(0, 25);
  const bySingle = [...aPics].filter((a) => a.bidCountLots >= MIN_LOTS).sort((a, b) => b.singleBidLots / b.bidCountLots - a.singleBidLots / a.bidCountLots).slice(0, 25);
  const byLock = [...aPics].filter((a) => a.winsTotal >= MIN_WINS && a.topWinnerWins > 1).sort((a, b) => b.topWinnerWins / b.winsTotal - a.topWinnerWins / a.winsTotal).slice(0, 25);
  const wByFlag = [...wPics].sort((a, b) => b.winsFlagged / b.wins - a.winsFlagged / a.wins).slice(0, 25);
  const wByDependence = [...wPics]
    .map((w) => {
      const top = [...w.authorities.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ...w, topAuthority: top ? (byId.get(`company:ico:${top[0]}`)?.label ?? top[0]) : null, topAuthorityWins: top?.[1] ?? 0 };
    })
    .filter((w) => w.topAuthorityWins > 1)
    .sort((a, b) => b.topAuthorityWins / b.wins - a.topAuthorityWins / a.wins)
    .slice(0, 25);

  const evid = {
    generatedFor: "tender loop — authority & winner pictures",
    generatedAt: stamp,
    scope: { cpv, lots: scoped.length, authorities: authorities.size, aboveFloor: aPics.length, winners: winners.size, winnersAboveFloor: wPics.length, MIN_LOTS, MIN_WINS },
    authoritiesByFlagShare: byFlagShare.map((a) => ({ ...a, flagShare: +(a.flagged / a.lots).toFixed(3) })),
    authoritiesBySingleBid: bySingle.map((a) => ({ ...a, singleShare: +(a.singleBidLots / a.bidCountLots).toFixed(3) })),
    authoritiesByLock: byLock.map((a) => ({ ...a, lockShare: +(a.topWinnerWins / a.winsTotal).toFixed(3) })),
    winnersByFlagShare: wByFlag.map((w) => ({ ...w, authorities: w.authorities.size, flagShare: +(w.winsFlagged / w.wins).toFixed(3) })),
    winnersByDependence: wByDependence.map((w) => ({ id: w.id, name: w.name, wins: w.wins, topAuthority: w.topAuthority, topAuthorityWins: w.topAuthorityWins, dependence: +(w.topAuthorityWins / w.wins).toFixed(3), mpTied: w.mpTied })),
    monopolyCounterpartiesExcluded: wMonopoly.map((w) => ({ id: w.id, name: w.name, wins: w.wins, winsFlagged: w.winsFlagged, czk: w.czk, basis: MONOPOLY_COUNTERPARTIES[w.id.slice("company:ico:".length)]?.basis ?? null })),
  };
  const out = `docs/data-analysis/case-tender/pictures-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(evid, null, 2) + "\n", "utf8");

  const czkM = (n: number) => `${Math.round(n / 1e6).toLocaleString("cs-CZ")} M`;
  console.log(`lots ${scoped.length} · authorities ${authorities.size} (${aPics.length} ≥${MIN_LOTS} lots) · winners ${winners.size} (${wPics.length} ≥${MIN_WINS} wins)\n`);
  console.log(`AUTHORITIES by flag share (≥${MIN_LOTS} lots):`);
  for (const a of byFlagShare.slice(0, 10)) console.log(`  ${(100 * a.flagged / a.lots).toFixed(0).padStart(3)} %  ${String(a.lots).padStart(4)} lots  ${czkM(a.czk).padStart(9)}  ${a.name.slice(0, 46)}${a.mpTied ? "  [MP-tied]" : ""}  ${JSON.stringify(a.flagMix)}`);
  console.log(`\nAUTHORITIES by single-bid share:`);
  for (const a of bySingle.slice(0, 10)) console.log(`  ${(100 * a.singleBidLots / a.bidCountLots).toFixed(0).padStart(3)} %  ${String(a.bidCountLots).padStart(4)} lots  ${a.name.slice(0, 52)}${a.mpTied ? "  [MP-tied]" : ""}`);
  console.log(`\nAUTHORITIES by supplier lock (top winner share of wins):`);
  for (const a of byLock.slice(0, 10)) console.log(`  ${(100 * a.topWinnerWins / a.winsTotal).toFixed(0).padStart(3)} %  ${String(a.winsTotal).padStart(4)} wins  ${a.name.slice(0, 40)} -> ${a.topWinner?.slice(0, 32)}`);
  console.log(`\nWINNERS by flagged-win share (≥${MIN_WINS} wins):`);
  for (const w of wByFlag.slice(0, 10)) console.log(`  ${(100 * w.winsFlagged / w.wins).toFixed(0).padStart(3)} %  ${String(w.wins).padStart(4)} wins  ${czkM(w.czk).padStart(9)}  ${w.name.slice(0, 46)}${w.mpTied ? "  [MP-tied]" : ""}`);
  if (wMonopoly.length) {
    console.log(`
MONOPOLY COUNTERPARTIES (excluded from signal listings, disclosed):`);
    for (const w of wMonopoly) console.log(`   ${String(w.wins).padStart(4)} wins (${w.winsFlagged} flagged)  ${w.name}`);
  }
  console.log(`\nWINNERS by one-authority dependence:`);
  for (const w of wByDependence.slice(0, 10)) console.log(`  ${(100 * w.topAuthorityWins / w.wins).toFixed(0).padStart(3)} %  ${String(w.wins).padStart(4)} wins  ${w.name.slice(0, 40)} <- ${w.topAuthority?.slice(0, 34)}`);
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
