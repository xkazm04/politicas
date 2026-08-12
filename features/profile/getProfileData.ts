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
//   linked_to       → money ties — read for their EXISTENCE only; the money
//                     itself comes from getMoneyMpDetail(), the loader /penize
//                     already owns (see the Peníze block below)
//   spoke_on        → floor debates, per bill
//   proposes_amendment → written amendments, per bill
// The six contribution components + authoritative score come from the person
// node (see getLeaderboardData). No fabricated delta/trend/headline.

import "server-only";
import { cache } from "react";
import type { MembershipRow } from "@/lib/db/types";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { byListOrder } from "@/lib/db/kgOrder";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import { publicCopyOrNull } from "@/lib/analysis/public-copy";
import {
  buildLeaderboard,
  CLUB_FALLBACK_COLOR,
  toProfileEntry,
  type LeaderboardData,
  type LeaderboardEntry,
  type ProfileEntry,
} from "@/features/civicscore/getLeaderboardData";
import type { ContributionProvenance } from "@/features/civicscore/provenance";
import { isCommitteeSeat, type CommitteeSeat as ContributionCommitteeSeat } from "@/lib/analysis/contribution";
import { computeScoreLegibility, type ScoreLegibility } from "@/lib/analysis/score-legibility";
import { classifyRole, ROLE_WEIGHT } from "@/lib/analysis/kg";
import { getMoneyMpDetail } from "@/features/money/getMpDetail";
import { pragueDay } from "@/features/denik/pragueDay";
import { buildAbsenceRecord, type ProfileAbsenceRecord } from "./absenceRecord";
import { emptyProfileMoney, toProfileMoney, type ProfileMoney } from "./profileMoney";
import {
  deriveCareerSpine,
  termNumberOf,
  type CareerSpine,
  type ChamberWindowInput,
  type ServedTermInput,
  type TermCoverage,
} from "./careerSpine";

const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Ally rows the spis prints. A presentation bound like `PROFILE_REBELLION_ROWS`,
 *  and — since 2026-08-11 — disclosed like one: the page prints how many allies the
 *  co-voting graph actually holds for this MP beside how many it shows. It was the
 *  last silent cap on the page. */
export const PROFILE_ALLY_ROWS = 8;

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

// The Peníze section's payload lives in ./profileMoney.ts — a PURE projection of
// `MoneyMpDetail`, the object /penize/[pspId]'s own loader returns. It is re-exported
// here because the page and its components import the profile's shapes from one module.
export type { ProfileContractLine, ProfileMoney, ProfileMoneyTie } from "./profileMoney";

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
  /**
   * Sněmovní-dokument numbers of the written amendments on this bill
   * (`proposes_amendment.props.sd_cislos`, sd.zip / sd_dokument typ 13) —
   * ascending. Each one is a psp.cz page carrying the TEXT of that amendment
   * (`lib/kg/sourceLinks.ts` `snemovniDokumentLink`), so the row can offer the
   * document instead of only counting it.
   *
   * ALWAYS EMPTY for `spoke_on`: a floor turn has no such document, and inventing
   * one would be the guessed URL rule 1 of sourceLinks.ts forbids. Empty is also
   * the honest answer for an amendment edge the ingest recorded without numbers —
   * the count still renders, the links do not.
   *
   * `count` (the edge weight) stays AUTHORITATIVE. Where the two disagree the page
   * says so rather than presenting the list as the total; nothing is repaired here.
   */
  sdCislos: number[];
}

