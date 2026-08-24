/* Tender loop — persist scoped ISVZ months into the live graph (durable writer).
 *
 * Deterministic ingest in the smlouvy-dump re-ingest discipline (money batch 012):
 * replayable from the cached zips, pass-stamped provenance, idempotent (same input →
 * same rows; tender props are loop-owned, no human-gated field lives here, so a
 * wholesale props replace on re-run is correct — kg-upsert-replaces-props). Every prop
 * key is validated against lib/kg/prop-registry.json BEFORE any write.
 *
 * THE COUNTRY GATE (b001 calibration find): an 8-digit Slovak identifier passes the IČO
 * shape test. A subject becomes a `company:ico:*` node ONLY when its country is CZE (or
 * unstated) AND the IČO parses; everything else is counted on the tender node as
 * `foreign_participants` / `foreign_winners`, never minted as a phantom Czech company.
 *
 *   npx tsx scripts/case-loops/tender/persist-month.ts --months=VZ-06-2026 --cpv=45 --pass=67 [--commit]
 */
import { getStore } from "@/lib/db/store";
import { loadMonthJson } from "./loadMonth";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { parseIsvzMonth, type IsvzLot, type IsvzSubject } from "@/lib/ingest/sources/isvz";
import { unregisteredKeys } from "@/lib/kg/propRegistry";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);

/** Three-way identity, because the register has three states (measured b002):
 *  2 196 participants carry ico+CZE, 3 108 ico+no-country, and 3 735 carry NOTHING —
 *  no IČO, no country. Those are UNIDENTIFIED (the register anonymises losing bidders in
 *  some tools), not foreign; the first draft filed them as foreign and tripled that count. */
type SubjectClass = "czech" | "foreign" | "unidentified";
const classify = (s: IsvzSubject): SubjectClass =>
  s.ico != null && (s.country == null || s.country === "CZE")
    ? "czech"
    : s.country != null && s.country !== "CZE"
      ? "foreign"
      : "unidentified";
const isCzech = (s: IsvzSubject): boolean => classify(s) === "czech";

