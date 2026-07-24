/* Money loop — Case ① triage (deterministic, PGlite copy · R4).
 *
 * Reads the materialized money layer from a PGlite COPY (PGLITE_PATH=./.pglite-copy-money)
 * and enumerates the `linked_to` ties as ledger units, scoring each with the deterministic
 * triage signals from the money-loop skill. Emits:
 *   docs/data-analysis/case-money/ledger.json   (machine state: units + scores)
 *   docs/data-analysis/case-money/triage-dump.json (raw per-tie detail for the army)
 * and prints a ranked summary. NO LLM, NO writes to the graph. Read-only on the copy.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/triage.ts
 */
import { getStore } from "@/lib/db/store";

const NEAR_THRESHOLDS = [2_000_000, 6_000_000]; // CZK zadávací limity
const NEAR_BAND = 0.1; // within 10% below a limit = "near-threshold"

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}
/** Parse a role period out of the linked_to source string:
 *  "… · 2015-03-01–ongoing" / "… · 2013-06-10–2017-02-02" → {from,to}. */
function parsePeriod(source: string): { from: string | null; to: string | null } {
  // last "date–date|ongoing" token
  const m = source.match(/(\d{4}-\d{2}-\d{2}|\?)–(\d{4}-\d{2}-\d{2}|ongoing|\?)/);
  if (!m) return { from: null, to: null };
  const from = m[1] === "?" ? null : m[1];
  const to = m[2] === "ongoing" || m[2] === "?" ? null : m[2];
  return { from, to };
}
function inPeriod(signedOn: string | null, from: string | null, to: string | null): boolean {
  if (!signedOn) return false;
  if (from && signedOn < from) return false;
  if (to && signedOn > to) return false;
  return true;
}

