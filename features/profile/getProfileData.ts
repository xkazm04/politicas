// Server-only loader for /poslanec/<pspId> (MP profile) — reads ONE real person
// from the knowledge graph plus its edges. The `server-only` import makes any
// client-component import a build-time error (PGlite WASM). Degrades to null on any
// failure so the page can fall back gracefully.
//
// URL convention (shared across all cases): the route param is the plain integer
// psp person id from the node urn `psp:person:<pspId>` — NOT the colon urn.
//
// Body sections come straight from the graph edges:
//   co_votes_with   → nearest allies (top agreement)
//   rebels_against  → rebellions against own club
//   influential_in  → committee/commission seats
//   linked_to       → money ties (all pending_review; contracts attached only
//                     where the attribution rule allows — see ProfileMoneyTie)
//   spoke_on        → floor debates, per bill
//   proposes_amendment → written amendments, per bill
// The six contribution components + authoritative score come from the person
// node (see getLeaderboardData). No fabricated delta/trend/headline.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { byListOrder } from "@/lib/db/kgOrder";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import { publicCopyOrNull } from "@/lib/analysis/public-copy";
import {
  buildLeaderboard,
  CLUB_FALLBACK_COLOR,
  type LeaderboardData,
  type LeaderboardEntry,
} from "@/features/civicscore/getLeaderboardData";
import { isCommitteeSeat, type CommitteeSeat as ContributionCommitteeSeat } from "@/lib/analysis/contribution";
import { computeScoreLegibility, type ScoreLegibility } from "@/lib/analysis/score-legibility";
import { classifyRole, ROLE_WEIGHT } from "@/lib/analysis/kg";
import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";
import { classifyTie } from "@/features/money/reviewTypes";
import { CORROBORATIONS } from "@/features/money/moneyTypes";
import type { Corroboration, ReviewState, TieClass } from "@/features/money/moneyTypes";

const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Per-company `supplies` read cap for the Peníze section. Only attributable
 *  (owner-operator / manager) companies are read at all; the biggest of them
 *  holds 2 387 contracts, so this sits comfortably above the corpus while still
 *  bounding one page. Hitting it flips `contractsTruncated` and the section then
 *  renders the CZK figure as a floor rather than a total. */
const PROFILE_SUPPLIES_CAP = 5_000;
/** Contract lines shown per tie; the remainder is counted, never dropped. */
const PROFILE_CONTRACT_LINES = 5;

export interface CoVoter {
  pspId: number;
  name: string;
  clubAbbrev: string;
  clubColor: string;
  agreement: number; // 0–1
  shared: number; // ballots compared
}

export interface Rebellion {
  club: string; // club rebelled against
  rate: number; // 0–1
  rebelVotes: number;
  eligibleVotes: number;
}

export interface CommitteeSeat {
  abbrev: string;
  organType: string | null;
  role: string; // "member" | "předseda" | …
  weight: number; // role rank
  // batch-006 (Case ② effort loop): current/past window, so a seat vacated on taking a
  // ministerial post doesn't render as an active committee membership. This profile section
  // had the same defect as the effort army's extract-dossiers.ts, since it also read
  // influential_in edges — which are built only over organs that are DIRECT CHILDREN of the
  // chamber AND typed /v[ýy]bor|komis/i (so "Delegace" seats vanish), and which carry no
  // fromAt/toAt at all.
  current: boolean;
  fromAt: string | null;
  toAt: string | null;
  /** `toAt` is present but not a parseable date. Such a seat used to fall into
   * `Date.parse(...) > now === false` and render as an ENDED seat — an unreadable
   * end date silently presented as a fact about the MP. It is now rendered as a
   * seat whose end date could not be read, which is what the data actually says. */
  toAtUnreadable: boolean;
}

/** A bill this MP sponsors, resolved to its psp.cz historie.sqw link.
 * IMPORTANT: the URL is built from `cislo` (the public print number), NEVER
 * from the internal `tiskId` — the two are unrelated ids and historie.sqw
 * only resolves the former (batch-005 handoff §"known gotcha", independently
 * rediscovered by multiple effort-loop army groups). `cislo === null` (rare,
 * ingest gap) renders the title with no link rather than a broken one. */
