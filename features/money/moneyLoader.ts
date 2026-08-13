// Server-only: shared raw-data fetch for the /penize surfaces. Both getMoneyData.ts
// (the ledger) and getMpDetail.ts (the per-MP case file) walk the SAME materialized
// money layer of the knowledge graph — person --linked_to--> company --supplies-->
// contract — so this module is the single place that fetches it, keeping the two
// loaders from drifting (e.g. one aggregating contract amounts differently than the
// other). Degrades to null exactly like the loaders that use it: no store, no
// materialized money layer, or a fetch error → null, never a partial/guessed shape.
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore, type Store } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { asUnion } from "@/lib/db/narrow";
import { byListOrder } from "@/lib/db/kgOrder";
import { CORROBORATIONS, type ContractLine, type MoneyTie, type ReviewState } from "./moneyTypes";
// JEDNA hranice možného data v celé aplikaci (modul si to říká ve své hlavičce).
import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";
// One reader of `provenance`-shaped props across the platform (features/shared/provenance):
// the receipt page and the money tie must date an analyst note by the same rule.
import { toProvenance } from "@/features/shared/provenance/receipt";
import { edgeClaimRef } from "@/features/shared/provenance/claimRef";
import { isDeMinimis, nearThresholdCount, resolveReviewOrder, resolveTieClass, reviewSignal } from "./reviewTypes";
import { KG_READ_CAP } from "@/lib/db/readCap";
// Daňová základna smluvní částky. NULOVÉ NOVÉ ČTENÍ: obě čtení hran níž dělají
// `select * from kg_edge`, takže `props.amountBasis` je u ruky už dnes — fold ho
// jen zahazoval. Nic se tu nepřepočítává, počítají se ŘÁDKY podle základny.
import {
  basisComposition,
  countBasis,
  emptyBasisCounts,
  readAmountBasis,
  type BasisComposition,
  type BasisCounts,
} from "./amountBasis";
// ONE staleness bound over the graph's money layer, not a second one: /dashboard already
// declares how long a memoized money read may live (and prints it), and this memo caches
// the same layer for the same reason.
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";

const TERM = "PSP10";
const CONTRACT_LINES_PER_COMPANY = 400; // generous cap; UI slices its own top-N

/** `props` is a jsonb blob (see lib/db/types.ts) with no schema guarantee an
 * amount landed as a JS number rather than a numeric string. Treating every
 * non-number as "worth zero" conflates that common serialization shape with a
 * genuinely absent value, silently undercounting reachable money. Attempt a
 * real parse first; only a truly absent/unparseable value defaults to 0. */
export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
    console.warn(`[moneyLoader] num() could not parse numeric string: ${JSON.stringify(v)}`);
  }
  return 0;
}

export function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

/** Per-company contract aggregate. NO line items: a contract's label and signature date
 *  live on the `contract` NODE, and reading 152 788 of them costs 7.8 s to answer a
 *  question only the per-MP case file asks. Measured on the live store: of the 153 731
 *  `supplies` edges, 33 628 carry no weight — and every single one of those points at a
 *  contract node with no `amount` either, so the node scan contributed exactly 0 CZK to
 *  any aggregate. Line items are fetched per company on the case-file path
 *  (`loadMpMoneySlice`), where 8 of them render. */
export interface CompanyContracts {
  count: number;
  czk: number;
  amounts: number[]; // for near-threshold detection
  /**
   * Kolik smluv v `czk` stojí na které daňové základně. VOLITELNÉ, protože dva
   * volající drží literál `{count:0, czk:0, amounts:[]}` jako náhradu za firmu,
   * kterou čtení nevrátilo — a tam je prázdné složení právě správná odpověď
   * (`basisComposition(emptyBasisCounts())`, tedy `counted: 0`, ne nula na
   * některé straně). Kdekoli se skutečně četlo, pole je vyplněné.
   */
  basis?: BasisCounts;
}

/**
 * The ONE place a `linked_to` edge becomes a MoneyTie. Both /penize (ledger) and
 * /penize/[pspId] (case file) rendered the identical 25-field projection from
 * hand-copied blocks; a new tie prop had to be added twice and silently diverged
 * otherwise. `MoneyTieDetail` is this plus its contract lines — the caller
 * spreads and extends, it does not re-map.
 * See docs/architect/decisions/2026-07-26-money-tie-mapper-dedup.md.
 */
