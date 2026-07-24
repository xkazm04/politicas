// Server-only: the LawWatch (/zakony) real-graph loader. Mirrors
// features/votetrack/getVoteThemes.ts. Reads the materialized Case-③ legislation
// layer straight from the knowledge graph:
//   bill:tisk:<id>   nodes  (title, origin, submitter, amended_laws, sponsors,
//                            sponsor money/conflict flags, and — for the few bills
//                            that carry a gated forensic verdict — forensic_* props)
//   law:sb:<n>-<rok> nodes  (ref, esbirka_title)
//   amends edges            bill → law  (which print changes which statute)
// Sponsor osoba ids are resolved to names via listPersons.
//
// Degrades to null (→ the real sections are hidden, the page still renders) if no
// store is configured, no bill nodes have been materialized, or PGlite is
// unavailable. getStore() carries its own client guard, so this module must NEVER
// be imported into a client component (only `import type` is safe there).

import { getStore } from "@/lib/db/store";

export type BillOrigin = "government" | "mp" | "mp_group" | "senate" | "other";

/** A gated law-forensics verdict (method:"verdict", written pending_review). Rendered as DERIVED, never as raw fact. */
export interface LawForensicView {
  severity: "low" | "medium" | "high" | string;
  confidence: number | null;
  reviewState: string; // "pending_review"
  statedReasoning: string;
  researchedContext: string;
  conflictAssessment: string;
  unstatedEffects: { effect: string; whoBenefits: string; evidence: string }[];
  citations: { claim: string; kind: string; source: string }[];
  pass: number | null;
}

export interface AmendedLawRef {
  urn: string; // law:sb:586-1992
  ref: string; // "586/1992"
  label: string; // node label ("zákon č. 586/1992 Sb. — …")
  title: string | null; // esbirka_title, when the statute is in the e-Sbírka registry
}

/** Formal per-bill committee routing (assigned_to edge, F15 — psp.cz hist_vybory ⋈ hist). */
export interface CommitteeRoutingView {
  organUrn: string; // psp:organ:<id>
  organLabel: string; // výbor name (node label)
  role: "garancni" | "dalsi" | string; // garanční (věcně příslušný) vs a further committee
  status: "prikazano" | "navrzeno" | "iniciativne" | string; // strongest routing state reached
  assignedOn: string | null; // YYYY-MM-DD from the linked hist step
}

export interface LawBillView {
  tiskId: number;
  cislo: number | null; // public print number → psp.cz URL
  title: string; // official návrh title (node label)
  origin: BillOrigin;
  submitter: string | null; // ministry / MP names free text
  sponsors: { pspId: number; name: string }[]; // resolved MP sponsors (/poslanec/<pspId>)
  amendedLaws: AmendedLawRef[]; // statutes this print changes
  committees: CommitteeRoutingView[]; // formal committee routing (garanční first) — F15, may be empty
  flaggedConflict: boolean; // a sponsor has real money ties over the threshold
  sponsorContractCzk: number; // worst-case sponsor's flagged public-contract flow
  sponsorMoneyCompanies: number;
  forensic: LawForensicView | null;
}

export interface TopLawView {
  urn: string;
  ref: string;
  label: string;
  title: string | null;
  billCount: number; // how many prints amend it
}

export interface LawData {
  bills: LawBillView[]; // amends-carrying prints first, then by print number
  topLaws: TopLawView[]; // most-amended statutes, desc
  originCounts: Record<string, number>;
  totalBills: number;
  totalLaws: number;
  totalAmends: number;
  flaggedCount: number;
  forensicCount: number;
  committeeRoutedBills: number; // bills carrying ≥1 formal committee assignment (F15)
  pass: number | null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readForensic(p: Record<string, unknown>): LawForensicView | null {
  const state = asStr(p.forensic_review_state);
  const severity = asStr(p.forensic_severity);
  if (!state && !severity) return null;
  const prov = (p.forensic_provenance ?? {}) as Record<string, unknown>;
  const effects = Array.isArray(p.forensic_unstated_effects)
    ? (p.forensic_unstated_effects as unknown[]).flatMap((u) => {
        if (typeof u !== "object" || u === null) return [];
        const o = u as Record<string, unknown>;
        return [{
          effect: asStr(o.effect) ?? "",
          whoBenefits: asStr(o.whoBenefits) ?? "",
          evidence: asStr(o.evidence) ?? "",
        }];
      })
    : [];
  const citations = Array.isArray(p.forensic_citations)
    ? (p.forensic_citations as unknown[]).flatMap((c) => {
        if (typeof c !== "object" || c === null) return [];
        const o = c as Record<string, unknown>;
        return [{
          claim: asStr(o.claim) ?? "",
          kind: asStr(o.kind) ?? "",
          source: asStr(o.source) ?? "",
        }];
      })
    : [];
  return {
    severity: severity ?? "low",
    confidence: typeof p.forensic_confidence === "number" ? p.forensic_confidence : null,
    reviewState: state ?? "pending_review",
    statedReasoning: asStr(p.forensic_stated_reasoning) ?? "",
    researchedContext: asStr(p.forensic_researched_context) ?? "",
    conflictAssessment: asStr(p.forensic_conflict_assessment) ?? "",
    unstatedEffects: effects,
    citations,
    pass: typeof prov.pass === "number" ? prov.pass : null,
  };
}

export async function getLawData(): Promise<LawData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const billNodes = await store.listKgNodes({ kind: "bill", limit: 100_000 });
    if (billNodes.length === 0) return null;
    const lawNodes = await store.listKgNodes({ kind: "law", limit: 100_000 });
    const organNodes = await store.listKgNodes({ kind: "organ", limit: 100_000 });
    const amends = await store.listKgEdges({ rel: "amends", limit: 100_000 });
    const assignedTo = await store.listKgEdges({ rel: "assigned_to", limit: 100_000 });
    const persons = await store.listPersons();
    const nameById = new Map(persons.map((p) => [p.pspId, p.nameFull]));

