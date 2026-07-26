// Server-only: full evidence chain for ONE MP — the /penize/[pspId] case-file
// surface. Same materialized money layer as getMoneyData.ts (via moneyLoader.ts),
// scoped to a single person, with each tie's reachable contracts expanded into
// line items (top-N shown, remainder counted, never dropped silently).
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "./moneyLoader";
import type { MoneyMpDetail, MoneyTieDetail } from "./moneyTypes";

export const MP_CONTRACT_LINES_SHOWN = 8;

export async function getMoneyMpDetail(pspId: number): Promise<MoneyMpDetail | null> {
  try {
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { persons, linked, companyById, personById, clubByPerson, contractsByCompany, pass } = layer;

    const personId = `psp:person:${pspId}`;
    const pnode = personById.get(personId) ?? persons.find((p) => pspIdFromNodeId(p.id) === pspId);
    if (!pnode) return null;

    const ties: MoneyTieDetail[] = [];
    for (const e of linked) {
      if (e.src !== pnode.id) continue;
      const comp = companyById.get(e.dst);
      if (!comp) continue; // unresolved company → drop, never guess
      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [], lines: [] };

      ties.push({
        ...mapLinkedToTie({ edge: e, company: comp, contracts, person: pnode }),
        contracts: contracts.lines.slice(0, MP_CONTRACT_LINES_SHOWN),
        contractsMoreCount: Math.max(0, contracts.lines.length - MP_CONTRACT_LINES_SHOWN),
      });
    }
    if (ties.length === 0) return null;

    ties.sort((a, b) => b.contractCzk + b.subsidiesCzk - (a.contractCzk + a.subsidiesCzk));

    return {
      pspId,
      name: pnode.label,
      club: clubByPerson.get(pspId) ?? null,
      absenteeManagerLead: Boolean(pnode.props?.absentee_manager_lead),
      ties,
      totalContractCzk: ties.reduce((s, t) => s + t.contractCzk, 0),
      totalSubsidiesCzk: ties.reduce((s, t) => s + t.subsidiesCzk, 0),
      totalDonatedCzk: ties.reduce((s, t) => s + (t.donatedToPartyCzk ?? 0), 0),
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyMpDetail", err);
    return null;
  }
}