export function mapLinkedToTie(args: {
  edge: KgEdgeRow;
  company: KgNodeRow;
  contracts: CompanyContracts;
  /** the tied person node — only `absentee_manager_lead` is read (signal input). */
  person: KgNodeRow | undefined;
}): MoneyTie & { contractBasis: BasisComposition } {
  const { edge: e, company: comp, contracts, person } = args;
  const cp = comp.props ?? {};
  const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
  const reviewState: ReviewState =
    rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";

  const role = String(e.props?.role ?? "");
  const contractCzk = contracts.czk;
  const subsidiesCzk = num(cp.subsidies_total_czk);
  const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
  // Precedence, not recomputation: a class a reviewer or an analysis batch wrote onto the
  // edge wins over `classifyTie`'s substring guess (see resolveTieClass). The heuristic
  // travels along so the surface can show the disagreement instead of silently picking.
  const cls = resolveTieClass(e.props?.tie_class, role, comp.label);
  const tieClass = cls.tieClass;
  const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
  const near = nearThresholdCount(contracts.amounts);
  const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
  const corroboration = asUnion(e.props?.corroboration, CORROBORATIONS, null);
  const order = resolveReviewOrder({
    storedTier: e.props?.review_tier,
    storedRank: e.props?.review_rank,
    tieClass,
    corroboration,
    contractCzk,
    subsidiesCzk,
  });

  return {
    // Složení daňových základen ZA `contractCzk` — přes všechny smlouvy firmy,
    // odvozené z počtů, které fold už spočítal. Nic se nepřepočítává.
    contractBasis: basisComposition(contracts.basis ?? emptyBasisCounts()),
    companyId: comp.id,
    // The tie's PERMANENT citable address. Built from the edge's OWN endpoints (never
    // from a reconstructed `psp:person:<pspId>` string) with the shared `edgeClaimRef`
    // helper — the same one /rentgen and the /overeni guide use — so the ref that a
    // reader copies is by construction the triple `getReceiptData` will look up.
    receiptRef: edgeClaimRef(e.src, e.rel, e.dst),
    ico: String(cp.ico ?? comp.id.split(":").pop() ?? ""),
    company: comp.label,
    role,
    reviewState,
    source: String(e.props?.source ?? ""),
    contractCount: contracts.count,
    contractCzk,
    subsidiesCount: num(cp.subsidies_count),
    subsidiesCzk,
    donatedToPartyCzk,
    donationRecipientParty: cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
    // ARES-VR reconciliation (case-money batch 001/002) — absent on ties not yet
    // reconciled; the component renders that as "not checked", never as active.
    corroboration,
    roleValidFrom: (e.props?.role_valid_from as string | null | undefined) ?? null,
    roleValidTo: (e.props?.role_valid_to as string | null | undefined) ?? null,
    temporalStatus: (e.props?.temporal_status as string | null | undefined) ?? null,
    corroborationSource: (e.props?.corroboration_source as string | null | undefined) ?? null,
    corroborationProvenance: toProvenance(
      e.props?.corroboration_provenance as Record<string, unknown> | null | undefined,
    ),
    tieClass,
    tieClassOrigin: cls.origin,
    tieClassHeuristic: cls.heuristic,
    triangle,
    nearThresholdCount: near,
    deMinimis: isDeMinimis(contractCzk, subsidiesCzk),
    signalScore: reviewSignal({
      contractCzk,
      subsidiesCzk,
      tieClass,
      triangle,
      nearThresholdCount: near,
      donatedToPartyCzk,
      absenteeManagerLead,
    }),
    reviewTier: order.reviewTier,
    reviewRank: order.reviewRank,
    reviewOrderOrigin: order.origin,
    reviewNote: (e.props?.review_note as string | null | undefined) ?? null,
    reviewerNote: (e.props?.reviewer_note as string | null | undefined) ?? null,
    lastDecision: (e.props?.last_decision as string | null | undefined) ?? null,
    lastReviewer: (e.props?.last_reviewer as string | null | undefined) ?? null,
    lastReviewedAt: (e.props?.last_reviewed_at as string | null | undefined) ?? null,
    ownerStakePct: e.props?.owner_stake_pct != null ? num(e.props.owner_stake_pct) : null,
    priorTerm: (e.props?.prior_term as string | null | undefined) ?? null,
    falseEdgeSuspected: Boolean(e.props?.false_edge_suspected),
    flags: Array.isArray(e.props?.flags) ? (e.props.flags as string[]) : [],
  };
}