export interface ProfileData {
  // `ProfileEntry` = the ranked chamber entry PLUS the two fields only this page
  // reads (`trend`, `effortPublicRole`) — the chamber pass no longer computes those
  // 207 times per request; `toProfileEntry()` attaches them for this one MP from the
  // person props that pass already read. See ProfileOnlyFields.
  person: ProfileEntry; // includes rank
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
  /** Allies the co-voting graph holds for this MP, BEFORE `PROFILE_ALLY_ROWS`.
   *  The page prints the remainder rather than swallowing it (the
   *  `moneyMoreContracts` / `rebelInstancesMore` rule). */
  coVotersTotal: number;
  rebellions: Rebellion[];
  committees: CommitteeSeat[];
  /**
   * The date the committee seats' current/past split was evaluated against.
   * The page states it, because `/poslanec/<id>` is statically generated: without
   * it the reader has no way to know how old "současné" is. Paired with the
   * route's `revalidate`, which bounds how stale it can get.
   */
  seatsAsOf: string; // ISO yyyy-mm-dd
  /**
   * The number of the term this loader actually reads (`PSP10` → 10), derived by
   * `termNumberOf` and never written as a digit in copy. The header's period note
   * used to hard-code „10. volební období" in both catalogs while the term code
   * lived here — the same drift /zebricek and /penize each had to fix once.
   * `null` if the code is not of the `PSP<n>` shape; the page then omits the claim.
   */
  termNumber: number | null;
  /** Contribution-index pass that authored this MP's score — cited on-page. Null when
   *  the chamber does NOT agree on one pass (a partial recompute); see `provenance`. */
  provenancePass: number | null;
  /** Chamber-wide provenance aggregate + formula-ref comparison — the spis says on its
   *  own face when the score it prints was authored by an older version of the formula. */
  provenance: ContributionProvenance;
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
  /**
   * `effort_psp9_trend_note` — the analyst's reading of the SAME PSP9→PSP10
   * comparison `person.trend` computes. 13/207 nodes carry it; 6 of those pass
   * the public-copy guard (the other 7 quote raw prop identifiers and are
   * withheld whole, like every other effort_* prose field here).
   *
   * It is the only cross-term prose the graph holds, and it renders BESIDE the
   * trend — both where the panel shows and where TenureTrendGate suppresses it,
   * so a reader never loses the comparison entirely just because the rates are
   * unsafe to print. `CROSS_TERM_PROSE_FIELDS` (lib/analysis/committee-claims.ts)
   * already exempts it from the committee-count cross-check for that reason: its
   * two committee numbers describe two different terms.
   */
  effortPsp9TrendNote: string | null;
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
  /**
   * Ta míra po dnech. `absence_rate` je jedno číslo, jehož čitatel — dny
   * s podanou omluvou — dosud nikde nestál, přestože evidence je datovaná
   * a časovaná (`absence`, 6 425 řádků za PSP10). Tady jsou její řádky.
   *
   * `null` NENÍ prázdný záznam: znamená, že se evidence nepodařilo přečíst
   * (nebo že poslanec v období nemá mandátní řádek, kterým by se dala klíčovat),
   * a oddíl pro to má vlastní větu. Prázdný záznam = poslanec nemá ani jednu
   * omluvu, což je odpověď, ne výpadek.
   */
  absence: ProfileAbsenceRecord | null;
  /** `linked_to` money ties (all `pending_review` at pass 41) + the contracts the
   *  attribution rule permits attaching to them. See `ProfileMoney`. */
  money: ProfileMoney;
  /**
   * Kariérní spis — the MP's service record across parliamentary terms
   * (mandate rows are ingested for ALL terms PSP1–PSP10; activity data only
   * for PSP10 + a partial PSP9 — the spine discloses coverage per term).
   * See features/profile/careerSpine.ts for the derivation contract.
   */
  career: CareerSpine;
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
    const person = toProfileEntry(entries[idx], directory.personPropsByPspId.get(pspId) ?? {});

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
    const coVotersAll: CoVoter[] = edgesByRel("co_votes_with")
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
      .sort((a, b) => b.agreement - a.agreement);
    // The cap is the page's, and the page says so: `coVotersTotal` is what the graph
    // holds for this MP after the malformed-id drop above, so the disclosure counts
    // rows the reader could otherwise have seen — never edges we refused to resolve.
    const coVoters = coVotersAll.slice(0, PROFILE_ALLY_ROWS);

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
    // person-organ pairs). The batch-006 escalation about committee_count double-counting
    // was RESOLVED by the pass-42 recompute: the formula dedupes by seatKey since
    // CONTRIBUTION_FORMULA_REF = "contribution-committee-dedupe" (lib/analysis/
    // contribution.ts), and the store carries pass-42 provenance on all 207 nodes.
    // The profile's own render-side dedupe below PREDATES that fix and stays for its
    // original reason: one committee must never render twice to a reader, so each body
    // shows ONCE at its highest role.
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
    const effortPsp9TrendNote = personNode
      ? publicCopyOrNull(personNode.props.effort_psp9_trend_note as string | undefined)
      : null;

