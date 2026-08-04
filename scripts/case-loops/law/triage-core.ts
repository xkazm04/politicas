/* Case ③ Law loop — the SHARED triage computation (extracted batch-009).
 *
 * Why this file exists: `triage-002.ts` owned both the scoring logic AND a ledger writer
 * that REPLACES `ledger.json` wholesale. Re-running it to refresh the 141 rows (the item
 * deferred batch-006 → 007 → 008) would have erased every accumulated `totals.*` block —
 * the exact P44/D1 durability-contract failure the kernel names ("a human write layer over
 * a re-derivable ingest needs an explicit durability contract"). The alternative — copying
 * the scoring into a new batch-009 script — is the copy-drift bug class batch-008's own
 * lessons flagged (four `*-008.ts` scripts shipped byte-copied prose describing events that
 * never happened in batch-008).
 *
 * So the scoring lives here exactly ONCE. `triage-002.ts` keeps its original
 * replace-the-ledger behaviour (batch-002 semantics, unchanged); `retriage-009.ts` calls the
 * same function and merge-writes. Neither can drift from the other.
 *
 * Scoring policy is batch-002's, unchanged and deliberately so — this extraction is a
 * refactor, not a re-weighting. Any weight change belongs in its own batch with its own
 * validation (the kernel's "validate discriminative power before trusting a signal").
 */
import type { KgNodeRow } from "@/lib/db/types";
import type { Store } from "@/lib/db/store";

import { isMunicipalOrSoe, sectorOf, type Sector } from "./company-sectors";