export interface MoneyLayer {
  companies: KgNodeRow[];
  persons: KgNodeRow[];
  linked: KgEdgeRow[];
  companyById: Map<string, KgNodeRow>;
  personById: Map<string, KgNodeRow>;
  clubByPerson: Map<number, string>;
  /** company kg_node id → its supplies-reachable contracts, aggregated + line items.
   *
   *  CONTAINS UNTIED COMPANIES. Since the batch-012 re-ingest the graph holds contracts
   *  for companies that are in it only as ownership PARENTS (Ministerstvo financí, Praha,
   *  ČSOB, České dráhy …) and have no `linked_to` tie to any MP at all — 6.68 tn CZK of
   *  public-body activity that no politician may be associated with. Anything that
   *  aggregates "money reachable through MPs" MUST intersect this with `tiedCompanyIds`
   *  (or iterate `linked`), never sum it whole. */
  contractsByCompany: Map<string, CompanyContracts>;
  /** Companies with at least one `linked_to` tie — the ONLY ones whose contracts may be
   *  attributed to a politician. Derived here so no consumer has to re-derive it (and get
   *  it wrong). */
  tiedCompanyIds: Set<string>;
  /** the pass that materialized the money layer (self-awareness surface). */
  pass: number;
  /** Kolik mandátů registr pro `TERM` nese — JMENOVATEL dlaždice „poslanci s vazbou".
   *  `null` = mandátové čtení selhalo; neznámý jmenovatel se nevykreslí, nikdy se
   *  nenahradí nulou ani literálem. */
  mandatesTotal: number | null;
}

/** Co mandátové čtení vrací: kluby (dekorace) a JEJICH POPULACE (údaj o ploše). */
export interface ClubRead {
  clubByPerson: Map<number, string>;
  /** Počet mandátových řádků registru pro `TERM`, nebo `null`, když se čtení
   *  nepovedlo. Do 2026-08-12 se tenhle počet přečetl a ZAHODIL, zatímco dlaždice
   *  „poslanci s vazbou" tiskla jmenovatel jako literál „207". */
  mandatesTotal: number | null;
}

/** personPspId → club abbreviation, plus kolik mandátů registr pro TERM nese.
 *  Registry tables, not the graph. Clubs are decorative here: their absence must
 *  never drop the money picture — proto se výjimka jen zaloguje a plocha dostane
 *  prázdnou mapu a `null` jmenovatel. */
async function readClubs(store: Store): Promise<ClubRead> {
  const clubByPerson = new Map<number, string>();
  let mandatesTotal: number | null = null;
  try {
    const mandates = await store.listMandates({ termCode: TERM, limit: KG_READ_CAP });
    mandatesTotal = mandates.length;
    const clubByMandate = await store.clubByMandate(TERM);
    for (const m of mandates) {
      const club = clubByMandate.get(m.pspId);
      if (club) clubByPerson.set(m.personPspId, club);
    }
  } catch (err) {
    console.warn("[moneyLoader] club resolution failed; continuing without clubs", err);
  }
  return { clubByPerson, mandatesTotal };
}

/* ── mandátový odečet, memoizovaný přes requesty ─────────────────────────────
 *
 * `readClubs` dělá DVA registrová čtení (`listMandates` + `clubByMandate`) a má tři
 * volající (peněžní vrstva, per-poslanecký řez, firemní řez), takže jeden request
 * /penize je zaplatí a další request je zaplatí znovu — a mandátový registr se mění
 * jen s ingestem, ne za běhu. Memo běží na TÉMŽE okně jako fold hran `supplies`
 * o pár řádků níž (`MONEY_MEMO_TTL_MS`, importované, nikdy nepředeklarované):
 * dvě memoizace nad jednou vrstvou na dvou hodinách jsou přesně to, jak dvě plochy
 * začnou tisknout dvě vintage jednoho čísla.
 *
 * NEMEMOIZUJE SE ANI PRÁZDNÝ ODEČET, ANI SELHÁNÍ — domácí pravidlo: `readClubs`
 * chybu polkne a vrátí prázdnou mapu s `mandatesTotal: null`, což je přesně tvar,
 * pod kterým by se přechodný výpadek PGlite na studeném startu zapamatoval na den
 * a dlaždice „poslanci s vazbou" by celou tu dobu neuváděla jmenovatel. */
let clubRead: Promise<ClubRead> | null = null;
let clubReadAt = 0;

