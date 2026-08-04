// Server-only: the company case file (/penize/firma/[ico]).
//
// A company is the graph's JUNCTION node — the entity a contract, a subsidy, a party
// donation and (for 14 of them) SEVERAL MPs all meet at. It has a stable id
// (`company:ico:<8-digit IČO>`) and, until this loader existed, no address: the ledger
// published one row per TIE and /penize/[pspId] published one MP's side of it, so the
// cross-MP fact — "these three MPs sit on the same board" — was computable and never
// published anywhere.
//
// READS ARE INDEXED ONLY. Two `kgNeighbours` calls per company (`loadCompanyMoneySlice`),
// never a `listKgEdges`/`listKgNodes` relation scan: the whole money layer is ~307 000
// rows and this page needs the two or three ties that touch one firm.
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";
import { loadCompanyMoneySlice, mapLinkedToTie, num, pspIdFromNodeId } from "./moneyLoader";
import { reachableMoney } from "./reachableMoney";
import { canonicalIco, companyNodeId } from "./companyId";
import type { CompanyTie, ContractLine, MoneyCompanyDetail } from "./moneyTypes";

/** Contract lines rendered on the company page. The MP case file shows 8 of a firm's
 *  contracts because it shows several firms; this page IS one firm, so it can afford the
 *  ledger a reader came for. The remainder is stated as a count, never hidden. */
export const COMPANY_CONTRACT_LINES_SHOWN = 40;

export async function getCompanyDetail(
  icoRaw: string,
  /** The day the signature-plausibility bound is drawn against. Passed in, never read
   *  from the clock inside a render: `lib/analysis/plausible-date.ts` requires one
   *  instant for the whole page, and the page prints it. */
  todayIso: string,
): Promise<MoneyCompanyDetail | null> {
  try {
    const ico = canonicalIco(icoRaw);
    if (!ico) return null;

    const slice = await loadCompanyMoneySlice(companyNodeId(ico));
    if (!slice) return null;
    const { company, ties: tieEdges, personById, clubByPerson, contracts, lines, pass } = slice;

    const ties: CompanyTie[] = [];
    for (const e of tieEdges) {
      const person = personById.get(e.src);
      const pspId = pspIdFromNodeId(e.src);
      // An unresolved person side is dropped, never guessed — the same rule the ledger
      // applies, so the two surfaces cannot disagree about who is tied to this firm.
      if (!person || pspId == null) {
        console.warn(`[getCompanyDetail] dropping linked_to edge — person unresolved: ${e.src} -> ${e.dst}`);
        continue;
      }
      ties.push({
        // THE shared mapper. Not a projection of it — a prop the ledger's mapper learns
        // to read reaches this page in the same commit.
        ...mapLinkedToTie({ edge: e, company, contracts, person }),
        pspId,
        mpName: person.label,
        club: clubByPerson.get(pspId) ?? null,
      });
    }
    if (ties.length === 0) return null;

    // Strongest evidence first — the batch-005 review order, identical to the MP case
    // file's. NOT by money: this page must not read as a ranking of anything.
    ties.sort((a, b) => a.reviewRank - b.reviewRank || a.pspId - b.pspId);

    // A signature that could not have happened is not a date. The row and its amount
    // stay (the contract exists and carries a CZK figure), the date is dropped, and the
    // count is disclosed — never repaired. Same boundary as /poslanec and /dashboard.
    //
    // Counted over the rows that actually RENDER, not over everything fetched: a count
    // spanning rows the page never draws would be a claim about material the reader
    // cannot see, and the sentence beside it says "of the rows below".
    let implausibleDateCount = 0;
    const shown: ContractLine[] = lines.slice(0, COMPANY_CONTRACT_LINES_SHOWN).map((l) => {
      const signedOn = plausibleIsoDateOrNull(l.signedOn, todayIso);
      if (l.signedOn && !signedOn) implausibleDateCount += 1;
      return { ...l, signedOn };
    });

    const cp = company.props ?? {};
    return {
      companyId: company.id,
      ico: String(cp.ico ?? ico),
      name: company.label,
      ties,
      contracts: shown,
      contractsMoreCount: Math.max(0, contracts.count - COMPANY_CONTRACT_LINES_SHOWN),
      implausibleDateCount,
      asOf: todayIso,
      // THE shared definition. One company, so it collapses to a single row and exactly
      // one bucket carries it — WHICH one is the attribution rule's verdict for this
      // firm, and the page states that instead of printing a merged total.
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
      subsidiesCount: num(cp.subsidies_count),
      subsidiesCzk: num(cp.subsidies_total_czk),
      donatedToPartyCzk: cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null,
      donationRecipientParty: cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getCompanyDetail", err);
    return null;
  }
}