export const THEME_KEYWORDS: Record<Sector, string[]> = {
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

/* batch-002 fix (P42): naive `.includes()` false-positives badly on Czech boilerplate — every
 * MP bill title carries "…na vydání zákona…", and "vydání" contains "daní" (genitive of
 * daň/tax) as a mid-word substring, so EVERY bill matched the "economy" domain. Word-boundary
 * regex, never substring. */
const KEYWORD_RE_CACHE = new Map<string, RegExp>();
function keywordHits(haystack: string, keyword: string): boolean {
  let re = KEYWORD_RE_CACHE.get(keyword);
  if (!re) {
    re = new RegExp(`(?<![\\p{L}])${keyword}`, "u");
    KEYWORD_RE_CACHE.set(keyword, re);
  }
  return re.test(haystack);
}

export function lawDomains(hay: string): Sector[] {
  const h = norm(hay);
  return (Object.entries(THEME_KEYWORDS) as [Sector, string[]][])
    .filter(([, kws]) => kws.some((k) => keywordHits(h, norm(k))))
    .map(([s]) => s);
}

export interface PriorRow {
  billNodeId: string;
  batch: number | null;
  signal: number | null;
  verdictFile?: string;
  forensicConfidence?: number;
}

export interface TriageRow {
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
  sectorAdjacency: boolean;
  /** `viaLaw` names the SPECIFIC amended law whose own label carries the company's sector
   * (batch-012 wiring of the batch-010 attributed signal), or null when the bill's OWN title
   * carries it. A flag without attribution no longer exists — union matching was degenerate
   * on high-amends bills (tisk 77 matched 9 of 10 sectors by union). */
  sectorAdjacentCompanies: { company: string; sector: Sector; sponsor: string; viaLaw: { ref: string; title: string } | null }[];
  municipalExcludedCompanies: string[];
  triageScoreV2: number;
}

export interface CollisionGroup {
  lawUrn: string;
  lawRef: string;
  lawTitle: string;
  bills: number[];
}

export interface TriageResult {
  rows: TriageRow[];
  collisionGroups: CollisionGroup[];
  counts: {
    bills: number;
    laws: number;
    amends: number;
    assignedTo: number;
    sectorAdjacencyHits: number;
    municipalSoeExcludedBills: number;
    existingForensic: number;
    collisionCandidateGroups: number;
    collisionCandidateBills: number;
  };
}

/** Recompute the full triage over whatever graph `store` points at.
 *
 * `priorByBill` carries forward the verdict bookkeeping (batch #, signal, verdictFile,
 * confidence) that is NOT derivable from the graph — pass the existing ledger's rows.
 * Everything else (amendedLaws, amendsCount, maxTargetChurn, sectorAdjacency, triageScoreV2)
 * is recomputed from the store, so the result reflects the CURRENT edge topology. */
export async function computeTriage(store: Store, priorByBill: Map<string, PriorRow>): Promise<TriageResult> {
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
  // person -> companies (private, sector-classifiable only)
  const companiesByPerson = new Map<number, { urn: string; label: string; czk: number }[]>();
  for (const e of linked) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    if (!m) continue;
    const id = Number(m[1]);
    const label = companyLabel.get(e.dst) ?? e.dst;
    companiesByPerson.set(id, [
      ...(companiesByPerson.get(id) ?? []),
      { urn: e.dst, label, czk: typeof e.weight === "number" ? e.weight : 0 },
    ]);
  }

  // A law's own domain set, from its own label alone — never the union (batch-012, wiring
  // batch-010's attributed signal: the union of all amended laws' labels was degenerate on
  // high-amends bills — mean domains matched rose 0.73 → 8.25 with amends count while a
  // title-only measure stayed flat, so a union match measured the bill's breadth, not the
  // sponsor). An adjacency flag must NAME the statute that carries the sector.
  const domainsOfLaw = new Map<string, Set<Sector>>();
  for (const l of laws) domainsOfLaw.set(l.id, new Set(lawDomains(l.label)));

  const rows: TriageRow[] = bills.map((b: KgNodeRow) => {
    const p = (b.props ?? {}) as Record<string, unknown>;
    const amendedUrns = lawsByBill.get(b.id) ?? [];
    const amendedRefs = amendedUrns.map((u) => String((lawByUrn.get(u)?.props as Record<string, unknown>)?.ref ?? u));
    const maxTargetChurn = Math.max(0, ...amendedUrns.map((u) => amendCountByLaw.get(u) ?? 0));
    for (const u of amendedUrns) billsByLaw.set(u, [...(billsByLaw.get(u) ?? []), Number((p.cislo as number) ?? 0)]);

    const titleDomains = new Set(lawDomains(b.label));

    // sector-adjacency: any sponsor's PRIVATE (non-municipal/SOE) company whose sector is
    // carried by a NAMED amended law's own label, or by the bill's own title.
    const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as number[]) : [];
    const adjacent: { company: string; sector: Sector; sponsor: string; viaLaw: { ref: string; title: string } | null }[] = [];
    const excluded: string[] = [];
    for (const sid of sponsorIds) {
      for (const c of companiesByPerson.get(sid) ?? []) {
        if (isMunicipalOrSoe(c.label)) {
          excluded.push(c.label);
          continue;
        }
        const sec = sectorOf(c.label);
        if (!sec) continue;
        const sponsor = personName.get(sid) ?? `#${sid}`;
        const viaUrn = amendedUrns.find((u) => domainsOfLaw.get(u)?.has(sec));
        if (viaUrn) {
          const l = lawByUrn.get(viaUrn);
          adjacent.push({ company: c.label, sector: sec, sponsor, viaLaw: { ref: String((l?.props as Record<string, unknown>)?.ref ?? viaUrn), title: l?.label ?? "" } });
        } else if (titleDomains.has(sec)) {
          adjacent.push({ company: c.label, sector: sec, sponsor, viaLaw: null });
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
    const sevBand = (forensicSeverity ? SEV[forensicSeverity] ?? 0 : 0) * 5_000_000;
    const churnBand = maxTargetChurn * 100_000; // PRIMARY
    const sectorAdjBand = adjacent.length > 0 ? 50_000 : 0; // SECONDARY
    const moneyLogBand = Math.round(Math.log10(1 + sponsorContractCzk) * 200); // TERTIARY
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

  const collisionGroups: CollisionGroup[] = [...billsByLaw.entries()]
    .map(([urn, cislos]) => ({
      lawUrn: urn,
      lawRef: String((lawByUrn.get(urn)?.props as Record<string, unknown>)?.ref ?? urn),
      lawTitle: lawByUrn.get(urn)?.label ?? "",
      bills: [...new Set(cislos)].filter((c) => c > 0),
    }))
    .filter((g) => g.bills.length > 1)
    .sort((a, b) => b.bills.length - a.bills.length);

  return {
    rows,
    collisionGroups,
    counts: {
      bills: rows.length,
      laws: laws.length,
      amends: amends.length,
      assignedTo: assigned.length,
      sectorAdjacencyHits: rows.filter((r) => r.sectorAdjacency).length,
      municipalSoeExcludedBills: rows.filter((r) => r.municipalExcludedCompanies.length > 0).length,
      existingForensic: rows.filter((r) => r.forensicState).length,
      collisionCandidateGroups: collisionGroups.length,
      collisionCandidateBills: new Set(collisionGroups.flatMap((g) => g.bills)).size,
    },
  };
}
