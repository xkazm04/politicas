// Server-only: the company case file (/penize/firma/[ico]).
//
// A company is the graph's JUNCTION node — the entity a contract, a subsidy, a party
// donation and (for 14 of them) SEVERAL MPs all meet at. It has a stable id
// (`company:ico:<8-digit IČO>`) and, until this loader existed, no address: the ledger
// published one row per TIE and /penize/[pspId] published one MP's side of it, so the
// cross-MP fact — "these three MPs sit on the same board" — was computable and never
// published anywhere.
//
// READS ARE INDEXED ONLY. Three `kgNeighbours` calls per company (`loadCompanyMoneySlice`
// — ties, contracts, ownership), never a `listKgEdges`/`listKgNodes` relation scan: the
// whole money layer is ~307 000 rows and this page needs the two or three ties that touch
// one firm.
//
// TWO PAYLOADS, ONE READ (2026-08-12). The ownership block links every counterpart with a
// canonical IČO — Město Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo financí, the AGROFERT
// ancestors and eight private parents with no MP tie — and this loader used to bail on
// `ties.length === 0` BEFORE it ever looked at ownership, so all of those links landed on
// „the graph holds no MP tie for this company id": the product denying the very layer the
// reader had just clicked through. `getCompanyCaseFile()` therefore returns the money case
// file OR the register-only file (`CompanyRegistryFileData`), and `getCompanyDetail()` is
// the narrowing that keeps the money contract for `/overeni`.
//
// Since 2026-08-12 the payload also carries the firm's REGISTERED CORPORATE SURROUNDINGS
// (`ownership`, projected by the pure `ownership.ts`): who the register enters as its sole
// shareholder and which firms it is entered as the sole shareholder of. One hop, both
// directions, nothing inferred — and `null` for the 166 of 195 tied companies the graph
// carries no such record for, so the block is ABSENT rather than empty.
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";
import { loadCompanyMoneySlice, mapLinkedToTie, num, pspIdFromNodeId } from "./moneyLoader";
import { reachableMoney } from "./reachableMoney";
import { canonicalIco, companyNodeId } from "./companyId";
import {
  projectOwnership,
  type CompanyCaseFileData,
  type CompanyFileData,
  type CompanyRegistryFileData,
} from "./ownership";
import type { CompanyTie, ContractLine } from "./moneyTypes";

/** Contract lines rendered on the company page. The MP case file shows 8 of a firm's
 *  contracts because it shows several firms; this page IS one firm, so it can afford the
 *  ledger a reader came for. The remainder is stated as a count, never hidden. */
export const COMPANY_CONTRACT_LINES_SHOWN = 40;

/**
 * THE company read for the PAGE — one of two payloads, or `null`.
 *
 *  • `CompanyCaseFileData`     — the firm carries at least one `linked_to` tie: the full
 *                                case file, money included, unchanged since 6bc8780.
 *  • `CompanyRegistryFileData` — no tie, but the graph holds `owns_stake` around it. The
 *                                register surroundings, no money (see the type's header).
 *  • `null`                    — neither, or the store could not be read.
 *
 * The tie-less branch costs NO extra read: `loadCompanyMoneySlice` has fetched the
 * ownership neighbourhood unconditionally since it was written, precisely so a caller's
 * rendering decision could not silence a layer.
 */
export async function getCompanyCaseFile(
  icoRaw: string,
  /** The day the signature-plausibility bound is drawn against. Passed in, never read
   *  from the clock inside a render: `lib/analysis/plausible-date.ts` requires one
   *  instant for the whole page, and the page prints it. */
  todayIso: string,
): Promise<CompanyFileData | null> {
  try {
    const ico = canonicalIco(icoRaw);
    if (!ico) return null;

    const slice = await loadCompanyMoneySlice(companyNodeId(ico));
    if (!slice) return null;
    const {
      company,
      ties: tieEdges,
      personById,
      clubByPerson,
      contracts,
      lines,
      contractsTruncated,
      ownershipEdges,
      ownershipNodeById,
      pass,
    } = slice;

    const cp = company.props ?? {};
    // Zapsané okolí firmy — jeden krok, obě strany, nic dopočítaného. `null` znamená,
    // že graf o téhle firmě žádný zápis vlastnictví nevede, a blok se nevykreslí vůbec
    // (ownership.ts, pravidlo 5) — prázdná sekce by tvrdila, že jsme se dívali a nic
    // tam není, což je jiná věta než „tuhle vrstvu pro tuhle firmu nemáme".
    const ownership = projectOwnership({
      companyId: company.id,
      companyProps: cp,
      edges: ownershipEdges,
      nodeById: ownershipNodeById,
    });

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
    // Bez vazby na poslance tahle stránka NEVYDÁ peněžní spis — ale pořád může vydat to,
    // co graf o firmě skutečně drží. Rozhodnutí je binární a v tomhle pořadí schválně:
    // vazba → spis; žádná vazba, ale zapsané vlastnictví → rejstříkový výpis; ani jedno
    // → `null`, protože pro nic se adresa nerazí.
    //
    // PROVENIENCE SE TU NEDÁ VZÍT Z `pass`: ten je `ties[0].provenance.pass`, tedy 0.
    // Průchod téhle varianty je průchod VLASTNICKÝCH hran a nese si ho `ownership.pass`
    // (jednotný napříč vykreslenými řádky, jinak null) — stránka ho tiskne odtamtud,
    // nebo neuvede žádný.
    if (ties.length === 0) {
      if (!ownership) return null;
      const registryOnly: CompanyRegistryFileData = {
        variant: "registry-only",
        companyId: company.id,
        ico: String(cp.ico ?? ico),
        name: company.label,
        ownership,
      };
      return registryOnly;
    }

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
        // CO O SVÉM VLASTNÍM ČTENÍ VÍME, a nic víc. Bez `readScope` spouštěl tenhle
        // volající KORPUSOVOU heuristiku (`contractCoverage`) nad populací jedné firmy —
        // přesně to, před čím její vlastní hlavička varuje: `[3,3,3]` u tří malých firem
        // umí vyrobit „nejméně" a strop, který neexistuje. Slice odpověď ZNÁ (čtení buď
        // narazilo na vlastní limit, nebo ne), takže se nehádá.
        { readScope: contractsTruncated ? "slice-truncated" : "slice-complete" },
      ),
      ownership,
      subsidiesCount: num(cp.subsidies_count),
      subsidiesCzk: num(cp.subsidies_total_czk),
      donatedToPartyCzk: cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null,
      donationRecipientParty: cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getCompanyCaseFile", err);
    return null;
  }
}

/**
 * THE MONEY detail of one company — the narrowing `/overeni` asks for.
 *
 * A citation gate re-derives a FIGURE (`claim:…:dosah-firmy:company:ico:<ičo>`), and a
 * firm with no tie has no such figure: no tie means no tie class, no tie class means no
 * attribution rule, and `reachableMoney([])` would answer 0 Kč — a number the graph never
 * computed, handed back as „Ověřeno". So the registry-only payload is refused here rather
 * than flattened, and `features/overeni/liveFigures.ts` keeps answering
 * „záznam nenalezen" for those IČO, exactly as it does today. One read, one projection,
 * two entry points with two explicit contracts.
 */
export async function getCompanyDetail(
  icoRaw: string,
  todayIso: string,
): Promise<CompanyCaseFileData | null> {
  const file = await getCompanyCaseFile(icoRaw, todayIso);
  return file && !("variant" in file) ? file : null;
}