export function loadClubs(store: Store): Promise<ClubRead> {
  if (clubRead !== null && Date.now() - clubReadAt >= MONEY_MEMO_TTL_MS) clubRead = null;
  if (clubRead === null) {
    clubReadAt = Date.now();
    clubRead = readClubs(store)
      .then((read) => {
        // Prázdný odečet není odečet: mandatesTotal null nebo nula = čtení se
        // nepovedlo (nebo registr nic nevrátil), a to se nepamatuje.
        if (read.mandatesTotal === null || read.mandatesTotal === 0) clubRead = null;
        return read;
      })
      .catch((err) => {
        clubRead = null;
        throw err;
      });
  }
  return clubRead;
}

/* ── the supplies fold, memoized across requests ─────────────────────────────
 *
 * `listKgEdges({rel:"supplies"})` returns ~153 731 rows and the fold below turns them
 * into a ~196-entry per-company aggregate. That aggregate changes only when the graph
 * is re-materialized by `npm run da:kg-compute` — never at request time — yet every
 * /penize and /penize/kontrola request re-read and re-folded the whole relation,
 * because `react.cache()` is scoped to ONE request.
 *
 * The memo is bounded by the SAME window the dashboard's money memo uses
 * (`features/dashboard/freshness.ts::MONEY_MEMO_TTL_MS`) — imported, not re-declared:
 * two memos over the same graph layer expiring on two different clocks is exactly how
 * two surfaces start printing two vintages of one number. A process-lifetime memo would
 * additionally make "how stale can this page be" unanswerable.
 *
 * Neither an empty read nor a failure is memoized: a transient PGlite hiccup on cold
 * start must not be cached for a day. */
let suppliesFold: Promise<Map<string, CompanyContracts>> | null = null;
let suppliesFoldAt = 0;

function foldSupplies(edges: readonly KgEdgeRow[]): Map<string, CompanyContracts> {
  const byCompany = new Map<string, CompanyContracts>();
  for (const e of edges) {
    const cur = byCompany.get(e.src) ?? { count: 0, czk: 0, amounts: [], basis: emptyBasisCounts() };
    const amount = num(e.weight);
    cur.count += 1;
    cur.czk += amount;
    if (amount > 0) cur.amounts.push(amount);
    // ŘÁDKY, NE KORUNY. Sčítá se počet smluv na dané základně; `czk` výš se tímhle
    // nedotkne ani o haléř (hlídá `amountBasis.test.ts`).
    countBasis(cur.basis ?? (cur.basis = emptyBasisCounts()), readAmountBasis(e.props));
    byCompany.set(e.src, cur);
  }
  return byCompany;
}

function contractsByCompanyMemo(store: Store): Promise<Map<string, CompanyContracts>> {
  if (suppliesFold !== null && Date.now() - suppliesFoldAt >= MONEY_MEMO_TTL_MS) suppliesFold = null;
  if (suppliesFold === null) {
    suppliesFoldAt = Date.now();
    suppliesFold = store
      .listKgEdges({ rel: "supplies", limit: KG_READ_CAP })
      .then((edges) => {
        if (edges.length === 0) suppliesFold = null; // don't memoize an absent layer
        return foldSupplies(edges);
      })
      .catch((err) => {
        suppliesFold = null; // don't memoize a transient failure
        throw err;
      });
  }
  return suppliesFold;
}

/** Test hook: drop the cross-request supplies memo. Nothing in the app calls it —
 *  it exists so a test that swaps the underlying store can do so explicitly rather than
 *  depending on module-instance isolation. */
export function resetSuppliesMemo(): void {
  suppliesFold = null;
  suppliesFoldAt = 0;
  clubRead = null;
  clubReadAt = 0;
  companySupplies.clear();
}

/**
 * The whole-corpus read, for the two surfaces that genuinely need every tie: the
 * `/penize` ledger and the `/penize/kontrola` console.
 *
 * `cache()`-wrapped, so a request that touches the ledger and something derived from it
 * pays for the layer once (the same treatment `getProfileData`, `getLawData` and
 * `getLeaderboardData` already have). React's `cache` is a no-op outside a request scope,
 * so tests and scripts still see a fresh read per call.
 */
export const loadMoneyLayer = cache(async function loadMoneyLayer(): Promise<MoneyLayer | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    // Three cheap kind/rel lists (632 rows on the live store) + ONE supplies scan.
    // The `contract` NODE scan that used to sit here is gone — see CompanyContracts.
    const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
    const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
    if (linked.length === 0 || companies.length === 0) return null;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));

    // The ~153 731-row supplies read + fold, memoized across requests (see above).
    const contractsByCompany = await contractsByCompanyMemo(store);

    const { clubByPerson, mandatesTotal } = await loadClubs(store);
    const pass = num((linked[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;
    const tiedCompanyIds = new Set(linked.map((e) => e.dst));

    return {
      companies,
      persons,
      linked,
      companyById,
      personById,
      clubByPerson,
      contractsByCompany,
      tiedCompanyIds,
      pass,
      mandatesTotal,
    };
  } catch (err) {
    reportLoaderFailure("moneyLoader.loadMoneyLayer", err);
    return null;
  }
});