export interface SponsoredBill {
  cislo: number | null;
  title: string;
  url: string | null;
  /** Internal dossier route (/zakony/<cislo>) — the app's own bill detail. */
  appUrl: string | null;
  /** Signature role from predkladatel.poradi (pass 34): rank 1 = předložil,
   * else spolupodepsal; null when the edge predates the roles backfill. */
  role: "predkladatel" | "spolupodepsal" | null;
  joinedLater: boolean;
  /** Current procedural state (Czech typ_stavu name) + Sbírka publication when
   * the print became law — both from psp.cz tisky/hist (pass 34), never derived. */
  stav: string | null;
  fateSb: string | null;
}

/** A bill this MP is zpravodaj (rapporteur) for — the assigned analytical role,
 * a stronger work signal than co-signature (psp.cz hist/hist_vybory/tisky_za). */
export interface RapporteurBill {
  cislo: number | null;
  title: string;
  appUrl: string | null;
  url: string | null;
  scopes: string[];
}

/** One reachable contract line under an attributable tie. */
export interface ProfileContractLine {
  id: string;
  title: string;
  amountCzk: number | null;
  /** `signedOn` ONLY when it is a date that could have happened — see
   *  `lib/analysis/plausible-date.ts`. A garbage date is never repaired. */
  signedOn: string | null;
  /** The row carries a `signedOn` the corpus cannot support; the date is
   *  withheld and the row says so rather than vanishing. */
  dateUnusable: boolean;
}

/**
 * One `linked_to` tie as the SPIS renders it.
 *
 * Money is attached ONLY where /penize's attribution rule allows it to be read
 * as the politician's: `owner-operator` and `manager`. A `steward` tie is a
 * supervisory seat on a public body — that body's contracts are its own public
 * activity (457,3 mld Kč of the reachable total, ~91 %), and printing them on a
 * person's file is how a hospital's budget becomes an accusation. Steward rows
 * therefore carry the seat, the period and the registry links, and NO CZK.
 */
export interface ProfileMoneyTie {
  companyId: string;
  ico: string;
  company: string;
  role: string;
  tieClass: TieClass;
  reviewState: ReviewState;
  /** Verbatim provenance string from the edge — cited, never re-worded. */
  source: string;
  corroboration: Corroboration | null;
  temporalStatus: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  /** null on a steward tie: the money is not this person's to report. */
  contractCount: number | null;
  contractCzk: number | null;
  /** The tie's biggest contracts by amount (the rest are counted, not dropped). */
  topContracts: ProfileContractLine[];
  contractsMoreCount: number;
  /** `supplies` came back exactly at the read cap → the CZK figure is a floor. */
  contractsTruncated: boolean;
}

/** The Peníze section's whole payload. Empty `ties` is a real answer, not a gap. */
export interface ProfileMoney {
  ties: ProfileMoneyTie[];
  /** Σ contracts of the firms this MP owns or runs — the only sum the file claims. */
  attributableCzk: number;
  attributableContracts: number;
  /** How many of the ties are steward seats whose money is deliberately not summed. */
  stewardTies: number;
  pendingTies: number;
  verifiedTies: number;
  /** Contract rows whose signature date the corpus cannot support (kept, dated-suppressed). */
  unusableDates: number;
  /** True when any tie hit the per-company read cap → every CZK figure is a floor. */
  anyTruncated: boolean;
  /** kg pass that materialized the money layer — cited on-page. */
  pass: number | null;
}

/**
 * One bill this MP engaged with beyond signing it — a floor debate or a written
 * amendment. Both come from the pass-35 engagement layer over psp.cz's own
 * records (`spoke_on` from steno/rec, `proposes_amendment` from sd_dokument
 * typ 13) and both are per-BILL, so the profile can print what the work was
 * about instead of a bare total.
 */
export interface BillEngagement {
  cislo: number | null;
  title: string;
  appUrl: string | null;
  url: string | null;
  /** speaking turns on this bill, or written amendments filed to it. */
  count: number;
}

