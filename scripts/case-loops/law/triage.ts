/* Case ③ Law loop — deterministic triage + ledger bootstrap (batch cycle step 1–2).
 *
 * Runs READ-ONLY against a PGlite COPY (set PGLITE_PATH=./.pglite-copy-law). Enumerates
 * the 141 bill nodes into docs/data-analysis/case-law/ledger.json and prints a ranked
 * triage table. The ranking is deterministic — the LLM never authors a score:
 *
 *   triageScore =  forensicSeverityWeight (existing gated verdict)   × BANDS.sev
 *                + maxTargetChurn                                    × BANDS.churn
 *                + round(log10(1 + sponsor_contract_czk)             × BANDS.moneyLog)
 *                + amendsCount                                       × BANDS.amends
 *                + (routingAnomaly && flagged_conflict)              × BANDS.route
 *   (the bands are declared once below and the ledger's `triageFormula` is printed from them)
 *
 * Routing anomaly (F12 owns ⋈ F15 assigned_to): for each bill's garanční committee we
 * take its owned themes (owns → theme) and ask whether ANY owned theme keyword appears in
 * the amended-law title / bill title. No overlap on a bill that HAS a garanční committee
 * with a remit ⇒ anomaly (the print may have been routed to a committee whose subject
 * matter doesn't obviously cover the statute it changes — a lead, never a verdict).
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/triage.ts
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/triage.ts --top=8
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";
import { byScoreThenId } from "../shared/ordering";
import type { KgNodeRow } from "@/lib/db/types";

const arg = (name: string, fb = ""): string => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const OUT_DIR = "docs/data-analysis/case-law";
const LEDGER_PATH = `${OUT_DIR}/ledger.json`;

/** The packed, non-overlapping score bands — read by the scoring AND by the `triageFormula`
 *  string the ledger records, so the recorded formula cannot describe weights the code does
 *  not use (until 2026-09-07 it advertised the batch-001 draft weights of 1e9 / 5e6 / 2e6 /
 *  2.5e8 while the code computed the log-scaled bands below). */
const BANDS = {
  sev: 1_000_000, // × severity weight 1..3 → 0..3e6
  churn: 30_000, // × max target churn → 0..~210_000 (586/1992 ×7)
  moneyLog: 1_000, // × log10(1 + sponsor CZK) → 0..~10_000
  amends: 5_000, // × amends count
  route: 2_000, // routing anomaly, only combined with a flagged conflict
} as const;