/**
 * ONE company's contracts, read through the INDEX only (`kg_edge_src_idx`) — the
 * aggregate AND the line items in a single pass, so `/penize/[pspId]` and
 * `/penize/firma/[ico]` cannot report different money for the same firm.
 *
 * Weight ONLY — the identical rule the ledger's aggregate uses. The contract node is
 * read here for its label and signature date, not for a second amount source: measured
 * over all 153 731 `supplies` edges, every one of the 33 628 with no weight points at a
 * node with no `amount` either, so an `|| props.amount` fallback rescues nothing and
 * only creates a way for the two paths to drift.
 *
 * ORDERING: `kgNeighbours` orders by `weight desc nulls last`, which is NOT a total
 * order (contract amounts repeat densely), so the edge set is re-sorted into
 * `listKgEdges`' `(src, rel, dst)` order before anything reads it — including the CZK
 * sum, whose floating-point result depends on the addition order.
 */
export interface CompanySupplies {
  contracts: CompanyContracts;
  lines: ContractLine[];
  truncated: boolean;
}

async function readCompanySupplies(store: Store, companyId: string): Promise<CompanySupplies> {
  const supplied = await store.kgNeighbours({ id: companyId, rels: ["supplies"], limit: KG_READ_CAP });
  /* Truncation by the `warnIfTruncated` shape (lib/db/pglite/internals.ts): a read that
   * returned exactly its own limit is indistinguishable from one that was cut off. The
   * per-MP case file needs this ANSWER, not a guess — see reachableMoney's `readScope`:
   * a slice that read complete may not print a lower-bound claim, and one that did
   * truncate must. */
  const truncated = supplied.edges.length >= KG_READ_CAP;
  const edges = supplied.edges.filter((e) => e.src === companyId).sort(byListOrder);
  const nodeById = new Map(supplied.nodes.map((n) => [n.id, n]));
  const contracts: CompanyContracts = { count: 0, czk: 0, amounts: [], basis: emptyBasisCounts() };
  const lines: ContractLine[] = [];
  for (const e of edges) {
    const ct = nodeById.get(e.dst);
    const amount = num(e.weight);
    // Základna se čte z HRANY, ne z uzlu smlouvy: sklizeň ji zapisuje na obě
    // strany, ale hrana je to, co nese `weight`, tedy tu částku, která se sčítá.
    const amountBasis = readAmountBasis(e.props);
    contracts.count += 1;
    contracts.czk += amount;
    if (amount > 0) contracts.amounts.push(amount);
    countBasis(contracts.basis!, amountBasis);
    if (lines.length < CONTRACT_LINES_PER_COMPANY) {
      lines.push({
        id: e.dst,
        label: ct?.label ?? e.dst,
        amountCzk: amount > 0 ? amount : null,
        signedOn: (ct?.props?.signedOn as string | null | undefined) ?? null,
        amountBasis,
      });
    }
  }
  lines.sort((a, b) => (b.amountCzk ?? 0) - (a.amountCzk ?? 0));
  return { contracts, lines, truncated };
}

/* ── the per-company supplies read, memoized across requests ─────────────────
 *
 * One company's `supplies` slice changes only when the graph is re-materialized by
 * `npm run da:kg-compute` — never at request time — yet EVERY /penize/[pspId],
 * /penize/firma/[ico] and /poslanec/[id] request re-read it, because `cache()` is scoped
 * to ONE request. The MP case file pays it once per TIED COMPANY (median 3, max 14), and
 * the spis calls the same loader, so a firm tied to more than one MP was re-read once per
 * file that mentions it.
 *
 * SAME WINDOW as the two memos above (`MONEY_MEMO_TTL_MS`, imported from
 * features/dashboard/freshness.ts, never re-declared): three memos over one graph layer
 * on three clocks is exactly how two surfaces start printing two vintages of one number.
 *
 * NEITHER AN EMPTY READ NOR A FAILURE IS MEMOIZED — the `loadClubs` discipline: a company
 * that answered "no contracts" because PGlite hiccuped on a cold start must not keep
 * answering that for a day. The dropped cell is compared by IDENTITY before deletion, so
 * a later read that has already replaced it is never evicted by an earlier one's result.
 *
 * The map is bounded by the number of companies in the graph (~196 today) and every cell
 * is one small aggregate plus at most CONTRACT_LINES_PER_COMPANY line items. */