async function main() {
  const months = (arg("months") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const cpv = arg("cpv") ?? "45";
  const pass = Number(arg("pass"));
  if (!months.length || !Number.isInteger(pass) || pass <= 0) {
    throw new Error("usage: persist-month.ts --months=VZ-06-2026[,..] --cpv=45 --pass=<n> [--commit]");
  }
  const commit = flag("commit");
  const computedAt = new Date().toISOString();

  // ── parse the scoped lots ─────────────────────────────────────────────────────────────
  const lots: IsvzLot[] = [];
  const monthOf = new Map<string, string>();
  for (const m of months) {
    const json = await loadMonthJson(m, cpv);
    const parsed = parseIsvzMonth(json);
    for (const l of parsed.lots) if (l.cpvDivision === cpv) { lots.push(l); monthOf.set(l.lotId, m); }
    console.log(`${m}: ${parsed.lots.length} lots, ${lots.length} in scope so far (dropped ${parsed.droppedLots})`);
  }

  // MONTHS OVERLAP (measured b003: January carries 71 377 records, April 240 598 — the
  // files re-publish UPDATED snapshots of older procedures). Months are processed in the
  // caller's order; the LAST occurrence of a lot wins, so pass months chronologically and
  // the newest snapshot is what persists. Dropped duplicates are counted, never silent.
  const byLot = new Map<string, IsvzLot>();
  for (const l of lots) byLot.set(l.lotId, l);
  const dedupedLots = [...byLot.values()];
  if (dedupedLots.length !== lots.length) console.log(`cross-month snapshots deduped: ${lots.length} -> ${dedupedLots.length} lots (latest month wins)`);

  // ── current graph state ───────────────────────────────────────────────────────────────
  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const knownIcos = new Set(companies.map((c) => String(c.props?.ico ?? c.id.split(":").pop())));

  const provenance = { track: "tender", pass, method: "deterministic", ref: `ISVZ RVZ open data ${months.join(",")} · CPV ${cpv} · scripts/case-loops/tender/persist-month.ts`, computedAt };
  const srcUrl = (m: string) => `https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/${m}.zip`;

  const tenderNodes: KgNodeRow[] = [];
  const companyNodes = new Map<string, KgNodeRow>();
  const edges: KgEdgeRow[] = [];
  let foreignParticipantEntries = 0;
  let foreignWinnerEntries = 0;
  let unidentifiedParticipantEntries = 0;

  const mintCompany = (s: IsvzSubject) => {
    if (!isCzech(s) || knownIcos.has(s.ico!)) return;
    companyNodes.set(s.ico!, {
      id: `company:ico:${s.ico}`,
      kind: "company",
      label: s.name,
      props: { ico: s.ico, source: "ISVZ RVZ open data (zadavatel/účastník zadávacího řízení)", sourceUrl: "https://isvz.nipez.cz/opendata" },
      provenance,
      firstSeenPass: pass,
    } as KgNodeRow);
  };

  for (const l of dedupedLots) {
    const m = monthOf.get(l.lotId)!;
    const foreignP = l.participants.filter((p) => classify(p) === "foreign");
    const foreignW = l.winners.filter((w) => classify(w) === "foreign");
    const unidentifiedP = l.participants.filter((p) => classify(p) === "unidentified").length;
    foreignParticipantEntries += foreignP.length;
    foreignWinnerEntries += foreignW.length;
    unidentifiedParticipantEntries += unidentifiedP;

    tenderNodes.push({
      id: `tender:${l.lotId}`,
      kind: "tender",
      label: l.name.slice(0, 300),
      props: {
        vz_nipez_id: l.vzId,
        name: l.name,
        cpv: l.cpv,
        cpv_division: l.cpvDivision,
        kind: l.kind,
        regime: l.regime,
        procedure_type: l.procedureType,
        estimated_czk_no_vat: l.estimatedCzkNoVat,
        eu_funded: l.euFunded,
        deadline_days: l.deadlineDays,
        started_on: l.startedOn,
        ended_on: l.endedOn,
        result_kind: l.resultKind,
        bid_count: l.bidCount,
        evaluated_bid_count: l.evaluatedBidCount,
        lowest_bid_czk: l.lowestBidCzk,
        highest_bid_czk: l.highestBidCzk,
        objections_count: l.objectionsCount,
        foreign_participants: foreignP.length ? foreignP.map((p) => `${p.name} (${p.country ?? "?"})`) : null,
        foreign_winners: foreignW.length ? foreignW.map((w) => `${w.name} (${w.country ?? "?"})`) : null,
        unidentified_participants: unidentifiedP || null,
        tool: l.toolRef?.tool ?? null,
        tool_id: l.toolRef?.id ?? null,
        authority_ico: l.authority && isCzech(l.authority) ? l.authority.ico : null,
        source: srcUrl(m),
      },
      provenance,
      firstSeenPass: pass,
    } as KgNodeRow);

    if (l.authority && isCzech(l.authority)) {
      mintCompany(l.authority);
      edges.push({ src: `company:ico:${l.authority.ico}`, rel: "procures", dst: `tender:${l.lotId}`, weight: null, props: {}, provenance, firstSeenPass: pass } as KgEdgeRow);
    }
    const seenBid = new Set<string>();
    for (const p of l.participants) {
      if (!isCzech(p) || seenBid.has(p.ico!)) continue;
      seenBid.add(p.ico!);
      mintCompany(p);
      edges.push({ src: `company:ico:${p.ico}`, rel: "bids_on", dst: `tender:${l.lotId}`, weight: p.bidCzkNoVat, props: { evaluated: p.evaluated, value_czk: p.bidCzkNoVat, role: p.role }, provenance, firstSeenPass: pass } as KgEdgeRow);
    }
    const seenWin = new Set<string>();
    for (const w of l.winners) {
      if (!isCzech(w) || seenWin.has(w.ico!)) continue;
      seenWin.add(w.ico!);
      mintCompany(w);
      edges.push({ src: `company:ico:${w.ico}`, rel: "wins", dst: `tender:${l.lotId}`, weight: l.lowestBidCzk, props: { price_czk: l.lowestBidCzk, decided_on: w.decidedOn, sole_bidder_self_declared: w.soleBidderSelfDeclared }, provenance, firstSeenPass: pass } as KgEdgeRow);
    }
  }

  // Edge dedupe by (src,rel,dst) — a re-published snapshot can repeat a pair; last wins.
  const edgeByKey = new Map<string, KgEdgeRow>();
  for (const e of edges) edgeByKey.set(`${e.src}|${e.rel}|${e.dst}`, e);
  const dedupedEdges = [...edgeByKey.values()];
  if (dedupedEdges.length !== edges.length) console.log(`edges deduped: ${edges.length} -> ${dedupedEdges.length}`);

  // ── prop-key gate (the same rule persist-batch enforces) ─────────────────────────────
  const unknown = new Map<string, number>();
  for (const n of tenderNodes) for (const k of unregisteredKeys({ kind: "tender" }, n.props as Record<string, unknown>)) unknown.set(`node:tender.${k}`, (unknown.get(`node:tender.${k}`) ?? 0) + 1);
  for (const e of dedupedEdges) for (const k of unregisteredKeys({ rel: e.rel }, e.props as Record<string, unknown>)) unknown.set(`edge:${e.rel}.${k}`, (unknown.get(`edge:${e.rel}.${k}`) ?? 0) + 1);
  if (unknown.size) {
    throw new Error(`prop-key gate: unregistered keys — refusing:\n${[...unknown].map(([k, n]) => `  ${k} (${n})`).join("\n")}`);
  }

  console.log(`\ntender nodes ${tenderNodes.length} · new company nodes ${companyNodes.size} · edges ${edges.length} (procures ${edges.filter((e) => e.rel === "procures").length}, bids_on ${edges.filter((e) => e.rel === "bids_on").length}, wins ${edges.filter((e) => e.rel === "wins").length})`);
  console.log(`kept OFF the company namespace: foreign participants ${foreignParticipantEntries}, foreign winners ${foreignWinnerEntries}, UNIDENTIFIED participants ${unidentifiedParticipantEntries} (no IČO, no country — the register anonymises)`);

  if (!commit) {
    console.log("DRY-RUN: nothing written (pass --commit).");
    await store.close();
    return;
  }
  let written = 0;
  written += await store.upsertKgNodes([...companyNodes.values()]);
  written += await store.upsertKgNodes(tenderNodes);
  written += await store.upsertKgEdges(dedupedEdges);
  console.log(`COMMITTED pass ${pass}: ${written} rows.`);
  await store.close();
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
