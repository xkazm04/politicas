// Server-only loader for /poslanec/<pspId> (MP profile) — reads ONE real person
// from the knowledge graph plus its edges. Must NEVER be imported into a client
// component (getStore() client guard + PGlite WASM). Degrades to null on any
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

import { getStore } from "@/lib/db/store";
import {
  buildLeaderboard,
  CLUB_FALLBACK_COLOR,
  type LeaderboardData,
  type LeaderboardEntry,
} from "@/features/civicscore/getLeaderboardData";

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

    // influential_in — dst is a committee/commission organ node.
    const organNodes = await store.listKgNodes({ kind: "organ", limit: 200 });
    const organById = new Map(organNodes.map((o) => [o.id, o]));
    const inflEdges = await store.listKgEdges({ rel: "influential_in", limit: 100_000 });
    const committees: CommitteeSeat[] = inflEdges
      .filter((e) => e.src === selfId)
      .map((e) => {
        const o = organById.get(e.dst);
        const props = e.props as { role?: string };
        return {
          abbrev: o?.label ?? e.dst,
          organType: (o?.props as { organ_type?: string } | undefined)?.organ_type ?? null,
          role: props.role ?? "member",
          weight: num(e.weight),
        };
      })
      .sort((a, b) => b.weight - a.weight);

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
    const effortBillFocus = personNode && typeof personNode.props.effort_bill_focus === "string"
      ? personNode.props.effort_bill_focus
      : null;
    const effortNotes = personNode && typeof personNode.props.effort_notes === "string"
      ? personNode.props.effort_notes
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
  } catch {
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