interface CompanySuppliesCell {
  at: number;
  read: Promise<CompanySupplies>;
}
const companySupplies = new Map<string, CompanySuppliesCell>();

function companySuppliesMemo(store: Store, companyId: string): Promise<CompanySupplies> {
  const hit = companySupplies.get(companyId);
  if (hit !== undefined && Date.now() - hit.at < MONEY_MEMO_TTL_MS) return hit.read;
  companySupplies.delete(companyId);
  const cell: CompanySuppliesCell = { at: Date.now(), read: readCompanySupplies(store, companyId) };
  // Identity-checked eviction: a cell that has ALREADY been replaced (an expiry between
  // issue and settle) must never be dropped by the older read's outcome.
  const drop = () => {
    if (companySupplies.get(companyId) === cell) companySupplies.delete(companyId);
  };
  cell.read = cell.read
    .then((res) => {
      // An absent slice is not an answer: a company the read returned nothing for is
      // re-read next time rather than remembered as contract-free for a day.
      if (res.contracts.count === 0) drop();
      return res;
    })
    .catch((err) => {
      drop();
      throw err;
    });
  companySupplies.set(companyId, cell);
  return cell.read;
}

/**
 * HRANICE MOŽNÉHO DATA, uplatněná na řádky smluv (2026-08-13).
 *
 * `/penize/firma/[ico]` tenhle test dělá od svého vzniku; `/penize/[pspId]`
 * četl `props.signedOn` bez kontroly a `MpCaseFilePage` ho tiskl doslova —
 * takže jedna a táž smlouva měla na jedné ploše datum potlačené a na druhé
 * vysázené („0002-01-01"), a paket poslance ho zapékal do otiskem
 * orazítkovaného svazku pro novináře.
 *
 * Verdikt se PŘIPÍNÁ, hrubá hodnota zůstává (proč — viz `ContractLine
 * .dateWithheldOn`): vysází se přes `displaySignedOn()`, takže datum, které se
 * nemohlo stát, se nikam nedostane, a přitom se nerozbije spis poslance, který
 * si svůj počet vadných dat z hrubé hodnoty přepočítává. Řádek ani částka se
 * nezahazují a datum se NIKDY neopravuje.
 *
 * ZÁMĚRNĚ MIMO `readCompanySupplies`: ten čtou OBĚ plochy a firemní spis si
 * svůj počet potlačených dat počítá SÁM, nad řádky, které opravdu vykresluje
 * (`getCompanyDetail`, `implausibleDateCount`) — a to číslo je už publikované.
 * Kdyby se hranice uplatnila ve sdíleném čtení, firemní stránce by napočítala
 * nulu. Řez poslance je proto jediné místo, kde se to tady dělá.
 */
export function gateContractDates(lines: readonly ContractLine[], todayIso: string): ContractLine[] {
  return lines.map((l) =>
    l.signedOn !== null && plausibleIsoDateOrNull(l.signedOn, todayIso) === null
      ? { ...l, dateWithheldOn: todayIso }
      : l,
  );
}

/** One MP's money, read through the INDEX only — never a whole-relation scan. */
export interface MpMoneySlice {
  person: KgNodeRow;
  club: string | null;
  /** the MP's `linked_to` edges, in `listKgEdges` order (see byListOrder). */
  ties: KgEdgeRow[];
  companyById: Map<string, KgNodeRow>;
  contractsByCompany: Map<string, CompanyContracts>;
  /** company id → its contract line items, amount desc, capped like the ledger's.
   *  Podpisy jsou už PROŠLÉ hranicí možného data (`gateContractDates`) — nemožné
   *  datum je potlačené a řádek si nese `dateWithheldOn`. */
  linesByCompany: Map<string, ContractLine[]>;
  /** Den, proti kterému se hranice kreslila (tiskne se, aby šel test zopakovat). */
  datesCheckedOn: string;
  /** Did ANY per-company supplies read hit its own cap? The slice knows this and the
   *  cap heuristic must not guess it — see reachableMoney.ts::ContractReadScope. */
  contractsTruncated: boolean;
  pass: number;
}