// Public-institution / nonprofit markers in a company label — a board seat here is
// STEWARDSHIP (oversight), not ownership: the money is the body's own public activity,
// it does NOT flow to the MP. Deterministic keyword test (folded, lowercased).
const PUBLIC_MARKERS = [
  "nemocnice", "univerzita", "vysoká škola", "vodárna", "vodárenská", "kraj", "krajsk",
  "městsk", "město", "obec", "nadace", "nadační", "o.p.s", "z.ú", "z.s", "z. ú", "z. s",
  "příspěvková", "muzeum", "museum", "galerie", "divadlo", "knihovna", "akademie",
  "komora", "svaz", "spolek", "fakultní", "služba čr", "dopravní podnik", "technické služby",
  "správa", "ústav", "fond", "sportovní", "rekreační", "lidských zdrojů", "centrum",
];
const OWNER_ROLES = ["jednatel", "společník", "spolecnik", "akcionář", "akcionar", "majitel", "vlastník"];
const BOARD_MGMT_ROLES = ["představenstv", "predstavenstv"]; // board of directors (management)
function classifyTie(role: string, company: string): "owner-operator" | "manager" | "steward" {
  const r = foldLowerLite(role);
  const c = foldLowerLite(company);
  const isPublic = PUBLIC_MARKERS.some((m) => c.includes(foldLowerLite(m)));
  if (!isPublic && OWNER_ROLES.some((k) => r.includes(k))) return "owner-operator";
  if (!isPublic && BOARD_MGMT_ROLES.some((k) => r.includes(k))) return "manager";
  return "steward";
}
function foldLowerLite(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

interface ContractAgg {
  count: number;
  czk: number;
  signed: { signedOn: string | null; amount: number }[];
  nearThreshold: number; // contracts within NEAR_BAND below a limit
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  // company id → contract aggregate (via supplies edges → contract nodes)
  const aggByCompany = new Map<string, ContractAgg>();
  for (const e of supplies) {
    const agg = aggByCompany.get(e.src) ?? { count: 0, czk: 0, signed: [], nearThreshold: 0 };
    const ct = contractById.get(e.dst);
    const amount = num(e.weight) || num(ct?.props?.amount);
    const signedOn = (ct?.props?.signedOn as string | null) ?? null;
    agg.count += 1;
    agg.czk += amount;
    agg.signed.push({ signedOn, amount });
    for (const limit of NEAR_THRESHOLDS) {
      if (amount > 0 && amount <= limit && amount >= limit * (1 - NEAR_BAND)) agg.nearThreshold += 1;
    }
    aggByCompany.set(e.src, agg);
  }

  interface Unit {
    id: string;
    personPspId: number;
    personName: string;
    absenteeManagerLead: boolean;
    ico: string;
    company: string;
    role: string;
    reviewState: string;
    source: string;
    periodFrom: string | null;
    periodTo: string | null;
    contractCount: number;
    contractCzk: number;
    subsidiesCzk: number;
    subsidiesCount: number;
    donatedToPartyCzk: number | null;
    donationRecipientParty: string | null;
    temporalAlignedCzk: number;
    temporalAlignedCount: number;
    nearThresholdCount: number;
    triangle: boolean;
    tieClass: "owner-operator" | "manager" | "steward";
    signalScore: number;
    stage: "pending";
    batch: number | null;
    flags: string[];
  }

  const units: Unit[] = [];
  for (const e of linked) {
    const comp = companyById.get(e.dst);
    const pspId = pspIdFromNodeId(e.src);
    const person = personById.get(e.src);
    if (!comp || pspId == null) continue; // unresolved endpoint — surfaced below as a flag unit? drop & count
    const cp = comp.props ?? {};
    const agg = aggByCompany.get(comp.id) ?? { count: 0, czk: 0, signed: [], nearThreshold: 0 };
    const source = String(e.props?.source ?? "");
    const { from, to } = parsePeriod(source);
    let alignedCzk = 0;
    let alignedCount = 0;
    if (from || to) {
      for (const s of agg.signed) {
        if (inPeriod(s.signedOn, from, to)) {
          alignedCzk += s.amount;
          alignedCount += 1;
        }
      }
    }
    const subsidiesCzk = num(cp.subsidies_total_czk);
    const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
    const triangle = agg.czk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
    const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;

    const flags: string[] = [];
    if (!/IČO \d/.test(source) && !/ico \d/i.test(source)) flags.push("source-missing-ico");
    if (!from && !to) flags.push("no-period-in-source");
    if (agg.count === 0 && subsidiesCzk === 0) flags.push("no-money-reachable");

    units.push({
      id: `tie:${pspId}:${String(cp.ico ?? comp.id.split(":").pop() ?? "")}`,
      personPspId: pspId,
      personName: person?.label ?? String(pspId),
      absenteeManagerLead: Boolean(person?.props?.absentee_manager_lead),
      ico: String(cp.ico ?? comp.id.split(":").pop() ?? ""),
      company: comp.label,
      role: String(e.props?.role ?? ""),
      reviewState: rawState === "verified" ? "verified" : "pending_review",
      source,
      periodFrom: from,
      periodTo: to,
      contractCount: agg.count,
      contractCzk: agg.czk,
      subsidiesCzk,
      subsidiesCount: num(cp.subsidies_count),
      donatedToPartyCzk,
      donationRecipientParty: cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
      temporalAlignedCzk: alignedCzk,
      temporalAlignedCount: alignedCount,
      nearThresholdCount: agg.nearThreshold,
      triangle,
      tieClass: classifyTie(String(e.props?.role ?? ""), comp.label),
      signalScore: 0,
      stage: "pending",
      batch: null,
      flags,
    });
  }

  // ── deterministic signal score (rank key; 0..~100) ─────────────────────────
  // log-scaled money + temporal-alignment weight + triangle + near-threshold + cross-case.
  const log10 = (v: number) => (v > 0 ? Math.log10(v) : 0);
  for (const u of units) {
    const money = log10(u.contractCzk + u.subsidiesCzk); // ~0..10
    const aligned = u.temporalAlignedCzk > 0 ? log10(u.temporalAlignedCzk) : 0; // ~0..10
    const alignFrac =
      u.contractCzk > 0 ? u.temporalAlignedCzk / u.contractCzk : 0; // 0..1
    // Tie-class weight: an owner-operator (private s.r.o./a.s. the MP controls that
    // sells to the state) is the real FollowTheMoney; a steward seat on a public body
    // is oversight — the money is the body's own public activity, not MP enrichment.
    const classW = u.tieClass === "owner-operator" ? 1.0 : u.tieClass === "manager" ? 0.7 : 0.35;
    u.signalScore =
      classW *
        (money * 4 + // money volume (head of queue)
          aligned * 3 + // temporal alignment
          alignFrac * 8 + // fraction of money inside the role window
          (u.triangle ? 12 : 0) + // full accountability triangle
          Math.min(u.nearThresholdCount, 5) * 2 + // near-threshold clustering
          (u.donatedToPartyCzk ? 4 : 0)) + // party-donation dimension
      (u.tieClass === "owner-operator" ? 10 : 0) + // owner-operator base lift
      (u.absenteeManagerLead ? 6 : 0); // cross-case (Case ②) — not class-scaled
    u.signalScore = Math.round(u.signalScore * 100) / 100;
  }
  units.sort((a, b) => b.signalScore - a.signalScore);

  const totalContractCzk = units.reduce((s, u) => s + u.contractCzk, 0);
  const summary = {
    generatedAt: new Date().toISOString(),
    counts: {
      linkedEdges: linked.length,
      tiesEnumerated: units.length,
      companies: companies.length,
      contracts: contracts.length,
      suppliesEdges: supplies.length,
      persons: persons.length,
    },
    droppedTies: linked.length - units.length,
    withPeriod: units.filter((u) => u.periodFrom || u.periodTo).length,
    withMoney: units.filter((u) => u.contractCzk + u.subsidiesCzk > 0).length,
    triangles: units.filter((u) => u.triangle).length,
    absenteeManagerLeads: units.filter((u) => u.absenteeManagerLead).length,
    nearThresholdTies: units.filter((u) => u.nearThresholdCount > 0).length,
    tieClass: {
      ownerOperator: units.filter((u) => u.tieClass === "owner-operator").length,
      manager: units.filter((u) => u.tieClass === "manager").length,
      steward: units.filter((u) => u.tieClass === "steward").length,
    },
    totalContractCzk,
  };

  const fs = await import("node:fs/promises");
  const dir = "docs/data-analysis/case-money";
  await fs.writeFile(
    `${dir}/ledger.json`,
    JSON.stringify({ summary, units: units.map((u) => ({ id: u.id, personPspId: u.personPspId, personName: u.personName, ico: u.ico, company: u.company, role: u.role, tieClass: u.tieClass, reviewState: u.reviewState, signalScore: u.signalScore, stage: u.stage, batch: u.batch, flags: u.flags })) }, null, 2),
  );
  await fs.writeFile(`${dir}/triage-dump.json`, JSON.stringify({ summary, units }, null, 2));

  const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));
  console.log("=== MONEY TRIAGE ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\n=== TOP 20 BY SIGNAL ===");
  for (const u of units.slice(0, 20)) {
    console.log(
      `${u.signalScore.toFixed(1).padStart(6)} ${u.tieClass[0].toUpperCase()}  ${u.personName} → ${u.company} [${u.role}] · ` +
        `${fmt(u.contractCzk)} CZK/${u.contractCount}k${u.subsidiesCzk ? ` +${fmt(u.subsidiesCzk)}dot` : ""}` +
        `${u.triangle ? " ▲TRI" : ""}${u.temporalAlignedCzk ? ` ⏱${fmt(u.temporalAlignedCzk)}` : ""}` +
        `${u.nearThresholdCount ? ` ~${u.nearThresholdCount}` : ""}${u.absenteeManagerLead ? " ✚ABS" : ""}` +
        ` [${u.periodFrom ?? "?"}→${u.periodTo ?? "?"}]`,
    );
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
