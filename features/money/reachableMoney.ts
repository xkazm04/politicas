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
  /**
   * The COMPANY axis of attribution (money batch 015): `false` when the register says
   * this company is publicly owned, so its turnover is a public body's own activity
   * whatever the MP's role in it is. `undefined` = the mandate sweep has not reached this
   * company; the tie class then decides alone, exactly as before.
   */
  publicMandateAttributable?: boolean | null;
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
 * Directions in which the register itself says the money did NOT reach this company.
 *
 * THE DEFECT THIS CLOSES (money batch 014). `supplies` used to mean "this company is a
 * party to this contract", and every koruna of every such contract was read as money
 * reaching the company. On a multi-party record that is false, and it was false at scale:
 * 11 771 399 678 CZK — 27.4 % of the attributable figure `/penize` rendered — sat on
 * contracts where the register explicitly names a DIFFERENT party as příjemce. 11.75 bn
 * of it was one company, Teplárny Brno a.s., appearing beside HOCHTIEF CZ a.s. on the
 * Brno multifunctional hall (4 444 444 444 CZK) and beside IMOS Brno / STRABAG /
 * Dopravní stavby Brno on four tram-Plotní agreements. Every one of those korun was being
 * attributed to the MP who chaired it.
 *
 * The edge is NOT dropped — Teplárny Brno really is a party to that contract, and a
 * platform whose brand rule is provenance may not delete a true relation to fix a false
 * number. What changes is that the value stops counting as reach, and the surface says so.
 *
 * `unknown` deliberately still counts: roughly half the register's records flag nobody at
 * all, and treating silence as a negative would be the mirror of the error being fixed.
 */
const NON_REACHING_DIRECTIONS: ReadonlySet<string> = new Set(["non-recipient", "payer"]);

/** Does this `supplies` edge's contract value reach the supplying company? */
export function moneyReachesCompany(props: Record<string, unknown> | null | undefined): boolean {
  return !NON_REACHING_DIRECTIONS.has(String(props?.direction ?? ""));
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
 * THE ATTRIBUTION RULE, both axes (money batch 015).
 *
 *   tie class      — the ROLE:    what the person does in the company.
 *   public mandate — the COMPANY: whose money it is.
 *
 * A single axis got this wrong in the expensive direction. Petr Hladík really was
 * `předseda představenstva` of Teplárny Brno a.s., so the role class `manager` is correct
 * — and `classifyTie` cannot see that the company is 100 % owned by Statutární město Brno,
 * because it reads a company NAME carrying no public marker. The result was **11,82 mld.
 * CZK of a municipal utility's turnover** rendered as money reaching a politician's firm,
 * the largest figure on the surface. The same held for Výstaviště Flora Olomouc and Lesy
 * města Olomouce (Statutární město Olomouc) — 12,75 mld. CZK across the three.
 *
 * Publicly-owned money is not dropped: it moves to the STEWARD bucket, which already
 * means "the institution's own public activity, never the MP's enrichment". That is what
 * it is, and the surface already knows how to say so.
 *
 * The mandate axis may only ever REMOVE attribution. A company the sweep has not reached
 * (`undefined`) is decided by the tie class alone, and a company whose ownership the
 * register does not publish stays attributable — silence is not evidence of public
 * ownership any more than it is of private ownership.
 */
export function tieIsAttributable(tie: Pick<ReachableTie, "tieClass" | "publicMandateAttributable">): boolean {
  if (tie.publicMandateAttributable === false) return false;
  return isAttributable(tie.tieClass);
}

/**
 * A tie → the shape `reachableMoney` reads. ONE projection, because there were four,
 * hand-copied, and money batch 015 added a field to the rule that three of them silently
 * did not carry — the corpus headline kept attributing 12,75 mld. CZK of municipally
 * owned money for exactly as long as it took to notice. A field added to `ReachableTie`
 * must reach every caller by construction, not by whoever remembers.
 *
 * `companyId` is overridable because one caller keys on the edge's `dst` rather than a
 * `companyId` field; everything else is read straight off the tie.
 */
export function toReachableTie(
  tie: Pick<
    ReachableTie,
    "tieClass" | "contractCount" | "contractCzk" | "subsidiesCzk" | "donatedToPartyCzk"
  > & { companyId?: string; publicMandateAttributable?: boolean | null },
  companyId?: string,
): ReachableTie {
  return {
    companyId: companyId ?? tie.companyId ?? "",
    tieClass: tie.tieClass,
    contractCount: tie.contractCount,
    contractCzk: tie.contractCzk,
    subsidiesCzk: tie.subsidiesCzk,
    donatedToPartyCzk: tie.donatedToPartyCzk,
    publicMandateAttributable: tie.publicMandateAttributable ?? null,
  };
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
 *
 * THIS IS A CORPUS-LEVEL STATISTIC AND ONLY THE CORPUS MAY RUN IT. It was calibrated on
 * the ~196-company money layer, where "3 companies share the maximum" is a signature. On
 * ONE MP's slice it is noise: the median MP has 3 tied companies (max 14, measured on the
 * live store), so three small firms that happen to have the same number of contracts —
 * `[3, 3, 3]` — satisfy `observedMax <= 100 && companiesAtCap >= 3` and the case file
 * starts printing „nejméně" plus a sentence naming a per-company cap that does not exist.
 * Eva Decroix's file sits at `[3, 3, 0]` today: ONE more three-contract company and a
 * complete read would have been published as a truncated one. Slices must therefore pass
 * `readScope` (below) instead of letting this function guess from their sample.
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

/**
 * What the CALLER knows about the completeness of its own contract read.
 *
 *  • absent          — the caller read the whole money layer (the ledger, the review
 *                      queue). `contractCoverage` may look for the cap signature.
 *  • "slice-complete"   — an indexed per-entity read that did NOT hit its limit. Its
 *                      figures are what the graph holds; the cap question belongs to the
 *                      corpus and this slice makes no claim about it.
 *  • "slice-truncated"  — the read hit its own cap, so the figures ARE a floor, for a
 *                      reason that has nothing to do with the ingest-time cap: the
 *                      per-company `perCompanyCap` is therefore null, not invented.
 */
export type ContractReadScope = "slice-complete" | "slice-truncated";

/** Coverage for a slice: never a cap signature, only what the read itself knows. */
export function sliceCoverage(scope: ContractReadScope): ContractCoverage {
  return { perCompanyCap: null, companiesAtCap: 0, isFloor: scope === "slice-truncated" };
}

/** Reachable public money for a set of ties — the ledger's whole population, one MP's
 *  case file, or the console's pending queue. Same rules for all three; the only thing a
 *  caller may vary is what it knows about ITS OWN read (`readScope`). */
export function reachableMoney(
  ties: readonly ReachableTie[],
  opts?: { readScope?: ContractReadScope },
): ReachableMoney {
  // Rule 1 + rule 3: collapse to one row per company first, deciding the bucket from
  // ALL of that company's ties rather than from whichever arrived first.
  const byCompany = new Map<string, { tie: ReachableTie; attributable: boolean }>();
  for (const t of ties) {
    const attributable = tieIsAttributable(t);
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
    // A slice never runs the corpus heuristic (see contractCoverage's header); the
    // corpus path is unchanged and stays byte-identical.
    coverage: opts?.readScope ? sliceCoverage(opts.readScope) : contractCoverage(counts),
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
  const attributable = tieIsAttributable(tie);
  return { czk: bucketReachCzk(attributable ? money.attributable : money.steward), attributable };
}