export interface ProfileData {
  person: LeaderboardEntry; // includes rank
  total: number; // 207
  prevPspId: number;
  nextPspId: number;
  components: LeaderboardData["components"];
  /**
   * Per-component legibility: this MP's value in the component's OWN unit, the
   * scorer's cap, the chamber median, and the rank the real ranked chamber would
   * put them at with that component saturated. All DERIVED (labelled as such
   * on-page) and computed from the chamber pass the loader has already done —
   * no second read. See lib/analysis/score-legibility.ts.
   */
  legibility: ScoreLegibility;
  coVoters: CoVoter[];
  rebellions: Rebellion[];
  committees: CommitteeSeat[];
  /**
   * The date the committee seats' current/past split was evaluated against.
   * The page states it, because `/poslanec/<id>` is statically generated: without
   * it the reader has no way to know how old "současné" is. Paired with the
   * route's `revalidate`, which bounds how stale it can get.
   */
  seatsAsOf: string; // ISO yyyy-mm-dd
  /** Contribution-index pass that authored this MP's score — cited on-page. */
  provenancePass: number | null;
  // Tenure annotation (batch 003, Q-effort-5) — deterministic, from
  // membership.fromAt/toAt on organ 174. May be absent for the ~0/207 MPs
  // missing a chamber membership row (see tenure.ts's `missing` list).
  effortTenureDays: number | null;
  effortTenureClass: string | null;
  effortTenureStart: string | null;
  effortTenureEnd: string | null;
  // Dossier layer (batch 001+, effort-loop enrichment) — free-text/array props
  // written by a deterministic-gated Sonnet/Opus pipeline from psp.cz + public
  // registries (lib/analysis/*, scripts/case-loops/effort/*), never ad hoc.
  // 165/207 MPs carry at least one of these as of batch 005; graceful null for
  // the rest — see ProfilePage's DossierSection for the render-or-omit rule.
  effortWorkThemes: string[] | null;
  effortBillFocus: string | null;
  effortNotes: string | null;
  effortDataFlag: string | null;
  sponsoredBills: SponsoredBill[];
  /** Q-effort-2 split of bills_authored (pass 34): first-signatory vs co-signer
   * counts over the same universe — sums to bills_authored, which stays untouched. */
  billsFirstSigned: number | null;
  billsCoSigned: number | null;
  rapporteurBills: RapporteurBill[];
  /** Written amendments authored on the graph's law bills (pass 35, sd_dokument typ 13). */
  amendmentsAuthored: number | null;
  /** Floor debates, per bill (`spoke_on`). Covers ONLY bills the graph carries —
   *  `person.speechTurns` is the MP's whole floor record, of which this is the part
   *  that can be tied to a print. The section says so. */
  floorSpeeches: BillEngagement[];
  /** Σ `floorSpeeches[].count` — turns attributable to a bill in the graph. */
  floorSpeechTurns: number;
  /** Written amendments, per bill (`proposes_amendment`). */
  amendmentBills: BillEngagement[];
  /** Σ `amendmentBills[].count` — compared against `amendmentsAuthored` on-page, so
   *  a breakdown that does not account for the whole total admits the gap. */
  amendmentBillCount: number;
  /**
   * Three counters the index consumed but the profile never showed. Read straight
   * off the person node (not off `LeaderboardEntry`, whose `num()` turns an ABSENT
   * prop into 0) so a node without the prop can say "údaj v grafu chybí" instead of
   * asserting that the MP never spoke, never interpellated, and was never absent.
   */
  speechTurnsTotal: number | null;
  interpellations: number | null;
  absenceRate: number | null;
  /** `linked_to` money ties (all `pending_review` at pass 41) + the contracts the
   *  attribution rule permits attaching to them. See `ProfileMoney`. */
  money: ProfileMoney;
}

export async function getAllProfilePspIds(): Promise<number[]> {
  const built = await buildLeaderboard();
  if (!built) return [];
  return built.data.entries.map((e) => e.pspId);
}

/**
 * ONE MP, ONE PASS.
 *
 * `react.cache` wrapper: `generateMetadata` and the page body both call this for
 * the same pspId in one request — unwrapped, that was two full pipelines per
 * render and 414 of them for a 207-page static build.
 *
 * Edge reads go through `store.kgNeighbours()`, which hits the `kg_edge_src_idx` /
 * `kg_edge_dst_idx` btrees for this ONE node id. The previous shape read four
 * WHOLE relations (`co_votes_with` alone is 20 496 rows) and filtered each down
 * to one person in JS. Person props and organ rows come from `buildLeaderboard()`'s
 * `directory` — the chamber pass has already read both, so this loader re-reads
 * neither (it used to read person nodes a third time and the organ table a second
 * time, at a different limit).
 *
 * Ordering note: `kgNeighbours` orders by `weight desc`, and Postgres gives NO
 * stable order for equal weights — co-voting agreement is stored rounded to 3 dp,
 * so ties are dense — measured: leaving the tie-break to the database reordered
 * the ally list of 202 of the 207 MPs. The edge set is re-sorted into `listKgEdges`'
 * `(src, rel, dst)` order before anything downstream reads it, which (a) makes the
 * render reproducible build-to-build and (b) keeps it byte-identical to the
 * whole-relation-scan version this replaced.
 */