    const lawByUrn = new Map(lawNodes.map((n) => [n.id, n]));
    const organLabelByUrn = new Map(organNodes.map((n) => [n.id, n.label]));

    // bill → formal committee routing (garanční first, then další), from the assigned_to edges.
    const ROLE_RANK: Record<string, number> = { garancni: 0, dalsi: 1 };
    const committeesByBill = new Map<string, CommitteeRoutingView[]>();
    for (const e of assignedTo) {
      const p = (e.props ?? {}) as Record<string, unknown>;
      const arr = committeesByBill.get(e.src) ?? [];
      arr.push({
        organUrn: e.dst,
        organLabel: organLabelByUrn.get(e.dst) ?? e.dst,
        role: asStr(p.role) ?? "dalsi",
        status: asStr(p.status) ?? "navrzeno",
        assignedOn: asStr(p.assignedOn),
      });
      committeesByBill.set(e.src, arr);
    }
    for (const arr of committeesByBill.values())
      arr.sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.organLabel.localeCompare(b.organLabel));

    // bill → the law urns it amends (from the edge table, the authoritative link)
    const lawsByBill = new Map<string, string[]>();
    const billCountByLaw = new Map<string, number>();
    for (const e of amends) {
      const arr = lawsByBill.get(e.src) ?? [];
      arr.push(e.dst);
      lawsByBill.set(e.src, arr);
      billCountByLaw.set(e.dst, (billCountByLaw.get(e.dst) ?? 0) + 1);
    }

    const lawRefOf = (urn: string): AmendedLawRef => {
      const n = lawByUrn.get(urn);
      const props = (n?.props ?? {}) as Record<string, unknown>;
      return {
        urn,
        ref: asStr(props.ref) ?? urn.replace(/^law:sb:/, "").replace("-", "/"),
        label: n?.label ?? urn,
        title: asStr(props.esbirka_title),
      };
    };

    const originCounts: Record<string, number> = {};
    let flaggedCount = 0;
    let forensicCount = 0;

    const bills: LawBillView[] = billNodes.map((n) => {
      const p = (n.props ?? {}) as Record<string, unknown>;
      const origin = (asStr(p.origin) ?? "other") as BillOrigin;
      originCounts[origin] = (originCounts[origin] ?? 0) + 1;
      const flagged = p.flagged_conflict === true;
      if (flagged) flaggedCount++;
      const forensic = readForensic(p);
      if (forensic) forensicCount++;

      const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as unknown[]) : [];
      const sponsors = sponsorIds
        .filter((id): id is number => typeof id === "number")
        .map((pspId) => ({ pspId, name: nameById.get(pspId) ?? `#${pspId}` }));

      const amendedUrns = lawsByBill.get(n.id) ?? [];
      const amendedLaws = amendedUrns.map(lawRefOf);
      const committees = committeesByBill.get(n.id) ?? [];

      return {
        tiskId: Number(n.id.replace(/^bill:tisk:/, "")) || 0,
        cislo: typeof p.cislo === "number" ? p.cislo : null,
        title: n.label,
        origin,
        submitter: asStr(p.submitter),
        sponsors,
        amendedLaws,
        committees,
        flaggedConflict: flagged,
        sponsorContractCzk: asNum(p.sponsor_contract_czk),
        sponsorMoneyCompanies: asNum(p.sponsor_money_companies),
        forensic,
      };
    });

    // Sort: prints carrying a forensic verdict first (the richest story), then
    // flagged-conflict prints, then those that amend the most statutes, then by
    // print number — so the default-selected bill is the most informative one.
    bills.sort((a, b) => {
      if (!!b.forensic !== !!a.forensic) return b.forensic ? 1 : -1;
      if (b.flaggedConflict !== a.flaggedConflict) return b.flaggedConflict ? 1 : -1;
      if (b.amendedLaws.length !== a.amendedLaws.length) return b.amendedLaws.length - a.amendedLaws.length;
      return (a.cislo ?? 1e9) - (b.cislo ?? 1e9);
    });

    const topLaws: TopLawView[] = [...billCountByLaw.entries()]
      .map(([urn, billCount]) => {
        const ref = lawRefOf(urn);
        return { urn, ref: ref.ref, label: ref.label, title: ref.title, billCount };
      })
      .sort((a, b) => b.billCount - a.billCount || a.ref.localeCompare(b.ref));

    const pass = billNodes.reduce<number | null>(
      (mx, n) => (typeof n.firstSeenPass === "number" ? Math.max(mx ?? 0, n.firstSeenPass) : mx),
      null,
    );

    return {
      bills,
      topLaws,
      originCounts,
      totalBills: billNodes.length,
      totalLaws: lawNodes.length,
      totalAmends: amends.length,
      flaggedCount,
      forensicCount,
      committeeRoutedBills: new Set(assignedTo.map((e) => e.src)).size,
      pass,
    };
  } catch {
    return null;
  }
}
