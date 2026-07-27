// Server-only: the review queue for /penize/kontrola — the human-verification console
// for the 260 pending MP↔company ties. Mirrors getMoneyData.ts's pattern (walk the
// materialized money layer of the knowledge graph, degrade to null when no store), but
// shapes ONE ROW PER PENDING TIE, enriched with the deterministic triage signals
// (tie class, triangle, near-threshold, parsed role period) and the primary-registry
// deep-links a reviewer needs. Read-only; it NEVER writes review_state — the write path
// is a fleet-mode handoff item.
//
// Called only from the /penize/kontrola server component; the `server-only`
// import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import {
  buildRegistryLinks,
  classifyTie,
  isDeMinimis,
  nearThresholdCount,
  parsePeriod,
  reviewRank,
  reviewSignal,
  reviewTier,
  type ReviewQueue,
  type ReviewState,
  type ReviewTie,
} from "./reviewTypes";

const TERM = "PSP10";

/** Same fix as moneyLoader.ts's num() — a jsonb amount prop with no schema
 * guarantee can land as a numeric string; treating every non-number as zero
 * silently undercounts reachable money instead of surfacing a parse problem. */
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
    console.warn(`[getVerificationData] num() could not parse numeric string: ${JSON.stringify(v)}`);
  }
  return 0;
}
function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

export async function getVerificationQueue(): Promise<ReviewQueue | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
    const contracts = await store.listKgNodes({ kind: "contract", limit: KG_READ_CAP });
    const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
    const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
    if (linked.length === 0 || companies.length === 0) return null;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));
    const contractById = new Map(contracts.map((c) => [c.id, c]));

    // company id → {count, czk, amounts[]} reachable via supplies
    const agg = new Map<string, { count: number; czk: number; amounts: number[] }>();
    for (const e of supplies) {
      const cur = agg.get(e.src) ?? { count: 0, czk: 0, amounts: [] };
      const ct = contractById.get(e.dst);
      const amount = num(e.weight) || num(ct?.props?.amount);
      cur.count += 1;
      cur.czk += amount;
      if (amount > 0) cur.amounts.push(amount);
      agg.set(e.src, cur);
    }

    // personPspId → club (clubByMandate keys on the mandate psp id)
    const clubByPerson = new Map<number, string>();
    try {
      const mandates = await store.listMandates({ termCode: TERM });
      const clubByMandate = await store.clubByMandate(TERM);
      for (const m of mandates) {
        const club = clubByMandate.get(m.pspId);
        if (club) clubByPerson.set(m.personPspId, club);
      }
    } catch (err) {
      // clubs are decorative here — absence must not drop the review queue.
      console.warn("[getVerificationQueue] club resolution failed; continuing without clubs", err);
    }

    const ties: ReviewTie[] = [];
    for (const e of linked) {
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";
      // the console shows the PENDING queue only — verified ties are resolved, and
      // rejected ties (D7, batch 004) are a terminal decision that must not be
      // re-served forever, same as verified.
      if (reviewState !== "pending_review") continue;

      const comp = companyById.get(e.dst);
      const pspId = pspIdFromNodeId(e.src);
      const person = personById.get(e.src);
      if (!comp || pspId == null) continue; // unresolved endpoint → drop, never guess

      const cp = comp.props ?? {};
      const a = agg.get(comp.id) ?? { count: 0, czk: 0, amounts: [] };
      const role = String(e.props?.role ?? "");
      const source = String(e.props?.source ?? "");
      const ico = String(cp.ico ?? comp.id.split(":").pop() ?? "");
      const { from, to } = parsePeriod(source);
      const tieClass = classifyTie(role, comp.label);
      const contractCzk = a.czk;
      const subsidiesCzk = num(cp.subsidies_total_czk);
      const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
      const near = nearThresholdCount(a.amounts);
      const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
      const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
      const corroboration = (e.props?.corroboration as ReviewTie["corroboration"]) ?? null;

      ties.push({
        id: `tie:${pspId}:${ico}`,
        src: e.src,
        dst: e.dst,
        pspId,
        mpName: person?.label ?? String(pspId),
        club: clubByPerson.get(pspId) ?? null,
        absenteeManagerLead,
        ico,
        company: comp.label,
        role,
        source,
        reviewState,
        tieClass,
        periodFrom: from,
        periodTo: to,
        contractCount: a.count,
        contractCzk,
        subsidiesCount: num(cp.subsidies_count),
        subsidiesCzk,
        donatedToPartyCzk,
        donationRecipientParty:
          cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
        triangle,
        nearThresholdCount: near,
        deMinimis: isDeMinimis(contractCzk, subsidiesCzk),
        corroboration,
        roleValidFrom: (e.props?.role_valid_from as string | null | undefined) ?? null,
        roleValidTo: (e.props?.role_valid_to as string | null | undefined) ?? null,
        temporalStatus: (e.props?.temporal_status as string | null | undefined) ?? null,
        signalScore: reviewSignal({
          contractCzk,
          subsidiesCzk,
          tieClass,
          triangle,
          nearThresholdCount: near,
          donatedToPartyCzk,
          absenteeManagerLead,
        }),
        reviewTier: reviewTier({ tieClass, corroboration }),
        reviewRank: reviewRank({ tieClass, corroboration, contractCzk, subsidiesCzk }),
        links: buildRegistryLinks(ico, source),
      });
    }

    // Batch-005: PRIMARY sort is the review-order axis (registry-confirmed
    // owner-operators → managers → confirmed stewards → unconfirmed, money desc within
    // tier) — this is what drives a real review session, not the raw story-worthiness
    // signalScore (still computed per-tie above and shown on the card for context).
    ties.sort((a, b) => a.reviewRank - b.reviewRank);

    const tierCounts: [number, number, number, number] = [0, 0, 0, 0];
    for (const t of ties) tierCounts[t.reviewTier] += 1;

    const stats = {
      pending: ties.length,
      ownerOperator: ties.filter((t) => t.tieClass === "owner-operator").length,
      manager: ties.filter((t) => t.tieClass === "manager").length,
      steward: ties.filter((t) => t.tieClass === "steward").length,
      triangles: ties.filter((t) => t.triangle).length,
      nearThreshold: ties.filter((t) => t.nearThresholdCount > 0).length,
      totalReachableCzk: ties.reduce((s, t) => s + t.contractCzk + t.subsidiesCzk, 0),
      tierCounts,
    };

    const pass = num((linked[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;
    return { ties, stats, source: "registr smluv ⋈ ares ⋈ hlídač státu", pass };
  } catch (err) {
    reportLoaderFailure("getVerificationQueue", err);
    return null;
  }
}
