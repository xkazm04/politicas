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
