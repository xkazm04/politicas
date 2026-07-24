/* Case ③ Law loop — BATCH 002 re-weighted triage (batch cycle step 1–2).
 *
 * Supersedes triage.ts's ranking (kept for reference/re-run) with the batch-002 steering:
 *   - churn-LED (repeat-amendment targets are where quiet riders hide — batch-001 confirmed
 *     this on 586/1992 ×7 and 40/2009 ×6).
 *   - conflict by SECTOR-ADJACENCY (company-sectors.ts), not raw sponsor_contract_czk: a
 *     flagged bill only gets a conflict boost when a sponsor's PRIVATE-sector company's
 *     coarse sector matches the amended law's domain bucket (THEME_KEYWORDS, same buckets
 *     used for F12 routing) AND the company is not municipal/SOE. Money itself is
 *     log-scaled and demoted to a small tiebreak (unchanged principle from batch-001).
 *   - the same-statute sibling-collision GROUPING is computed here deterministically (free
 *     — just the `amends` edge join): every law amended by >1 pending bill is a collision
 *     CANDIDATE group. Confirming an actual §-level collision requires each bill's own text
 *     (novelization instructions), fetched + regex-extracted by collision-check.ts (network
 *     work, run separately/in the background) — this script only emits the candidate groups.
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/triage-002.ts --top=10
 * → docs/data-analysis/case-law/ledger.json (batch=2 assigned to the new top-N pending)
 * → docs/data-analysis/case-law/payloads/collision-groups.json (candidate groups, all 141)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";
import { isMunicipalOrSoe, sectorOf, type Sector } from "./company-sectors";

const arg = (name: string, fb = ""): string => {
  const h = process.argv.find((a) => a.startsWith(`--${name}=`));
  return h ? h.slice(name.length + 3) : fb;
};

const OUT_DIR = "docs/data-analysis/case-law";

const THEME_KEYWORDS: Record<Sector, string[]> = {
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

/* batch-002 fix: batch-001's routing-anomaly signal (and this triage's first draft) used naive
 * `.includes()` substring matching, which false-positives badly on Czech boilerplate — e.g. every
 * MP bill title carries "…na vydání zákona…" ("for the issuance of a law"), and "vydání" contains
 * "daní" (genitive of daň/tax) as a mid-word substring, so EVERY bill matched the "economy" domain
 * regardless of subject. This is very likely a real contributor to batch-001's reported 89%
 * routing-anomaly over-fire rate (same THEME_KEYWORDS + same .includes() pattern). Fixed here with
 * word-boundary regex; flagged in the batch-002 reflect as a fix candidate for triage.ts too. */
const KEYWORD_RE_CACHE = new Map<string, RegExp>();
function keywordHits(haystack: string, keyword: string): boolean {
  let re = KEYWORD_RE_CACHE.get(keyword);
  if (!re) {
    re = new RegExp(`(?<![\\p{L}])${keyword}`, "u");
    KEYWORD_RE_CACHE.set(keyword, re);
  }
  return re.test(haystack);
}
function lawDomains(hay: string): Sector[] {
  const h = norm(hay);
  return (Object.entries(THEME_KEYWORDS) as [Sector, string[]][])
    .filter(([, kws]) => kws.some((k) => keywordHits(h, norm(k))))
    .map(([s]) => s);
}

interface PriorRow {
  billNodeId: string;
  batch: number | null;
  signal: number | null;
  verdictFile?: string;
  forensicConfidence?: number;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  // preserve batch-001's verdict bookkeeping (batch #, signal score, verdictFile, confidence)
  // for already-gated bills — this script recomputes triage but must not erase prior verdicts.
  const priorPath = `${OUT_DIR}/ledger.json`;
  const priorByBill = new Map<string, PriorRow>();
  if (existsSync(priorPath)) {
    const prior = JSON.parse(readFileSync(priorPath, "utf8")) as { rows: PriorRow[] };
    for (const r of prior.rows) priorByBill.set(r.billNodeId, r);
  }

  const bills = await store.listKgNodes({ kind: "bill" });
  const laws = await store.listKgNodes({ kind: "law" });
  const amends = await store.listKgEdges({ rel: "amends" });
  const assigned = await store.listKgEdges({ rel: "assigned_to" });
  const linked = await store.listKgEdges({ rel: "linked_to" });
  const companies = await store.listKgNodes({ kind: "company" });
  const persons = await store.listPersons();
  const lawByUrn = new Map(laws.map((l) => [l.id, l]));
  const companyLabel = new Map(companies.map((c) => [c.id, c.label]));
  const personName = new Map(persons.map((p) => [p.pspId, p.nameFull]));