/**
 * The `/penize/[pspId]` read. Two index scans per tie instead of five whole-relation
 * scans per request: `kg_edge_src_idx` for the MP's `linked_to` edges (median 2, max 14
 * on the live store), then `kg_edge_dst_idx`/`src_idx` per tied company for its
 * `supplies` — and `kgNeighbours` returns the far-end nodes with them, so the contract
 * labels and signature dates arrive without a 152 788-row node scan.
 *
 * ORDERING. `kgNeighbours` orders by `weight desc nulls last`, which is NOT a total
 * order — `linked_to` weights are all null and contract amounts repeat, so Postgres may
 * return equal-weight rows in any order, differing between runs of the same build. Every
 * edge set here is re-sorted into `listKgEdges`' `(src, rel, dst)` order before anything
 * reads it: that keeps the render reproducible AND byte-identical to the scan-based
 * version this replaced, down to the floating-point order of the CZK sum.
 */
export const loadMpMoneySlice = cache(async function loadMpMoneySlice(
  pspId: number,
): Promise<MpMoneySlice | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    const personId = `psp:person:${pspId}`;
    const [person] = await store.getKgNodes([personId]);
    if (!person) return null;

    const tieRead = await store.kgNeighbours({ id: personId, rels: ["linked_to"], limit: KG_READ_CAP });
    // Only edges where this MP is the SOURCE are the MP's own ties; kgNeighbours'
    // second leg would also return an edge pointing AT the person node.
    const ties = tieRead.edges.filter((e) => e.src === personId).sort(byListOrder);
    if (ties.length === 0) return null;

    const companyById = new Map(
      tieRead.nodes.filter((n) => n.kind === "company").map((n) => [n.id, n] as const),
    );

    // PARALLEL, not serial. These are independent indexed reads with no ordering
    // relation at all, and the loop awaited them one by one — an MP with 14 tied
    // companies paid 14 round trips in series (the identical fix getProfileData's
    // prior-term membership reads already made). Results are consumed in
    // `companyById.values()` order, so both maps keep the insertion order the serial
    // loop produced and `contractsTruncated` folds over the same set.
    const companyReads = await Promise.all(
      [...companyById.values()].map(async (comp) => ({
        id: comp.id,
        supplies: await companySuppliesMemo(store, comp.id),
      })),
    );
    // JEDEN okamžik na celý řez (viz lib/analysis/plausible-date.ts): loader je
    // server, ne render, takže se hodiny číst smějí — a hodnota přechází ke
    // klientovi jako DATA. Počítá se AŽ TADY, za memoizovaným čtením smluv:
    // uvnitř `companySuppliesMemo` by se hranice zamrazila na den, kdy se buňka
    // naplnila, a den by pak zestárnul o celé okno TTL.
    // Týž tvar jako `/penize/firma/[ico]`, aby dvě sousední plochy nekreslily
    // hranici k jinému dni (pražský den deníku je vědomě jiné pravidlo — jeho
    // sjednocení by pohnulo publikovaným počtem firemního spisu, a to se sem
    // nepropašuje; viz zpráva k této změně).
    const datesCheckedOn = new Date().toISOString().slice(0, 10);
    const contractsByCompany = new Map<string, CompanyContracts>();
    const linesByCompany = new Map<string, ContractLine[]>();
    let contractsTruncated = false;
    for (const { id, supplies } of companyReads) {
      contractsByCompany.set(id, supplies.contracts);
      linesByCompany.set(id, gateContractDates(supplies.lines, datesCheckedOn));
      if (supplies.truncated) contractsTruncated = true;
    }

    const { clubByPerson } = await loadClubs(store);
    const pass = num((ties[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

    return {
      person,
      club: clubByPerson.get(pspId) ?? null,
      ties,
      companyById,
      contractsByCompany,
      linesByCompany,
      datesCheckedOn,
      contractsTruncated,
      pass,
    };
  } catch (err) {
    reportLoaderFailure("moneyLoader.loadMpMoneySlice", err);
    return null;
  }
});

/** One company's money and every MP tied to it — read through the INDEX only. */
export interface CompanyMoneySlice {
  company: KgNodeRow;
  /** the company's inbound `linked_to` edges, in `listKgEdges` order (see byListOrder). */
  ties: KgEdgeRow[];
  /** tied person node by kg id — the mapper reads `absentee_manager_lead` off it. */
  personById: Map<string, KgNodeRow>;
  clubByPerson: Map<number, string>;
  contracts: CompanyContracts;
  /** the company's contract line items, amount desc, capped like the case file's. */
  lines: ContractLine[];
  /** Did the supplies read hit its own cap? `readCompanySupplies` computes this and the
   *  slice used to DROP it, so the company case file ran `reachableMoney()` with no
   *  `readScope` at all — i.e. it let the CORPUS cap heuristic loose on a one-company
   *  population, the exact misuse `reachableMoney.ts::contractCoverage` warns about in
   *  its own header. Same field, same meaning and same reason as `MpMoneySlice
   *  .contractsTruncated`: the slice ANSWERS the floor question instead of guessing it. */
  contractsTruncated: boolean;
  /** The company's `owns_stake` edges in BOTH directions — inbound are the firms
   *  registered as its shareholder, outbound the firms it is registered as the
   *  shareholder of. One indexed read, both legs (see the loader's note). */
  ownershipEdges: KgEdgeRow[];
  /** Every node at the far end of `ownershipEdges`, by id — the parent/subsidiary
   *  labels AND the stored NENALEZENO annotations arrive with the edges, so the
   *  projection needs no second read. */
  ownershipNodeById: Map<string, KgNodeRow>;
  /** The pass that wrote the TIES — `ties[0].provenance.pass`, so it is **0 for a company
   *  with no tie at all**. A tie-less payload must therefore never print it as its
   *  provenance; the ownership layer carries its own (`OwnershipStructure.pass`, uniform
   *  across the drawn rows or null). */
  pass: number;
}

/**
 * The `/penize/firma/[ico]` read — the junction-node counterpart of `loadMpMoneySlice`.
 * Two indexed reads, no relation scan: `kg_edge_dst_idx` for the company's inbound
 * `linked_to` edges (and `kgNeighbours` hands back the person nodes with them), then
 * `readCompanySupplies` for its contracts.
 *
 * A company is the graph's JUNCTION node — 14 of them are tied to more than one MP — so
 * this is the only read in the feature that starts from the company rather than from a
 * person. `companyId` must already be canonical (`companyId.ts::companyNodeId`): an
 * unpadded IČO resolves to nothing here, silently.
 *
 * OWNERSHIP (2026-08-12) is a THIRD indexed read on the same node: `kgNeighbours` returns
 * the incident `owns_stake` edges in both directions at once, with the counterpart company
 * nodes — so the corporate surroundings (owners, subsidiaries and the stored NENALEZENO
 * annotations) cost one index hit, not a scan of the 33-row relation plus a node fetch.
 * Measured on the live corpus: 4 ms (1 edge, Plzeňské MDP) to 34 ms (4 edges, AGROFERT).
 * It runs unconditionally, including for a company with no `linked_to` tie: the slice
 * describes the graph around one node, and letting a caller's rendering decision silence
 * a layer is how a layer goes missing without anyone noticing.
 */
export const loadCompanyMoneySlice = cache(async function loadCompanyMoneySlice(
  companyId: string,
): Promise<CompanyMoneySlice | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    const [company] = await store.getKgNodes([companyId]);
    if (!company || company.kind !== "company") return null;

    const tieRead = await store.kgNeighbours({ id: companyId, rels: ["linked_to"], limit: KG_READ_CAP });
    // Only edges pointing AT the company are MP↔company ties; kgNeighbours' other leg
    // would also return an edge the company is the source of.
    const ties = tieRead.edges.filter((e) => e.dst === companyId).sort(byListOrder);
    const personById = new Map(
      tieRead.nodes.filter((n) => n.kind === "person").map((n) => [n.id, n] as const),
    );

    // Same memoized read the per-MP slice uses — one company's contracts must not have
    // two vintages depending on which case file asked for them.
    const { contracts, lines, truncated: contractsTruncated } = await companySuppliesMemo(
      store,
      companyId,
    );

    // Both legs are wanted here (owners AND subsidiaries), so nothing is filtered by
    // direction — but the set is still re-sorted into `listKgEdges` order: every
    // `owns_stake` weight is null, so `kgNeighbours`' `weight desc nulls last` leaves the
    // rows in an order Postgres may vary between runs of the same build.
    const ownershipRead = await store.kgNeighbours({
      id: companyId,
      rels: ["owns_stake"],
      limit: KG_READ_CAP,
    });
    const ownershipEdges = ownershipRead.edges.sort(byListOrder);
    const ownershipNodeById = new Map(ownershipRead.nodes.map((n) => [n.id, n] as const));

    const { clubByPerson } = await loadClubs(store);
    const pass = num((ties[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

    return {
      company,
      ties,
      personById,
      clubByPerson,
      contracts,
      lines,
      contractsTruncated,
      ownershipEdges,
      ownershipNodeById,
      pass,
    };
  } catch (err) {
    reportLoaderFailure("moneyLoader.loadCompanyMoneySlice", err);
    return null;
  }
});
