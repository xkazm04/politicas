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
// The six contribution components + authoritative score come from the person
// node (see getLeaderboardData). No fabricated delta/trend/headline.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import { publicCopyOrNull } from "@/lib/analysis/public-copy";
import {
  buildLeaderboard,
  CLUB_FALLBACK_COLOR,
  type LeaderboardData,
  type LeaderboardEntry,
} from "@/features/civicscore/getLeaderboardData";
import { isCommitteeSeat, type CommitteeSeat as ContributionCommitteeSeat } from "@/lib/analysis/contribution";
import { classifyRole, ROLE_WEIGHT } from "@/lib/analysis/kg";

const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

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
}

export interface ProfileData {
  person: LeaderboardEntry; // includes rank
  total: number; // 207
  prevPspId: number;
  nextPspId: number;
  components: LeaderboardData["components"];
  coVoters: CoVoter[];
  rebellions: Rebellion[];
  committees: CommitteeSeat[];
  // honest extra signals (may be absent)
  contestedRebellion: number | null;
  rebellionRate: number | null;
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
}

export async function getAllProfilePspIds(): Promise<number[]> {
  const built = await buildLeaderboard();
  if (!built) return [];
  return built.data.entries.map((e) => e.pspId);
}

export async function getProfileData(pspId: number): Promise<ProfileData | null> {
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
    if (!(await storeReady(store, ["person"]))) return null;

    const selfId = `psp:person:${pspId}`;

    // co_votes_with — undirected; take the top allies by agreement weight.
    const coEdges = await store.listKgEdges({ rel: "co_votes_with", limit: 100_000 });
    const coVoters: CoVoter[] = coEdges
      .filter((e) => e.src === selfId || e.dst === selfId)
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
      .sort((a, b) => b.agreement - a.agreement)
      .slice(0, 8);

    // rebels_against — dst is the club/party node; its label is the club.
    const partyNodes = await store.listKgNodes({ kind: "party", limit: 30 });
    const partyLabelById = new Map(partyNodes.map((p) => [p.id, p.label]));
    const rebEdges = await store.listKgEdges({ rel: "rebels_against", limit: 100_000 });
    const rebellions: Rebellion[] = rebEdges
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
      .sort((a, b) => b.rate - a.rate);

    // committees — rebuilt from raw membership rows (NOT influential_in edges), the same
    // basis kg-contribution-ingest.ts feeds computeContribution for committee_count (see
    // extract-dossiers.ts's batch-006 note for the measured root cause). influential_in
    // undercounted here because kg-compute builds it only over organs that are DIRECT
    // CHILDREN of the chamber and typed /v[ýy]bor|komis/i — which excludes "Delegace"
    // (39/207 MPs affected) — and because those edges carry no fromAt/toAt at all, so a
    // seat vacated for a ministerial post rendered as an active committee membership.
    const term = "PSP10";
    const memberships = await store.listMemberships({ termCode: term });
    const rawOrgans = await store.listOrgans({ limit: 3000 });
    const organTypeByPsp = new Map(rawOrgans.map((o) => [o.pspId, o.organTypeCz]));
    const organLabelByPsp = new Map(rawOrgans.map((o) => [o.pspId, o.abbrev ?? o.nameCz ?? String(o.pspId)]));
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
    const rowsByOrgan = new Map<number, CommitteeSeat[]>();
    for (const m of memberships) {
      if (m.personPspId !== pspId || m.organPspId == null) continue;
      const organType = organTypeByPsp.get(m.organPspId) ?? null;
      const seat: ContributionCommitteeSeat = { organType, functionType: m.functionTypeCz };
      if (!isCommitteeSeat(seat)) continue;
      const role = classifyRole(m.functionTypeCz);
      const row: CommitteeSeat = {
        abbrev: organLabelByPsp.get(m.organPspId) ?? String(m.organPspId),
        organType,
        role,
        weight: ROLE_WEIGHT[role],
        current: !m.toAt || Date.parse(m.toAt) > Date.now(),
        fromAt: m.fromAt,
        toAt: m.toAt,
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
    const personNode = (await store.listKgNodes({ kind: "person", limit: 1000 })).find((p) => p.id === selfId);
    const contestedRebellion = personNode ? nullableNum(personNode.props.contested_vote_rebellion) : null;
    const rebellionRate = personNode ? nullableNum(personNode.props.rebellion_rate) : null;
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
    // comment for why `tiskId` must never be used for this URL.
    const sponsorEdges = await store.listKgEdges({ rel: "sponsors", limit: 100_000 });
    const sponsoredBillIds = sponsorEdges.filter((e) => e.src === selfId).map((e) => e.dst);
    let sponsoredBills: SponsoredBill[] = [];
    if (sponsoredBillIds.length > 0) {
      const billNodes = await store.listKgNodes({ kind: "bill", limit: 2000 });
      const billById = new Map(billNodes.map((b) => [b.id, b]));
      sponsoredBills = sponsoredBillIds
        .map((bid) => {
          const b = billById.get(bid);
          const cislo = b && typeof b.props.cislo === "number" ? b.props.cislo : null;
          return {
            cislo,
            title: b?.label ?? bid,
            url: cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null,
          };
        })
        .sort((a, b) => (a.cislo ?? 1e9) - (b.cislo ?? 1e9));
    }

    return {
      person,
      total: entries.length,
      prevPspId: entries[(idx - 1 + entries.length) % entries.length].pspId,
      nextPspId: entries[(idx + 1) % entries.length].pspId,
      components: data.components,
      coVoters,
      rebellions,
      committees,
      contestedRebellion,
      rebellionRate,
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
    };
  } catch (err) {
    reportLoaderFailure("getProfileData", err);
    return null;
  }
}

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