    // ── Kariérní spis ─────────────────────────────────────────────────────────
    // The mandate registry is ingested in FULL across all terms (2 157 rows,
    // PSP1–PSP10 — see docs/data-analysis/onboarding.md), so term PRESENCE is
    // real data for every MP. Personal mandate windows come from the chamber
    // organ's membership rows (the same rows the tenure props were computed
    // from); prior-term windows need one term-scoped membership read per term
    // actually served (median MP: 0–2 extra reads — 92/207 are first-termers).
    // Activity beyond presence exists ONLY for PSP10 (+ a partial PSP9 via the
    // `contribution_psp9` prop) — deriveCareerSpine discloses that per term.
    // `KG_READ_CAP`, not an ad-hoc 5 000: the mandate registry grows by a whole term
    // every four years, and a snug literal limit is exactly how a read starts losing
    // rows silently (lib/db/readCap.ts). It is also not free in PGlite — a small limit
    // makes the planner walk the primary key instead of the index (CLAUDE.md,
    // /zebricek 2026-08-04). ~2 157 rows today, all terms.
    const allMandates = await store.listMandates({ limit: KG_READ_CAP });
    const myMandates = allMandates.filter((m) => m.personPspId === pspId);
    // ── Omluvy ────────────────────────────────────────────────────────────────
    // Čte se PODLE MANDÁTU, ne podle období: `absence_mandate_idx` je v DDL od
    // začátku a nikdo ho nepoužíval. Změřeno na kopii živého store (PSP10,
    // 6 425 řádků): celé období 410/483/483 ms, jeden mandát 14–20 ms (bitmap
    // index scan). Mandátní čísla jsou zadarmo — `allMandates` se čte pár řádků
    // výš kvůli kariérnímu spisu, takže tenhle oddíl přidává JEDNO indexované
    // čtení a žádné další.
    //
    // Poslanec s víc mandátními řádky v jednom období je sjednocení (dnes takový
    // v PSP10 není: 207 řádků / 207 osob), poslanec BEZ mandátního řádku nemá čím
    // evidenci klíčovat — a to je nečitelný záznam, ne „žádné omluvy". Selhání
    // čtení nesmí shodit celý spis, proto vlastní catch: `null` je stav, který
    // oddíl umí vyslovit.
    const termMandateIds = myMandates
      .filter((m) => m.termCode.toUpperCase() === term)
      .map((m) => m.pspId);
    const absence: ProfileAbsenceRecord | null =
      termMandateIds.length === 0
        ? null
        : await (async () => {
            try {
              const rows = await store.listAbsences({
                termCode: term,
                mandatePspIds: termMandateIds,
                limit: KG_READ_CAP,
              });
              return buildAbsenceRecord(rows, pragueDay());
            } catch (err) {
              reportLoaderFailure("getProfileData/absence", err);
              return null;
            }
          })();