export const getProfileData = cache(async function getProfileData(pspId: number): Promise<ProfileData | null> {
  try {
    const built = await buildLeaderboard();
    if (!built) return null;
    const { data, directory } = built;
    const entries = data.entries;
    const idx = entries.findIndex((e) => e.pspId === pspId);
    if (idx === -1) return null;
    const person = entries[idx];

    const store = await getStore();
    if (!store) return null;
    // No storeReady() here: buildLeaderboard() returning non-null already proves
    // the `person` slice is materialized — the second probe was a pure duplicate.

    const selfId = `psp:person:${pspId}`;

    // ONE indexed read for every per-MP relation this page renders. `nodes` is the
    // distinct far end of those edges: the ally persons, the club/party node behind
    // rebels_against, the bill nodes behind sponsors/rapporteur, and the company
    // nodes behind linked_to — which is why there is no separate party-, bill- or
    // company-node read below any more.
    const { edges: incidentEdges, nodes: incidentNodes } = await store.kgNeighbours({
      id: selfId,
      rels: [
        "co_votes_with",
        "rebels_against",
        "sponsors",
        "rapporteur",
        "linked_to",
        "spoke_on",
        "proposes_amendment",
      ],
      limit: KG_READ_CAP,
    });
    incidentEdges.sort(byListOrder);
    const edgesByRel = (rel: string) => incidentEdges.filter((e) => e.rel === rel);

    // co_votes_with — undirected; take the top allies by agreement weight.
    const coVoters: CoVoter[] = edgesByRel("co_votes_with")
      .map((e) => {
        const otherId = e.src === selfId ? e.dst : e.src;
        const otherPspId = Number(otherId.split(":").pop());
        const club = directory.clubByPersonPspId.get(otherPspId) ?? null;
        return {
          pspId: otherPspId,
          name: directory.nameByPspId.get(otherPspId) ?? `#${otherPspId}`,
          clubAbbrev: club ?? "—",
          clubColor: clubColorFor(club, entries),
          agreement: num(e.weight),
          shared: num((e.props as { shared?: unknown }).shared),
        };
      })
      // A co_votes_with edge pointing at a malformed/non-person node id (a
      // data-quality slip in the knowledge-graph ingest) makes otherPspId NaN
      // — rendered as a dead /poslanec/NaN link presented as a legitimate ally
      // with no visual indication anything is wrong. Drop rather than guess.
      .filter((cv) => Number.isFinite(cv.pspId))
      // Stable sort over the (src, rel, dst)-ordered edge set — equal-agreement
      // allies keep the node-id order the previous whole-relation read produced.
      .sort((a, b) => b.agreement - a.agreement)
      .slice(0, 8);

    // rebels_against — dst is the club/party node; its label is the club.
    const partyLabelById = new Map(incidentNodes.filter((n) => n.kind === "party").map((p) => [p.id, p.label]));
    const rebellions: Rebellion[] = edgesByRel("rebels_against")
      .filter((e) => e.src === selfId)
      .map((e) => {
        const props = e.props as { club?: string; rebelVotes?: unknown; eligibleVotes?: unknown };
        return {
          club: props.club ?? partyLabelById.get(e.dst) ?? "—",
          rate: num(e.weight),
          rebelVotes: num(props.rebelVotes),
          eligibleVotes: num(props.eligibleVotes),
        };
      })
      .sort((a, b) => b.rate - a.rate || a.club.localeCompare(b.club, "cs"));

    // committees — rebuilt from raw membership rows (NOT influential_in edges), the same
    // basis kg-contribution-ingest.ts feeds computeContribution for committee_count (see
    // extract-dossiers.ts's batch-006 note for the measured root cause). influential_in
    // undercounted here because kg-compute builds it only over organs that are DIRECT
    // CHILDREN of the chamber and typed /v[ýy]bor|komis/i — which excludes "Delegace"
    // (39/207 MPs affected) — and because those edges carry no fromAt/toAt at all, so a
    // seat vacated for a ministerial post rendered as an active committee membership.
    const term = "PSP10";
    const memberships = await store.listMemberships({ termCode: term });
    // Organs come from the chamber pass's single read (directory.organByPspId) —
    // this loader used to issue a SECOND full `organ` scan at limit 3000 against
    // buildLeaderboard's 2000, over the same 1 790 rows.
    const organByPsp = directory.organByPspId;
    // DEDUPE BY ORGAN (batch-006): psp.cz stores a leadership seat as TWO membership rows
    // — one `kind:"member"` and one `kind:"function"` on the SAME organ (251 of 1062 PSP10
    // person-organ pairs). committee_count counts ROWS, so it double-counts those bodies;
    // that overcount is a defect in the deterministic index itself, which case gate (a)
    // forbids this loop from "fixing" — it is escalated in the batch-006 handoff instead.
    // What we MUST not do is render one committee twice to a reader, so the profile shows
    // each body ONCE at its highest role. (The effort-loop's dossier extractor deliberately
    // does NOT dedupe: there it must mirror committee_count exactly so an analyst comparing
    // the two never sees a phantom mismatch.)
    // Selection rule, deliberately NOT "max role, OR-ed current" — that would build a
    // chimera out of two different rows (a role from an ENDED row married to `current`
    // from a still-open one) and could render "chair · current" for a chairmanship that
    // has ended. Real case in this term: an MP whose committee chairmanship ended while
    // his plain membership continued — the honest render is "member · current", not
    // "chair · current" and not a dropped chair row.
    // So: prefer the highest role among rows that are STILL OPEN; only if the MP holds no
    // open row on that organ do we fall back to the highest role among ended rows, and
    // then the seat is marked past. Every field of the result comes from ONE row.
    // One evaluation instant for every seat on this page (and the one the page
    // prints), rather than a fresh `Date.now()` per row.
    const asOfMs = Date.now();
    const seatsAsOf = new Date(asOfMs).toISOString().slice(0, 10);
    const rowsByOrgan = new Map<number, CommitteeSeat[]>();
    for (const m of memberships) {
      if (m.personPspId !== pspId || m.organPspId == null) continue;
      const organType = organByPsp.get(m.organPspId)?.organTypeCz ?? null;
      const seat: ContributionCommitteeSeat = { organType, functionType: m.functionTypeCz };
      if (!isCommitteeSeat(seat)) continue;
      const role = classifyRole(m.functionTypeCz);
      const toAtMs = m.toAt ? Date.parse(m.toAt) : null;
      const toAtUnreadable = toAtMs !== null && !Number.isFinite(toAtMs);
      const row: CommitteeSeat = {
        abbrev: organByPsp.get(m.organPspId)?.abbrev ?? organByPsp.get(m.organPspId)?.nameCz ?? String(m.organPspId),
        organType,
        role,
        weight: ROLE_WEIGHT[role],
        // An unreadable end date proves nothing about the seat having ended, so it
        // does NOT demote the seat to "past" — it is flagged instead (the psp.cz
        // dumps carry at least one placeholder year-2925 membership date, see
        // docs/hybrid-benchmark-plan.md).
        current: !m.toAt || toAtUnreadable || (toAtMs as number) > asOfMs,
        fromAt: m.fromAt,
        toAt: m.toAt,
        toAtUnreadable,
      };
      const arr = rowsByOrgan.get(m.organPspId) ?? [];
      arr.push(row);
      rowsByOrgan.set(m.organPspId, arr);
    }
    const committees: CommitteeSeat[] = [...rowsByOrgan.values()]
      .map((rows) => {
        const pool = rows.some((r) => r.current) ? rows.filter((r) => r.current) : rows;
        return pool.reduce((best, r) => (r.weight > best.weight ? r : best));
      })
      .sort((a, b) => (a.current === b.current ? b.weight - a.weight : a.current ? -1 : 1));

    // Honest extra signals pulled from the person node props (may be absent).
    // The props come from the chamber pass, which already read every person node —
    // this used to be a THIRD full `person`-kind scan filtered to one id.
    const personNode = directory.personPropsByPspId.has(pspId)
      ? { props: directory.personPropsByPspId.get(pspId)! }
      : null;
    const effortTenureDays = personNode ? nullableNum(personNode.props.effort_tenure_days) : null;
    const effortTenureClass = personNode && typeof personNode.props.effort_tenure_class === "string"
      ? personNode.props.effort_tenure_class
      : null;
    const effortTenureStart = personNode && typeof personNode.props.effort_tenure_start === "string"
      ? personNode.props.effort_tenure_start
      : null;
    const effortTenureEnd = personNode && typeof personNode.props.effort_tenure_end === "string"
      ? personNode.props.effort_tenure_end
      : null;
    const effortWorkThemesRaw = personNode?.props.effort_work_themes;
    const effortWorkThemes = Array.isArray(effortWorkThemesRaw)
      ? effortWorkThemesRaw.filter((x): x is string => typeof x === "string")
      : null;
    // Analyst prose renders VERBATIM here, so it passes the public-copy guard
    // first: 136/207 live nodes still carry pipeline jargon from batches 001–005
    // ("v batch 001 spolupodepisoval…", "bills_authored=2 … sponsoredBills"),
    // written before the persist-time gate existed. A violating string is
    // withheld whole (never partially scrubbed) until the rewrite pass lands —
    // the text stays in the graph, it just does not ship. See lib/analysis/public-copy.ts.
    const effortBillFocus = personNode
      ? publicCopyOrNull(personNode.props.effort_bill_focus as string | undefined)
      : null;
    const effortNotes = personNode
      ? publicCopyOrNull(personNode.props.effort_notes as string | undefined)
      : null;
    const effortDataFlag = personNode && typeof personNode.props.effort_data_flag === "string"
      ? personNode.props.effort_data_flag
      : null;

    // sponsors — person → bill (kind "bill"), resolved to the psp.cz historie
    // link via `cislo` (the public print number). See SponsoredBill's doc
    // comment for why `tiskId` must never be used for this URL. Since pass 34
    // the edge props carry the predkladatel rank (role) and the bill node its
    // procedural fate (stav / fate_sb) — rendered as-is, never derived here.
    const selfSponsorEdges = edgesByRel("sponsors").filter((e) => e.src === selfId);
    const rapporteurEdges = edgesByRel("rapporteur").filter((e) => e.src === selfId);
    // The bill nodes are the far end of the very edges just read — no separate
    // `kind:"bill"` relation scan (which was capped at 2 000 against a growing corpus).
    // Shared by all four bill relations: sponsors, rapporteur, spoke_on and
    // proposes_amendment all point at the same 141 bill nodes.
    const billById = new Map(incidentNodes.filter((n) => n.kind === "bill").map((b) => [b.id, b]));
    const billBase = (bid: string) => {
      const b = billById.get(bid);
      const cislo = b && typeof b.props.cislo === "number" ? b.props.cislo : null;
      return {
        b,
        cislo,
        title: b?.label ?? bid,
        url: cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null,
        appUrl: cislo != null ? `/zakony/${cislo}` : null,
      };
    };
    let sponsoredBills: SponsoredBill[] = [];
    let rapporteurBills: RapporteurBill[] = [];
    if (selfSponsorEdges.length > 0 || rapporteurEdges.length > 0) {
      const ROLE_ORDER: Record<string, number> = { predkladatel: 0, spolupodepsal: 1 };
      sponsoredBills = selfSponsorEdges
        .map((e) => {
          const { b, cislo, title, url, appUrl } = billBase(e.dst);
          const p = (e.props ?? {}) as Record<string, unknown>;
          const role: "predkladatel" | "spolupodepsal" | null =
            p.role === "predkladatel" || p.role === "spolupodepsal" ? p.role : null;
          return {
            cislo,
            title,
            url,
            appUrl,
            role,
            joinedLater: p.joined_later === true,
            stav: b && typeof b.props.stav === "string" ? b.props.stav : null,
            fateSb: b && typeof b.props.fate_sb === "string" ? b.props.fate_sb : null,
          };
        })
        .sort(
          (a, b) =>
            (ROLE_ORDER[a.role ?? ""] ?? 9) - (ROLE_ORDER[b.role ?? ""] ?? 9) ||
            (a.cislo ?? 1e9) - (b.cislo ?? 1e9) ||
            a.title.localeCompare(b.title, "cs"),
        );
      rapporteurBills = rapporteurEdges
        .map((e) => {
          const { cislo, title, url, appUrl } = billBase(e.dst);
          const p = (e.props ?? {}) as Record<string, unknown>;
          const scopes = Array.isArray(p.scopes) ? p.scopes.filter((s): s is string => typeof s === "string") : [];
          return { cislo, title, url, appUrl, scopes };
        })
        .sort((a, b) => (a.cislo ?? 1e9) - (b.cislo ?? 1e9) || a.title.localeCompare(b.title, "cs"));
    }
    // ── Pracovní záznam po tiscích ───────────────────────────────────────────
    // The pass-35 engagement layer, which the profile carried only as a bare
    // `amendments_authored` counter and did not carry at all for speeches. Both
    // relations arrived in the SAME neighbour read as everything else — no extra
    // store call. Edge weight is the count (turns / amendments); the amendment
    // edge additionally lists the sněmovní-dokument numbers, whose length equals
    // the weight, so the weight is the honest per-bill figure either way.
    const engagement = (rel: string): BillEngagement[] =>
      edgesByRel(rel)
        .filter((e) => e.src === selfId)
        .map((e) => {
          const { cislo, title, url, appUrl } = billBase(e.dst);
          return { cislo, title, url, appUrl, count: num(e.weight) };
        })
        // Heaviest engagement first, then by print number — a total order, so the
        // list is identical build to build (`kgNeighbours` orders by weight alone).
        .sort((a, b) => b.count - a.count || (a.cislo ?? 1e9) - (b.cislo ?? 1e9) || a.title.localeCompare(b.title, "cs"));
    const floorSpeeches = engagement("spoke_on");
    const amendmentBills = engagement("proposes_amendment");
    const floorSpeechTurns = floorSpeeches.reduce((s, b) => s + b.count, 0);
    const amendmentBillCount = amendmentBills.reduce((s, b) => s + b.count, 0);

    // ── Peníze ────────────────────────────────────────────────────────────────
    // The `linked_to` edges came back in the SAME neighbour read as everything
    // else above (one indexed query, not a scan of the 211-row relation), and the
    // company nodes are their far end — so the person side of the money section
    // costs this loader nothing at all.
    //
    // Contracts are a second, per-company indexed read, and ONLY for the ties
    // whose class the attribution rule lets us attribute (owner-operator /
    // manager: 58 of 211 ties, 10 653 `supplies` rows in total). Steward seats are
    // deliberately not read: their money is the institution's — the single biggest
    // tied "company" is a regional hospital with 17 040 contracts — so reading it
    // would cost the most and buy a number the page must not print anyway.
    const moneyEdges = edgesByRel("linked_to").filter((e) => e.src === selfId);
    const companyById = new Map(incidentNodes.filter((n) => n.kind === "company").map((c) => [c.id, c]));
    const ties: ProfileMoneyTie[] = [];
    let attributableCzk = 0;
    let attributableContracts = 0;
    let unusableDates = 0;
    let anyTruncated = false;
    let moneyPass: number | null = null;
    for (const e of moneyEdges) {
      const comp = companyById.get(e.dst);
      if (!comp) continue; // unresolved company → drop, never guess
      const props = (e.props ?? {}) as Record<string, unknown>;
      const role = typeof props.role === "string" ? props.role : "";
      const tieClass = classifyTie(role, comp.label);
      const rawState = props.review_state ?? props.state;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";
      moneyPass ??= nullableNum((e.provenance as Record<string, unknown> | undefined)?.pass);

      let contractCount: number | null = null;
      let contractCzk: number | null = null;
      let topContracts: ProfileContractLine[] = [];
      let contractsMoreCount = 0;
      let contractsTruncated = false;
      if (tieClass !== "steward") {
        const supplied = await store.kgNeighbours({
          id: comp.id,
          rels: ["supplies"],
          limit: PROFILE_SUPPLIES_CAP,
        });
        contractsTruncated = supplied.edges.length >= PROFILE_SUPPLIES_CAP;
        anyTruncated ||= contractsTruncated;
        const nodeById = new Map(supplied.nodes.map((n) => [n.id, n]));
        const lines: ProfileContractLine[] = [];
        let czk = 0;
        for (const se of supplied.edges) {
          const node = nodeById.get(se.dst);
          const amountRaw = typeof se.weight === "number" ? se.weight : node?.props?.amount;
          const amountCzk =
            typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;
          czk += amountCzk ?? 0;
          const rawSignedOn = node?.props?.signedOn;
          const signedOn = plausibleIsoDateOrNull(typeof rawSignedOn === "string" ? rawSignedOn : null, seatsAsOf);
          const dateUnusable = typeof rawSignedOn === "string" && rawSignedOn !== "" && signedOn === null;
          if (dateUnusable) unusableDates += 1;
          lines.push({ id: se.dst, title: node?.label ?? se.dst, amountCzk, signedOn, dateUnusable });
        }
        // Biggest first; the id breaks the (dense) amount ties so the page is
        // reproducible build-to-build — `kgNeighbours` orders by weight, which is
        // not a total order (see lib/db/kgOrder.ts).
        lines.sort((a, b) => (b.amountCzk ?? 0) - (a.amountCzk ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        contractCount = supplied.edges.length;
        contractCzk = czk;
        topContracts = lines.slice(0, PROFILE_CONTRACT_LINES);
        contractsMoreCount = Math.max(0, lines.length - topContracts.length);
        attributableCzk += czk;
        attributableContracts += supplied.edges.length;
      }

      ties.push({
        companyId: comp.id,
        ico: String((comp.props as Record<string, unknown> | undefined)?.ico ?? comp.id.split(":").pop() ?? ""),
        company: comp.label,
        role,
        tieClass,
        reviewState,
        source: typeof props.source === "string" ? props.source : "",
        corroboration: CORROBORATIONS.includes(props.corroboration as Corroboration)
          ? (props.corroboration as Corroboration)
          : null,
        temporalStatus: typeof props.temporal_status === "string" ? props.temporal_status : null,
        roleValidFrom: typeof props.role_valid_from === "string" ? props.role_valid_from : null,
        roleValidTo: typeof props.role_valid_to === "string" ? props.role_valid_to : null,
        contractCount,
        contractCzk,
        topContracts,
        contractsMoreCount,
        contractsTruncated,
      });
    }
    // Attributable ties first (that is where the file's own claim lives), then by
    // reachable money, then by company id so the order never depends on the db.
    const CLASS_ORDER: Record<TieClass, number> = { "owner-operator": 0, manager: 1, steward: 2 };
    ties.sort(
      (a, b) =>
        CLASS_ORDER[a.tieClass] - CLASS_ORDER[b.tieClass] ||
        (b.contractCzk ?? 0) - (a.contractCzk ?? 0) ||
        (a.companyId < b.companyId ? -1 : a.companyId > b.companyId ? 1 : 0),
    );
    const money: ProfileMoney = {
      ties,
      attributableCzk,
      attributableContracts,
      stewardTies: ties.filter((t) => t.tieClass === "steward").length,
      pendingTies: ties.filter((t) => t.reviewState === "pending_review").length,
      verifiedTies: ties.filter((t) => t.reviewState === "verified").length,
      unusableDates,
      anyTruncated,
      pass: moneyPass,
    };

    // Score legibility — derived entirely from rows already in memory: the ranked
    // chamber `entries` (which this page computes and then throws away except for
    // rank/prev/next) and the raw person props the same pass already read.
    const legibility = computeScoreLegibility({
      self: {
        rank: person.rank,
        score: person.score,
        props: personNode?.props ?? {},
        points: person.components,
      },
      chamber: entries.map((e) => ({
        score: e.score,
        props: directory.personPropsByPspId.get(e.pspId) ?? {},
      })),
      next: idx > 0 ? { name: entries[idx - 1].name, score: entries[idx - 1].score } : null,
      keys: data.components.map((c) => c.key),
    });

    const billsFirstSigned = personNode ? nullableNum(personNode.props.bills_first_signed) : null;
    const billsCoSigned = personNode ? nullableNum(personNode.props.bills_co_signed) : null;
    const amendmentsAuthored = personNode ? nullableNum(personNode.props.amendments_authored) : null;

    return {
      person,
      total: entries.length,
      prevPspId: entries[(idx - 1 + entries.length) % entries.length].pspId,
      nextPspId: entries[(idx + 1) % entries.length].pspId,
      components: data.components,
      legibility,
      coVoters,
      rebellions,
      committees,
      seatsAsOf,
      provenancePass: data.provenancePass,
      effortTenureDays,
      effortTenureClass,
      effortTenureStart,
      effortTenureEnd,
      effortWorkThemes,
      effortBillFocus,
      effortNotes,
      effortDataFlag,
      sponsoredBills,
      billsFirstSigned,
      billsCoSigned,
      rapporteurBills,
      amendmentsAuthored,
      floorSpeeches,
      floorSpeechTurns,
      amendmentBills,
      amendmentBillCount,
      speechTurnsTotal: personNode ? nullableNum(personNode.props.speech_turns) : null,
      interpellations: personNode ? nullableNum(personNode.props.interpellations) : null,
      absenceRate: personNode ? nullableNum(personNode.props.absence_rate) : null,
      money,
    };
  } catch (err) {
    reportLoaderFailure("getProfileData", err);
    return null;
  }
});

function nullableNum(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

// Resolve a club color from an already-loaded entry of the same club (keeps the
// club→color table in one place: getLeaderboardData).
function clubColorFor(club: string | null, entries: LeaderboardEntry[]): string {
  if (!club) return CLUB_FALLBACK_COLOR;
  const hit = entries.find((e) => e.clubAbbrev === club);
  return hit?.clubColor ?? CLUB_FALLBACK_COLOR;
}
