// THE definition of "dosažitelné veřejné peníze" — reachable public money.
//
// The phrase used to mean two different numbers. `/penize` de-duplicated per company and
// split steward money out of the headline; `/penize/kontrola` summed per TIE across all
// classes, so the 14 companies tied to more than one MP were counted twice and a
// hospital's own contracting sat in the same total as a supplier an MP owns. The per-MP
// case file did a third thing: three tiles, no source, no class split. All three called
// the result the same Czech words.
//
// One definition, one implementation, three callers. Plain module (no server imports) so
// the loaders and the colocated test share it.
//
// THE RULES, in the order they matter:
//
//  1. A COMPANY is counted once. Money reaches the public through a company's contracts,
//     not through a tie; two MPs on the same board do not double the state's spending.
//  2. The steward/attributable split is NOT optional. A `steward` seat is a supervisory
//     or board seat in a public or nonprofit body — a hospital, a waterworks, a state
//     fund — and the contracts are that body's OWN public activity, never the MP's
//     enrichment. Since the batch-012 re-ingest steward money is ~91 % of the raw total,
//     so a single undifferentiated figure says something false at ten times the volume.
//     Every caller gets both parts and may render neither of them merged.
//  3. A company whose ties disagree about the class counts as ATTRIBUTABLE if ANY tie is
//     owner-operator or manager. Two companies on the live store are mixed (PRaK a.s. v
//     likvidaci at 0 CZK, AGROFERT a.s. at 8.7 M CZK). The rule this replaced used
//     whichever tie the relation scan happened to return first, which is not a rule.
//  4. A capped corpus yields a FLOOR, not a total — see `contractCoverage`.

import type { ContractCoverage, TieClass } from "./moneyTypes";

/** One tie, as the shared definition needs to see it. */
export interface ReachableTie {
  companyId: string;
  tieClass: TieClass;
  contractCount: number;
  contractCzk: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number | null;
}

/** One side of the split. Every figure is per-company de-duplicated. */
export interface MoneyBucket {
  companies: number;
  contractCount: number;
  contractCzk: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number;
}

export interface ReachableMoney {
  /** Companies an MP owns or runs (owner-operator / manager) — money the case's
   *  attribution rule permits reading as reaching the politician's own firms. */
  attributable: MoneyBucket;
  /** Public/nonprofit bodies where an MP holds a supervisory or board seat. The
   *  institution's own activity. NEVER fold this into the line above. */
  steward: MoneyBucket;
  /** attributable + steward, for the one place that legitimately wants the whole
   *  reachable surface (the ledger's "companies linked" scale). */
  totalCzk: number;
  /** Distinct companies behind the two buckets. */
  companies: number;
  coverage: ContractCoverage;
}

/**
 * Rule 2 as a PREDICATE — the one place that decides whether a tie's money may be read
 * as reaching the politician. It was re-implemented three times (here,
 * `features/dashboard/stateSlice.ts`, `features/denik/getDenikData.ts`); three copies of
 * a rule is three chances for one of them to drift into calling a hospital's contracting
 * an MP's money. Import it; never re-test the class inline.
 *
 * Takes a plain `string` on purpose: two of the three callers carry the class on a
 * projection typed `string` (`SliceTie`, the /denik role row), and forcing a cast at the
 * call site would just move the guesswork rather than remove it.
 */
export function isAttributable(tieClass: TieClass | string): boolean {
  return tieClass !== "steward";
}

/**
 * "Dosah" — the reach of one side of the split, in ONE arithmetic: the contracts the
 * state signed with those companies plus the subsidies they drew. Every surface that
 * prints a reach (the ledger's per-row column, the featured-case selection) goes through
 * this, so the page cannot hold two answers to the same question.
 */
export const bucketReachCzk = (b: MoneyBucket): number => b.contractCzk + b.subsidiesCzk;

const emptyBucket = (): MoneyBucket => ({
  companies: 0,
  contractCount: 0,
  contractCzk: 0,
  subsidiesCzk: 0,
  donatedToPartyCzk: 0,
});

/**
 * Is the underlying contract corpus a census or a capped per-company sample?
 *
 * The original money feed pulled a bounded page of contracts per company, so a run of
 * companies sitting at exactly the same maximum is the cap's signature, not a coincidence
 * (money batch 011: 35 companies at exactly 25). When it is capped, every CZK figure is a
 * FLOOR and the surface must say "nejméně" — rendering a truncated sum as "Σ hodnot
 * smluv" would present a lower bound as a total, which the brand rule forbids. Computed
 * from the data rather than hardcoded, so an uncapped re-ingest silently turns it off.
 *
 * A real ceiling is low AND shared by several companies; one big supplier that happens to
 * top the list is not a cap.
 */
export function contractCoverage(perCompanyCounts: readonly number[]): ContractCoverage {
  const observedMax = perCompanyCounts.length ? Math.max(...perCompanyCounts) : 0;
  const companiesAtCap = perCompanyCounts.filter((n) => n === observedMax).length;
  const isFloor = observedMax > 0 && observedMax <= 100 && companiesAtCap >= 3;
  return {
    perCompanyCap: isFloor ? observedMax : null,
    companiesAtCap: isFloor ? companiesAtCap : 0,
    isFloor,
  };
}

/** Reachable public money for a set of ties — the ledger's whole population, one MP's
 *  case file, or the console's pending queue. Same rules for all three. */
export function reachableMoney(ties: readonly ReachableTie[]): ReachableMoney {
  // Rule 1 + rule 3: collapse to one row per company first, deciding the bucket from
  // ALL of that company's ties rather than from whichever arrived first.
  const byCompany = new Map<string, { tie: ReachableTie; attributable: boolean }>();
  for (const t of ties) {
    const attributable = isAttributable(t.tieClass);
    const prev = byCompany.get(t.companyId);
    if (!prev) byCompany.set(t.companyId, { tie: t, attributable });
    else if (attributable) prev.attributable = true;
  }

  const attributable = emptyBucket();
  const steward = emptyBucket();
  const counts: number[] = [];
  for (const { tie, attributable: isAttributable } of byCompany.values()) {
    const b = isAttributable ? attributable : steward;
    b.companies += 1;
    b.contractCount += tie.contractCount;
    b.contractCzk += tie.contractCzk;
    b.subsidiesCzk += tie.subsidiesCzk;
    b.donatedToPartyCzk += tie.donatedToPartyCzk ?? 0;
    counts.push(tie.contractCount);
  }

  return {
    attributable,
    steward,
    totalCzk: attributable.contractCzk + steward.contractCzk,
    companies: byCompany.size,
    coverage: contractCoverage(counts),
  };
}

/**
 * The reach of ONE tie — the ledger's per-row „dosah" column and its sort key. A row is a
 * one-tie population, so it goes through the same function as every total rather than
 * re-adding `contractCzk + subsidiesCzk` at the cell (which is how the page grew a fourth
 * definition of reachable money, unlabelled, sitting in the alarm colour under a
 * steward's hospital). `attributable` is what the surface must colour and caption by.
 */
export function tieReach(tie: ReachableTie): { czk: number; attributable: boolean } {
  const money = reachableMoney([tie]);
  const attributable = isAttributable(tie.tieClass);
  return { czk: bucketReachCzk(attributable ? money.attributable : money.steward), attributable };
}