    // Mirrors getLeaderboardData's private regionLabel() so the spine's per-term
    // region reads identically to `person.region` (same organ rows, same copy).
    const regionLabelOf = (nameCz: string | null): string | null => {
      if (!nameCz) return null;
      if (nameCz === "Hlavní město Praha") return "Praha";
      if (nameCz === "Vysočina") return "Vysočina";
      return `${nameCz} kraj`;
    };
    const organLabel = (id: number | null): string | null =>
      id == null ? null : (organByPsp.get(id)?.nameCz ?? organByPsp.get(id)?.abbrev ?? null);
    const served: ServedTermInput[] = myMandates.map((m) => ({
      termCode: m.termCode,
      region: m.regionPspId != null ? regionLabelOf(organByPsp.get(m.regionPspId)?.nameCz ?? null) : null,
      partyList: organLabel(m.partyListPspId),
    }));
    // Chamber organs (abbrev PSP<n>) across all terms — already read once by
    // buildLeaderboard's organ pass; no second organ scan.
    const chamberOrgans = [...organByPsp.values()].filter((o) => /^PSP\d+$/i.test(o.abbrev ?? ""));
    const chamberTermByPspId = new Map(chamberOrgans.map((o) => [o.pspId, (o.abbrev ?? "").toUpperCase()]));
    const chamberByTermCode = new Map(chamberOrgans.map((o) => [(o.abbrev ?? "").toUpperCase(), o]));
    const chamberWindowRows = (rows: MembershipRow[], onlyTerm: string): ChamberWindowInput[] =>
      rows
        .filter(
          (m) =>
            m.personPspId === pspId &&
            m.kind === "member" &&
            m.organPspId != null &&
            chamberTermByPspId.get(m.organPspId) === onlyTerm,
        )
        .map((m) => ({ termCode: onlyTerm, fromAt: m.fromAt, toAt: m.toAt }));
    // PSP10 windows come from the membership read this loader already did above.
    const windows: ChamberWindowInput[] = chamberWindowRows(memberships, term);
    const priorTermCodes = [...new Set(myMandates.map((m) => m.termCode.toUpperCase()))]
      .filter((t) => t !== term && chamberByTermCode.has(t))
      .sort();
    // One read per prior term served, ISSUED TOGETHER. They are independent term-scoped
    // reads, so awaiting them in a loop made a five-term veteran pay five round trips in
    // series for data that has no ordering relation at all. `windows` is still appended
    // in `priorTermCodes` order (which is sorted), so the derived spine is unchanged.
    const priorReads = await Promise.all(
      priorTermCodes.map(async (priorTerm) => ({
        priorTerm,
        rows: await store.listMemberships({ termCode: priorTerm }),
      })),
    );
    for (const { priorTerm, rows } of priorReads) {
      windows.push(...chamberWindowRows(rows, priorTerm));
    }
    // PSP9 coverage: the effort loop's `contribution_psp9` prop (partial until
    // the PSP9 roll-call ingest flips `complete` — see contribution-trend.ts).
    const psp9Prop = personNode?.props.contribution_psp9;
    const psp9Coverage: TermCoverage =
      psp9Prop && typeof psp9Prop === "object"
        ? (psp9Prop as Record<string, unknown>).complete === true
          ? "full"
          : "partial"
        : "none";
    const career = deriveCareerSpine({
      served,
      chambers: chamberOrgans.map((o) => ({
        termCode: (o.abbrev ?? "").toUpperCase(),
        validFrom: o.validFrom,
        validTo: o.validTo,
      })),
      windows,
      currentTermCode: term,
      asOf: seatsAsOf,
      psp9Coverage,
    });

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
          // Čísla sněmovních dokumentů z hrany. `kg-bill-engagement-ingest.ts` je
          // ukládá vzestupně, ale pořadí v grafu není smlouva, tak se třídí i tady.
          // Duplicity se NEODSTRAŇUJÍ a chybějící pole se nedopočítává: obojí by byla
          // oprava dat v rendereru, ne jejich čtení.
          const rawSd = (e.props as { sd_cislos?: unknown }).sd_cislos;
          const sdCislos = Array.isArray(rawSd)
            ? rawSd
                .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
                .sort((a, b) => a - b)
            : [];
          return { cislo, title, url, appUrl, count: num(e.weight), sdCislos };
        })
        // Heaviest engagement first, then by print number — a total order, so the
        // list is identical build to build (`kgNeighbours` orders by weight alone).
        .sort((a, b) => b.count - a.count || (a.cislo ?? 1e9) - (b.cislo ?? 1e9) || a.title.localeCompare(b.title, "cs"));
    const floorSpeeches = engagement("spoke_on");
    const amendmentBills = engagement("proposes_amendment");
    const floorSpeechTurns = floorSpeeches.reduce((s, b) => s + b.count, 0);
    const amendmentBillCount = amendmentBills.reduce((s, b) => s + b.count, 0);

    // ── Peníze ────────────────────────────────────────────────────────────────
    // ONE money on the platform. The spis used to read `supplies` itself and add
    // the amounts up per TIE — a fourth implementation of "reachable public money"
    // beside `reachableMoney.ts`, and a measurably different one: it took a
    // contract's amount as `supplies.weight ?? contract.props.amount` where the
    // money layer takes the weight ONLY, and it summed per tie rather than per
    // company. Measured on the live store, the spis and /penize printed different
    // numbers for the same MP (Hladík 6881: 23 790 791 881,98 vs 23 570 594 009,66 Kč).
    //
    // So the figure now comes from `getMoneyMpDetail()` — the loader /penize/[pspId]
    // itself uses, indexed (`loadMpMoneySlice`), capped at `KG_READ_CAP` like every
    // other read, and already carrying `reachableMoney()`'s result plus each tie's
    // permanent `receiptRef`. `toProfileMoney()` is a pure projection of it; no CZK
    // is added up anywhere in features/profile.
    //
    // Cost, measured on the live store (cold, 3 rounds): the shared read costs
    // 556–896 ms for MPs carrying ties, against 0–296 ms for the old attributable-only
    // read — because the shared slice also reads the STEWARD companies' contracts
    // (which /penize prints as institutional money and the spis deliberately does
    // not attribute to the person). It is called ONLY when this MP actually has
    // `linked_to` edges — the 144 of 207 MPs without one pay nothing at all.
    //
    // The edge read also tells the two empty answers apart. `getMoneyMpDetail` returns
    // null both when the money layer cannot be read AND when none of the MP's ties
    // resolves to a company node; only the FIRST is a failure, and rendering it as
    // „no ties" would manufacture a fact about a person out of an outage. So the
    // profile counts the ties whose company the graph actually carries — the same
    // drop-never-guess rule the money loader applies — and calls a null against a
    // non-empty set what it is: unavailable.
    const companyById = new Map(incidentNodes.filter((n) => n.kind === "company").map((c) => [c.id, c]));
    const resolvableTies = edgesByRel("linked_to").filter((e) => e.src === selfId && companyById.has(e.dst));
    const moneyDetail = resolvableTies.length > 0 ? await getMoneyMpDetail(pspId) : null;
    const money: ProfileMoney = moneyDetail
      ? toProfileMoney(moneyDetail, seatsAsOf)
      : emptyProfileMoney(resolvableTies.length > 0);

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
      coVotersTotal: coVotersAll.length,
      rebellions,
      committees,
      seatsAsOf,
      termNumber: termNumberOf(term),
      provenancePass: data.provenancePass,
      provenance: data.provenance,
      effortTenureDays,
      effortTenureClass,
      effortTenureStart,
      effortTenureEnd,
      effortWorkThemes,
      effortBillFocus,
      effortNotes,
      effortDataFlag,
      effortPsp9TrendNote,
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
      absence,
      money,
      career,
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