/** Rough theme→keyword remit so we can test a garanční committee's F12 owns-themes against a law title. */
const THEME_KEYWORDS: Record<string, string[]> = {
  environment: ["životní", "ozon", "sklen", "odpad", "obal", "výrobk", "emis", "voda", "ovzduš", "energ", "baterie"],
  economy: ["daň", "daní", "rozpoč", "výnos", "poplat", "clo", "účet", "finanč", "pojist", "pojiš", "cena"],
  health: ["zdrav", "léčiv", "pacient", "nemoc", "hygien"],
  justice: ["trest", "soud", "právní", "občansk", "exekuc", "insolvenc", "přestup"],
  education: ["škol", "vzděl", "student", "univerz", "pedagog"],
  social: ["sociál", "důchod", "dávk", "rodin", "zaměstna", "práce", "mzd"],
  security: ["bezpeč", "policie", "obran", "zbraň", "hasič", "krizov"],
  agriculture: ["zeměděl", "potravin", "les", "půd", "veterin"],
  transport: ["doprav", "silnič", "drá", "provoz", "vozidl"],
  digital: ["digit", "elektron", "kyber", "informač", "data", "telekomunik"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const bills = await store.listKgNodes({ kind: "bill" });
  const laws = await store.listKgNodes({ kind: "law" });
  const organs = await store.listKgNodes({ kind: "organ" });
  const amends = await store.listKgEdges({ rel: "amends" });
  const assigned = await store.listKgEdges({ rel: "assigned_to" });
  const owns = await store.listKgEdges({ rel: "owns" });
  const lawByUrn = new Map(laws.map((l) => [l.id, l]));
  const organLabel = new Map(organs.map((o) => [o.id, o.label]));

  // amends: bill → [law urn]
  const lawsByBill = new Map<string, string[]>();
  const amendCountByLaw = new Map<string, number>();
  for (const e of amends) {
    lawsByBill.set(e.src, [...(lawsByBill.get(e.src) ?? []), e.dst]);
    amendCountByLaw.set(e.dst, (amendCountByLaw.get(e.dst) ?? 0) + 1);
  }
  // garanční committee per bill (assigned_to role=garancni)
  const garancniByBill = new Map<string, string>();
  const assignCountByBill = new Map<string, number>();
  for (const e of assigned) {
    assignCountByBill.set(e.src, (assignCountByBill.get(e.src) ?? 0) + 1);
    if ((e.props as { role?: string })?.role === "garancni") garancniByBill.set(e.src, e.dst);
  }
  // owns: organ → [theme slug]
  const themesByOrgan = new Map<string, string[]>();
  for (const e of owns) themesByOrgan.set(e.src, [...(themesByOrgan.get(e.src) ?? []), e.dst.replace(/^theme:/, "")]);

  interface LedgerRow {
    tiskId: number;
    billNodeId: string;
    cislo: number | null;
    origin: string;
    title: string;
    amendedLaws: string[];
    amendsCount: number;
    maxTargetChurn: number; // max #prints amending any of this bill's target laws
    flaggedConflict: boolean;
    sponsorContractCzk: number;
    sponsorMoneyCompanies: number;
    sponsorCount: number;
    garancniCommittee: string | null;
    committeeCount: number;
    routingAnomaly: boolean;
    forensicSeverity: string | null;
    forensicState: string | null;
    triageScore: number;
    stage: string;
    batch: number | null;
    signal: number | null;
    flags: string[];
  }

  const rows: LedgerRow[] = bills.map((b: KgNodeRow) => {
    const p = (b.props ?? {}) as Record<string, unknown>;
    const amendedUrns = lawsByBill.get(b.id) ?? [];
    const amendedRefs = amendedUrns.map((u) => String((lawByUrn.get(u)?.props as Record<string, unknown>)?.ref ?? u));
    const maxTargetChurn = Math.max(0, ...amendedUrns.map((u) => amendCountByLaw.get(u) ?? 0));
    const garUrn = garancniByBill.get(b.id) ?? null;

    // routing anomaly: garanční committee owns themes, none of whose keywords hit the law/bill title
    let routingAnomaly = false;
    const garThemes = garUrn ? themesByOrgan.get(garUrn) ?? [] : [];
    if (garUrn && garThemes.length > 0) {
      const hay = norm([b.label, ...amendedRefs, ...amendedUrns.map((u) => lawByUrn.get(u)?.label ?? "")].join(" "));
      const anyThemeHit = garThemes.some((t) => (THEME_KEYWORDS[t] ?? []).some((k) => hay.includes(norm(k))));
      routingAnomaly = !anyThemeHit;
    }

    const flags: string[] = [];
    if (p.flagged_conflict === true) flags.push("money_conflict");
    if (routingAnomaly) flags.push("routing_anomaly");
    if (maxTargetChurn >= 3) flags.push("high_churn_target");
    if (String(p.origin) === "mp_group") flags.push("mp_group");

    const forensicSeverity = typeof p.forensic_severity === "string" ? p.forensic_severity : null;
    const forensicState = typeof p.forensic_review_state === "string" ? p.forensic_review_state : null;

    const sponsorContractCzk = typeof p.sponsor_contract_czk === "number" ? p.sponsor_contract_czk : 0;
    const amendsCount = amendedUrns.length;

    // Lexicographic triage (skill spec: severity → sponsorCzk → amends → routing), packed into
    // one score with capped, non-overlapping bands so a mega money figure cannot swamp severity.
    // Money is LOG-scaled (band 0..~10) precisely because sponsor_contract_czk is saturated by a
    // single municipal-board figure (ARENA BRNO 5.39e9 recurs on every Hladík print) — see reflect.
    const sevBand = (forensicSeverity ? SEVERITY_WEIGHT[forensicSeverity] ?? 0 : 0) * BANDS.sev;
    const moneyBand = Math.round(Math.log10(1 + sponsorContractCzk) * BANDS.moneyLog);
    const churnBand = maxTargetChurn * BANDS.churn;
    const amendsBand = amendsCount * BANDS.amends;
    const routeBand = routingAnomaly && p.flagged_conflict === true ? BANDS.route : 0; // only meaningful combined
    const triageScore = sevBand + churnBand + moneyBand + amendsBand + routeBand;

    return {
      tiskId: Number(b.id.replace(/^bill:tisk:/, "")) || 0,
      billNodeId: b.id,
      cislo: typeof p.cislo === "number" ? p.cislo : null,
      origin: String(p.origin ?? "other"),
      title: b.label,
      amendedLaws: amendedRefs,
      amendsCount,
      maxTargetChurn,
      flaggedConflict: p.flagged_conflict === true,
      sponsorContractCzk,
      sponsorMoneyCompanies: typeof p.sponsor_money_companies === "number" ? p.sponsor_money_companies : 0,
      sponsorCount: Array.isArray(p.sponsors) ? (p.sponsors as unknown[]).length : 0,
      garancniCommittee: garUrn ? organLabel.get(garUrn) ?? garUrn : null,
      committeeCount: assignCountByBill.get(b.id) ?? 0,
      routingAnomaly,
      forensicSeverity,
      forensicState,
      triageScore,
      stage: forensicState ? "verdict" : "pending",
      batch: forensicState ? 0 : null,
      signal: null,
      flags,
    };
  });

  rows.sort(byScoreThenId((r) => r.triageScore, (r) => r.billNodeId));
  // The batch head processes PENDING bills only — an already-gated bill (tisk 58) is batch-0 reference.
  const pending = rows.filter((r) => !r.forensicState);

  const top = Number(arg("top", "8")) || 8;
  const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));
  console.log(`Case ③ law triage · ${rows.length} bills · ${laws.length} laws · ${amends.length} amends · ${assigned.length} assigned_to · ${owns.length} owns`);
  console.log(`flagged_conflict: ${rows.filter((r) => r.flaggedConflict).length} · routing anomalies: ${rows.filter((r) => r.routingAnomaly).length} (${Math.round((100 * rows.filter((r) => r.routingAnomaly).length) / rows.length)}% — over-fires, see reflect) · existing forensic: ${rows.filter((r) => r.forensicState).length}\n`);
  console.log(`TOP ${top} PENDING by triage score (batch-001 head):`);
  console.log(`  rank  tisk  origin      amends  churn  flagCZK           routeAnom  garanční        forensic   title`);
  pending.slice(0, top).forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}    ${String(r.cislo ?? r.tiskId).padStart(4)}  ${r.origin.padEnd(10)}  ${String(r.amendsCount).padStart(4)}  ${String(r.maxTargetChurn).padStart(4)}  ${fmt(r.sponsorContractCzk).padStart(14)}  ${r.routingAnomaly ? "  YES  " : "   -   "}    ${(r.garancniCommittee ?? "—").padEnd(12)}  ${(r.forensicSeverity ?? "—").padEnd(8)}  ${r.title.slice(0, 60)}`,
    );
  });

  // Most-amended target statutes (repeat-amendment leaders)
  const churn = [...amendCountByLaw.entries()]
    .map(([u, n]) => ({ ref: String((lawByUrn.get(u)?.props as Record<string, unknown>)?.ref ?? u), urn: u, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  console.log(`\nMost-amended statutes (churn leaders):`);
  for (const c of churn) console.log(`  ${c.ref.padEnd(12)} amended by ${c.n} prints  (${lawByUrn.get(c.urn)?.label?.slice(0, 60) ?? ""})`);

  // Assign batch-001 to the pending top-N (deterministic selection record).
  const batchIds = new Set(pending.slice(0, top).map((r) => r.billNodeId));
  for (const r of rows) if (batchIds.has(r.billNodeId)) r.batch = 1;

  // P44/D1: this bootstrap REPLACES the ledger. Every later batch merge-writes (retriage-009,
  // update-ledger-011) because a wholesale write erases the accumulated totals.* blocks and the
  // per-row verdict bookkeeping. Re-running the bootstrap over a live ledger is therefore a
  // deliberate act, never a default.
  if (existsSync(LEDGER_PATH) && !process.argv.includes("--replace")) {
    console.error(
      `REFUSED: ${LEDGER_PATH} already exists and this script replaces it wholesale (totals.* blocks and verdict bookkeeping would be lost). ` +
        `Use the merge-preserving re-triage, or pass --replace to state the wholesale rewrite is intentional.`,
    );
    await store.close();
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const ledger = {
    case: "law",
    generatedAt: new Date().toISOString(),
    source: "PGLITE_PATH copy (read-only)",
    totals: {
      bills: rows.length,
      laws: laws.length,
      amends: amends.length,
      assignedTo: assigned.length,
      flaggedConflict: rows.filter((r) => r.flaggedConflict).length,
      routingAnomalies: rows.filter((r) => r.routingAnomaly).length,
      existingForensic: rows.filter((r) => r.forensicState).length,
    },
    triageFormula: `sevWeight*${BANDS.sev} + churn*${BANDS.churn} + round(log10(1+sponsorCzk)*${BANDS.moneyLog}) + amends*${BANDS.amends} + (routeAnom&&flagged)*${BANDS.route}`,
    rows,
  };
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));
  console.log(`\n→ wrote ${LEDGER_PATH} (${rows.length} rows)`);
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
