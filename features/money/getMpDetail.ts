// Server-only: full evidence chain for ONE MP — the /penize/[pspId] case-file
// surface. Reads the INDEXED per-MP slice (moneyLoader.ts::loadMpMoneySlice): the MP's
// own `linked_to` edges and, per tied company, its `supplies` edges with the contract
// nodes attached. It must NEVER scan a whole kg_edge/kg_node relation — opening one case
// file used to materialize the entire money layer (~307 000 rows, ~10.7 s) to render the
// two or three ties that belong to this person.
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { loadMpMoneySlice, mapLinkedToTie } from "./moneyLoader";
import { reachableMoney } from "./reachableMoney";
import type { MoneyMpDetail, MoneyTieDetail } from "./moneyTypes";

export const MP_CONTRACT_LINES_SHOWN = 8;

export async function getMoneyMpDetail(pspId: number): Promise<MoneyMpDetail | null> {
  try {
    const slice = await loadMpMoneySlice(pspId);
    if (!slice) return null;
    const { person, club, ties: tieEdges, companyById, contractsByCompany, linesByCompany, pass } = slice;

    const ties: MoneyTieDetail[] = [];
    for (const e of tieEdges) {
      const comp = companyById.get(e.dst);
      if (!comp) continue; // unresolved company → drop, never guess
      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [] };
      const lines = linesByCompany.get(comp.id) ?? [];

      ties.push({
        ...mapLinkedToTie({ edge: e, company: comp, contracts, person }),
        contracts: lines.slice(0, MP_CONTRACT_LINES_SHOWN),
        contractsMoreCount: Math.max(0, lines.length - MP_CONTRACT_LINES_SHOWN),
      });
    }
    if (ties.length === 0) return null;

    // Strongest evidence first: the batch-005 review order (reviewRank —
    // registry-confirmed owner-operator, then manager, then steward, then
    // unconfirmed/conflicting; reachable CZK only breaks ties within a tier).
    // A case file sorted by raw money buries an active, registry-confirmed
    // owner-operator tie under ended steward seats worth 40x more but worth
    // nothing as evidence (UX audit 2026-07-27, #4).
    ties.sort((a, b) => a.reviewRank - b.reviewRank);

    return {
      pspId,
      name: person.label,
      club,
      absenteeManagerLead: Boolean(person.props?.absentee_manager_lead),
      ties,
      // THE shared definition, same one the ledger and the console use — per-company
      // de-duplication and the steward/attributable split are not this surface's to opt
      // out of. The three raw `ties.reduce(...)` totals that used to sit here summed a
      // hospital's own contracting into the same headline number as a firm the MP owns.
      money: reachableMoney(
        ties.map((t) => ({
          companyId: t.companyId,
          tieClass: t.tieClass,
          contractCount: t.contractCount,
          contractCzk: t.contractCzk,
          subsidiesCzk: t.subsidiesCzk,
          donatedToPartyCzk: t.donatedToPartyCzk,
        })),
      ),
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyMpDetail", err);
    return null;
  }
}