  const lawsByBill = new Map<string, string[]>();
  const amendCountByLaw = new Map<string, number>();
  const billsByLaw = new Map<string, number[]>(); // law urn -> [cislo]
  for (const e of amends) {
    lawsByBill.set(e.src, [...(lawsByBill.get(e.src) ?? []), e.dst]);
    amendCountByLaw.set(e.dst, (amendCountByLaw.get(e.dst) ?? 0) + 1);
  }
  const garancniByBill = new Map<string, string>();
  for (const e of assigned) {
    if ((e.props as { role?: string })?.role === "garancni") garancniByBill.set(e.src, e.dst);
  }
  // person -> companies (private, sector-classifiable only)
  const companiesByPerson = new Map<number, { urn: string; label: string; czk: number }[]>();
  for (const e of linked) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    if (!m) continue;
    const id = Number(m[1]);
    const label = companyLabel.get(e.dst) ?? e.dst;
    companiesByPerson.set(id, [...(companiesByPerson.get(id) ?? []), { urn: e.dst, label, czk: typeof e.weight === "number" ? e.weight : 0 }]);
  }

  interface Row {
    tiskId: number;
    billNodeId: string;
    cislo: number | null;
    origin: string;
    title: string;
    amendedLaws: string[];
    amendsCount: number;
    maxTargetChurn: number;
    sponsorContractCzk: number;
    forensicSeverity: string | null;
    forensicState: string | null;
    stage: string;
    batch: number | null;
    signal: number | null;
    flags: string[];
    verdictFile?: string;
    forensicConfidence?: number;
    // batch-002 additions
    sectorAdjacency: boolean;
    sectorAdjacentCompanies: { company: string; sector: Sector; sponsor: string }[];
    municipalExcludedCompanies: string[];
    triageScoreV2: number;
  }

  const rows: Row[] = bills.map((b: KgNodeRow) => {
    const p = (b.props ?? {}) as Record<string, unknown>;
    const amendedUrns = lawsByBill.get(b.id) ?? [];
    const amendedRefs = amendedUrns.map((u) => String((lawByUrn.get(u)?.props as Record<string, unknown>)?.ref ?? u));
    const maxTargetChurn = Math.max(0, ...amendedUrns.map((u) => amendCountByLaw.get(u) ?? 0));
    for (const u of amendedUrns) billsByLaw.set(u, [...(billsByLaw.get(u) ?? []), Number((p.cislo as number) ?? 0)]);

    // law domain buckets: union of amended-law titles + labels
    const domainHay = [b.label, ...amendedRefs, ...amendedUrns.map((u) => lawByUrn.get(u)?.label ?? "")].join(" ");
    const domains = new Set(lawDomains(domainHay));

    // sector-adjacency: any sponsor's PRIVATE (non-municipal/SOE) company whose sector hits a law domain
    const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as number[]) : [];
    const adjacent: { company: string; sector: Sector; sponsor: string }[] = [];
    const excluded: string[] = [];
    for (const sid of sponsorIds) {
      for (const c of companiesByPerson.get(sid) ?? []) {
        if (isMunicipalOrSoe(c.label)) {
          excluded.push(c.label);
          continue;
        }
        const sec = sectorOf(c.label);
        if (sec && domains.has(sec)) {
          adjacent.push({ company: c.label, sector: sec, sponsor: personName.get(sid) ?? `#${sid}` });
        }
      }
    }

    const forensicSeverity = typeof p.forensic_severity === "string" ? p.forensic_severity : null;
    const forensicState = typeof p.forensic_review_state === "string" ? p.forensic_review_state : null;
    const sponsorContractCzk = typeof p.sponsor_contract_czk === "number" ? p.sponsor_contract_czk : 0;
    const amendsCount = amendedUrns.length;

    const flags: string[] = [];
    if (adjacent.length > 0) flags.push("sector_adjacent_conflict");
    if (maxTargetChurn >= 3) flags.push("high_churn_target");
    if (String(p.origin) === "mp_group") flags.push("mp_group");
    if (excluded.length > 0) flags.push("municipal_soe_excluded");

    const prior = priorByBill.get(b.id);

    // Re-weighted score: churn PRIMARY, sector-adjacency SECONDARY (real signal, meaningful
    // weight), money log-scaled TERTIARY (tiebreak only, never dominant), amends quaternary.
    const SEV: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sevBand = (forensicSeverity ? SEV[forensicSeverity] ?? 0 : 0) * 5_000_000; // existing verdict still ranks first if present
    const churnBand = maxTargetChurn * 100_000; // PRIMARY: 0..~700_000 (586/1992 ×7)
    const sectorAdjBand = adjacent.length > 0 ? 50_000 : 0; // SECONDARY: real conflict candidate
    const moneyLogBand = Math.round(Math.log10(1 + sponsorContractCzk) * 200); // TERTIARY: 0..~2_000
    const amendsBand = amendsCount * 500; // quaternary

    return {
      tiskId: Number(b.id.replace(/^bill:tisk:/, "")) || 0,
      billNodeId: b.id,
      cislo: typeof p.cislo === "number" ? p.cislo : null,
      origin: String(p.origin ?? "other"),
      title: b.label,
      amendedLaws: amendedRefs,
      amendsCount,
      maxTargetChurn,
      sponsorContractCzk,
      forensicSeverity,
      forensicState,
      stage: forensicState ? "verdict" : "pending",
      batch: forensicState ? (prior?.batch ?? 0) : null,
      signal: forensicState ? (prior?.signal ?? null) : null,
      ...(prior?.verdictFile ? { verdictFile: prior.verdictFile } : {}),
      ...(prior?.forensicConfidence !== undefined ? { forensicConfidence: prior.forensicConfidence } : {}),
      flags,
      sectorAdjacency: adjacent.length > 0,
      sectorAdjacentCompanies: adjacent,
      municipalExcludedCompanies: [...new Set(excluded)],
      triageScoreV2: sevBand + churnBand + sectorAdjBand + moneyLogBand + amendsBand,
    };
  });

  rows.sort((a, b) => b.triageScoreV2 - a.triageScoreV2);
  const pending = rows.filter((r) => !r.forensicState);
  const top = Number(arg("top", "10")) || 10;

  console.log(`Case ③ law triage v2 (batch-002) · ${rows.length} bills · pending ${pending.length}`);
  console.log(`sector-adjacency hits: ${rows.filter((r) => r.sectorAdjacency).length} · municipal/SOE excluded (≥1 tie): ${rows.filter((r) => r.municipalExcludedCompanies.length > 0).length}\n`);
  console.log(`TOP ${top} PENDING by triage v2 (batch-002 head):`);
  pending.slice(0, top).forEach((r, i) => {
    const adjStr = r.sectorAdjacentCompanies.map((a) => `${a.company}(${a.sector})`).join(", ") || "—";
    console.log(`  ${String(i + 1).padStart(2)}  tisk ${String(r.cislo ?? r.tiskId).padStart(4)}  ${r.origin.padEnd(10)}  churn ${String(r.maxTargetChurn).padStart(2)}  amends ${r.amendsCount}  sectorAdj: ${adjStr}  score ${r.triageScoreV2}  ${r.title.slice(0, 55)}`);
  });

  // Sector-adjacency summary across ALL flagged/pending bills (not just top-10) — the batch's headline number.
  const allAdjacent = rows.filter((r) => r.sectorAdjacency);
  console.log(`\nAll sector-adjacency hits (${allAdjacent.length}):`);
  for (const r of allAdjacent) console.log(`  tisk ${r.cislo}: ${r.sectorAdjacentCompanies.map((a) => `${a.company}(${a.sector})`).join(", ")}`);

  // Collision-candidate groups: laws amended by >1 PENDING bill (free, from `amends` — the
  // grouping step of the Q-law-4 pre-check; §-level confirmation is collision-check.ts).
  const collisionGroups = [...billsByLaw.entries()]
    .map(([urn, cislos]) => ({ lawUrn: urn, lawRef: String((lawByUrn.get(urn)?.props as Record<string, unknown>)?.ref ?? urn), lawTitle: lawByUrn.get(urn)?.label ?? "", bills: [...new Set(cislos)].filter((c) => c > 0) }))
    .filter((g) => g.bills.length > 1)
    .sort((a, b) => b.bills.length - a.bills.length);
  console.log(`\nCollision-candidate groups (same law, >1 bill): ${collisionGroups.length} groups, ${new Set(collisionGroups.flatMap((g) => g.bills)).size} distinct bills`);
  for (const g of collisionGroups) console.log(`  ${g.lawRef.padEnd(10)} × ${g.bills.length} bills: ${g.bills.join(", ")}`);

  mkdirSync(`${OUT_DIR}/payloads`, { recursive: true });
  writeFileSync(`${OUT_DIR}/payloads/collision-groups.json`, JSON.stringify({ generatedAt: new Date().toISOString(), method: "deterministic (amends edge join) — GROUPING only; §-level confirmation needs collision-check.ts", groups: collisionGroups }, null, 1));
  console.log(`\n→ wrote ${OUT_DIR}/payloads/collision-groups.json`);

  // Assign batch-002 to the pending top-N.
  const batchIds = new Set(pending.slice(0, top).map((r) => r.billNodeId));
  for (const r of rows) if (batchIds.has(r.billNodeId)) r.batch = 2;

  const ledger = {
    case: "law",
    generatedAt: new Date().toISOString(),
    source: "PGLITE_PATH copy (read-only)",
    batch002TriagePolicy: "churn PRIMARY, sector-adjacency SECONDARY (company-sectors.ts heuristic, excludes municipal/SOE), money log-scaled TERTIARY, amends quaternary",
    totals: {
      bills: rows.length,
      laws: laws.length,
      amends: amends.length,
      assignedTo: assigned.length,
      sectorAdjacencyHits: allAdjacent.length,
      municipalSoeExcludedBills: rows.filter((r) => r.municipalExcludedCompanies.length > 0).length,
      existingForensic: rows.filter((r) => r.forensicState).length,
      collisionCandidateGroups: collisionGroups.length,
      collisionCandidateBills: new Set(collisionGroups.flatMap((g) => g.bills)).size,
    },
    rows,
  };
  writeFileSync(`${OUT_DIR}/ledger.json`, JSON.stringify(ledger, null, 1));
  console.log(`\n→ wrote ${OUT_DIR}/ledger.json (${rows.length} rows, batch-002 head = top ${top} pending)`);
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
