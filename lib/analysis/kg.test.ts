import { describe, expect, it } from "vitest";
import {
  classifyRole,
  coVotingEdges,
  committeeInfluence,
  guardKgReset,
  mergeComputedNodeProps,
  nextPass,
  partyCohesion,
  positionOf,
  rebellion,
  type BallotInput,
  type ClubRef,
  type MembershipInput,
} from "./kg";

// mandate → person: mandates 10/20/30/40 → persons 1/2/3/4
const M2P = new Map<number, number>([
  [10, 1],
  [20, 2],
  [30, 3],
  [40, 4],
]);
const CLUB_A: ClubRef = { organId: 100, abbrev: "A" };
const CLUB_B: ClubRef = { organId: 200, abbrev: "B" };
const M2CLUB = new Map<number, ClubRef>([
  [10, CLUB_A],
  [20, CLUB_A],
  [30, CLUB_A],
  [40, CLUB_B],
]);

const b = (voteId: number, mandateId: number, choice: BallotInput["choice"]): BallotInput => ({
  voteId,
  mandateId,
  choice,
});

describe("positionOf", () => {
  it("keeps only yes/no as a measurable position", () => {
    expect(positionOf("yes")).toBe("yes");
    expect(positionOf("no")).toBe("no");
    expect(positionOf("abstain_or_not_voting")).toBeNull();
    expect(positionOf("not_logged_in")).toBeNull();
    expect(positionOf("excused")).toBeNull();
  });
});

describe("coVotingEdges", () => {
  // v1(non-voided): 1=yes 2=yes 3=no · v2: 1=yes 2=no 3=abstain · v3(VOIDED): 1=no 2=no
  const ballots = [
    b(1, 10, "yes"),
    b(1, 20, "yes"),
    b(1, 30, "no"),
    b(2, 10, "yes"),
    b(2, 20, "no"),
    b(2, 30, "abstain_or_not_voting"),
    b(3, 10, "no"),
    b(3, 20, "no"),
  ];
  const voided = new Set([3]);

  it("counts shared positional votes and the agreement rate, ignoring voided + non-positional", () => {
    const edges = coVotingEdges(ballots, voided, M2P, 1);
    const pair = (s: number, d: number) => edges.find((e) => e.src === s && e.dst === d);
    // 1↔2: v1 both yes (agree), v2 yes/no (disagree); v3 voided → shared 2, agree 1
    expect(pair(1, 2)).toEqual({ src: 1, dst: 2, shared: 2, agree: 1, agreement: 0.5 });
    // 1↔3: v1 yes/no (disagree); v2 person3 abstained → not shared → shared 1, agree 0
    expect(pair(1, 3)).toEqual({ src: 1, dst: 3, shared: 1, agree: 0, agreement: 0 });
    // 2↔3: only v1 (disagree) → shared 1, agree 0
    expect(pair(2, 3)).toEqual({ src: 2, dst: 3, shared: 1, agree: 0, agreement: 0 });
  });

  it("stores each undirected pair once with src < dst", () => {
    const edges = coVotingEdges(ballots, voided, M2P, 1);
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.src < e.dst)).toBe(true);
  });

  it("gates on minimum shared votes", () => {
    const edges = coVotingEdges(ballots, voided, M2P, 2);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ src: 1, dst: 2, shared: 2 });
  });
});

describe("rebellion", () => {
  // v1: 1=yes 2=yes 3=no 4=yes · v2: 1=no 2=no 3=no · v3(tie in A): 1=yes 2=no
  const ballots = [
    b(1, 10, "yes"),
    b(1, 20, "yes"),
    b(1, 30, "no"),
    b(1, 40, "yes"),
    b(2, 10, "no"),
    b(2, 20, "no"),
    b(2, 30, "no"),
    b(3, 10, "yes"),
    b(3, 20, "no"),
  ];
  const voided = new Set<number>();

  it("scores a rebel against the club's strict majority, skipping tied votes", () => {
    const { byPerson } = rebellion(ballots, voided, M2P, M2CLUB, 1);
    // person 3: v1 no vs club-A majority yes → rebel; v2 no vs majority no → loyal. v3: absent.
    expect(byPerson.get(3)).toMatchObject({ rebelVotes: 1, eligibleVotes: 2, rate: 0.5 });
    // persons 1 & 2 never oppose the line; v3 is a 1-1 tie → not eligible for either.
    expect(byPerson.get(1)).toMatchObject({ rebelVotes: 0, eligibleVotes: 2 });
    expect(byPerson.get(2)).toMatchObject({ rebelVotes: 0, eligibleVotes: 2 });
  });

  it("attaches the club (party node target) to each MP", () => {
    const { byPerson } = rebellion(ballots, voided, M2P, M2CLUB, 1);
    expect(byPerson.get(3)).toMatchObject({ clubOrganId: 100, clubAbbrev: "A" });
  });

  it("gates rate/edges on minimum eligible votes", () => {
    // person 4 is alone in club B → always the majority, only 1 eligible vote.
    const withAll = rebellion(ballots, voided, M2P, M2CLUB, 1).byPerson;
    expect(withAll.get(4)).toMatchObject({ eligibleVotes: 1, rebelVotes: 0 });
    const gated = rebellion(ballots, voided, M2P, M2CLUB, 2).byPerson;
    expect(gated.has(4)).toBe(false);
    expect(gated.has(3)).toBe(true);
  });
});

describe("partyCohesion", () => {
  // club A: v1 yes=2 no=1 (rice 1/3) · v2 no=3 (rice 1) · v3 yes=1 no=1 (rice 0)
  const ballots = [
    b(1, 10, "yes"),
    b(1, 20, "yes"),
    b(1, 30, "no"),
    b(2, 10, "no"),
    b(2, 20, "no"),
    b(2, 30, "no"),
    b(3, 10, "yes"),
    b(3, 20, "no"),
    b(1, 40, "yes"), // club B, single voter — below any min
  ];

  it("averages the Rice index over qualifying votes", () => {
    const c = partyCohesion(ballots, new Set(), M2CLUB, 2);
    // mean(1/3, 1, 0) = 0.444; a single-member club never qualifies
    expect(c.get(100)).toMatchObject({ clubAbbrev: "A", cohesion: 0.444, votes: 3 });
    expect(c.has(200)).toBe(false);
  });

  it("drops votes with too few positional club members", () => {
    const c = partyCohesion(ballots, new Set(), M2CLUB, 3);
    // v3 has only 2 positional voters → excluded; mean(1/3, 1) = 0.667
    expect(c.get(100)).toMatchObject({ cohesion: 0.667, votes: 2 });
  });
});

describe("classifyRole", () => {
  it("ranks the Czech role names, vice before chair", () => {
    expect(classifyRole("Předseda")).toBe("chair");
    expect(classifyRole("Předsedkyně")).toBe("chair");
    expect(classifyRole("Místopředseda")).toBe("vice");
    expect(classifyRole("Místopředsedkyně")).toBe("vice");
    expect(classifyRole("Ověřovatel")).toBe("member");
    expect(classifyRole(null)).toBe("member");
  });
});

describe("committeeInfluence", () => {
  const committees = new Set([500, 501]);
  const memberships: MembershipInput[] = [
    { person: 1, organId: 500, functionName: null }, // member
    { person: 1, organId: 500, functionName: "Předseda" }, // chair — max wins
    { person: 1, organId: 501, functionName: null }, // member
    { person: 2, organId: 999, functionName: "Předseda" }, // not a committee → ignored
  ];

  it("keeps the max role per committee and counts degree centrality", () => {
    const { edges, degree } = committeeInfluence(memberships, committees);
    expect(edges).toEqual([
      { person: 1, organId: 500, role: "chair", weight: 1 },
      { person: 1, organId: 501, role: "member", weight: 0.3 },
    ]);
    expect(degree.get(1)).toBe(2);
    expect(degree.has(2)).toBe(false);
  });
});

/* ── nextPass — the six-script call-stack bug (D6, 2026-08-13) ────────────────
 *
 * Six kg_* writers computed their default pass as
 * `Math.max(0, ...nodes.map((n) => n.firstSeenPass)) + 1`. The live graph holds
 * ~153 700 kg_node rows, so that spread blew the call stack: each of those
 * scripts ran ONLY when the operator passed --pass=N and died on the bare
 * invocation its own header documents as the default. One helper now, six call
 * sites. */
describe("nextPass", () => {
  it("returns one past the highest firstSeenPass in the graph", () => {
    expect(nextPass([{ firstSeenPass: 3 }, { firstSeenPass: 11 }, { firstSeenPass: 7 }])).toBe(12);
  });

  it("an empty graph starts at pass 1", () => {
    expect(nextPass([])).toBe(1);
  });

  it("agrees with the naive spread it replaces, on an input small enough for one", () => {
    const rows = [{ firstSeenPass: 3 }, { firstSeenPass: 11 }, { firstSeenPass: 7 }, { firstSeenPass: 1 }];
    expect(nextPass(rows)).toBe(Math.max(0, ...rows.map((r) => r.firstSeenPass)) + 1);
    expect(nextPass([])).toBe(Math.max(0, ...[].map(() => 0)) + 1);
  });

  it("survives 200 000 rows — the input on which the spread it replaces throws", () => {
    // The live graph is ~153 700 nodes; 200 000 is the headroom the six writers
    // now have. The second assertion is the BUG, pinned: if a future refactor
    // reintroduces a spread here, this is the shape that kills it.
    const rows = Array.from({ length: 200_000 }, (_, i) => ({ firstSeenPass: (i % 41) + 1 }));
    expect(nextPass(rows)).toBe(42);
    expect(() => Math.max(0, ...rows.map((r) => r.firstSeenPass))).toThrow(RangeError);
  });
});

/* ── mergeComputedNodeProps — kg-compute erased what it did not compute (D5) ───
 *
 * upsertKgNodes does `props = excluded.props`, a wholesale replace. kg-compute
 * built each node's props from scratch, so a --commit erased contribution_score,
 * every effort_* dossier field and the whole money crossover on all 207 MPs. */
describe("mergeComputedNodeProps", () => {
  it("a stored key the writer does not compute SURVIVES", () => {
    const stored = { contribution_score: 96.8, effort_tenure_class: "full_term", rebellion_rate: 0.11 };
    const merged = mergeComputedNodeProps(stored, { committee_count: 2 });
    expect(merged.contribution_score).toBe(96.8);
    expect(merged.effort_tenure_class).toBe("full_term");
    expect(merged.committee_count).toBe(2);
  });

  it("a computed key OVERWRITES the stored one — this run owns what it computes", () => {
    const merged = mergeComputedNodeProps({ rebellion_rate: 0.11 }, { rebellion_rate: 0.07 });
    expect(merged.rebellion_rate).toBe(0.07);
  });

  it("a node with no stored props yields exactly the computed ones", () => {
    expect(mergeComputedNodeProps(undefined, { seats: 8 })).toEqual({ seats: 8 });
    expect(mergeComputedNodeProps(null, { seats: 8 })).toEqual({ seats: 8 });
    expect(mergeComputedNodeProps({}, {})).toEqual({});
  });

  it("does not mutate either input", () => {
    const stored = { a: 1 };
    const computed = { b: 2 };
    mergeComputedNodeProps(stored, computed);
    expect(stored).toEqual({ a: 1 });
    expect(computed).toEqual({ b: 2 });
  });

  it("the disclosed limit is real: a conditionally-computed key keeps its old value when the condition lapses", () => {
    // An MP who fell below MIN_ELIGIBLE_VOTES gets no rebellion_rate this pass, so
    // the stored one survives under the EARLIER pass's provenance. Pinned so the
    // gap is a known, documented property (frontier F24) rather than a surprise.
    const merged = mergeComputedNodeProps({ rebellion_rate: 0.11 }, { committee_count: 1 });
    expect(merged.rebellion_rate).toBe(0.11);
  });
});

/* ── guardKgReset — frontier F5 prescribed a graph-wide wipe as maintenance ──── */
describe("guardKgReset", () => {
  // Today's shape: kg-compute rebuilds 3 kinds / 3 rels; the graph carries far more.
  const LIVE = {
    storedNodeKinds: [
      { kind: "contract", count: 153_000 },
      { kind: "person", count: 207 },
      { kind: "company", count: 214 },
      { kind: "bill", count: 141 },
      { kind: "party", count: 8 },
      { kind: "organ", count: 33 },
    ],
    storedEdgeRels: { co_votes_with: 20_496, supplies: 153_731, linked_to: 211, rebels_against: 188, influential_in: 150 },
    storedNodeIdsOfRebuiltKinds: ["psp:person:6790", "psp:organ:174"],
    rebuiltNodeIds: ["psp:person:6790", "psp:organ:174"],
    rebuiltNodeKinds: ["person", "party", "organ"],
    rebuiltEdgeRels: ["co_votes_with", "rebels_against", "influential_in"],
    supersede: false,
  };

  it("REFUSES a reset that would wipe kinds and rels this writer never rebuilds, and names them", () => {
    const v = guardKgReset(LIVE);
    expect(v.allowed).toBe(false);
    expect(v.droppedNodeKinds.map((k) => k.kind)).toEqual(["contract", "company", "bill"]); // count desc
    expect(v.droppedEdgeRels.map((r) => r.rel)).toEqual(["supplies", "linked_to"]);
    expect(v.droppedNodes).toBe(153_000 + 214 + 141);
    expect(v.droppedEdges).toBe(153_731 + 211);
    expect(v.message).toContain("contract=153000");
    expect(v.message).toContain("supplies=153731");
    expect(v.message).toContain("--supersede");
  });

  it("allows the wipe under --supersede, but still names the casualties", () => {
    const v = guardKgReset({ ...LIVE, supersede: true });
    expect(v.allowed).toBe(true);
    expect(v.message).toContain("OVERRIDDEN by --supersede");
    expect(v.message).toContain("contract=153000");
  });

  it("allows a reset over a graph that holds nothing but what this run rebuilds", () => {
    const v = guardKgReset({
      storedNodeKinds: [{ kind: "person", count: 207 }],
      storedEdgeRels: { co_votes_with: 20_496 },
      storedNodeIdsOfRebuiltKinds: ["psp:person:6790"],
      rebuiltNodeIds: ["psp:person:6790"],
      rebuiltNodeKinds: ["person", "party", "organ"],
      rebuiltEdgeRels: ["co_votes_with", "rebels_against", "influential_in"],
      supersede: false,
    });
    expect(v.allowed).toBe(true);
    expect(v.droppedNodes).toBe(0);
    expect(v.droppedEdges).toBe(0);
    expect(v.message).toBe("--reset would drop nothing this run does not rebuild.");
  });

  it("an empty graph is trivially safe to reset", () => {
    const v = guardKgReset({
      storedNodeKinds: [],
      storedEdgeRels: {},
      storedNodeIdsOfRebuiltKinds: [],
      rebuiltNodeIds: ["psp:person:6790"],
      rebuiltNodeKinds: ["person"],
      rebuiltEdgeRels: ["co_votes_with"],
      supersede: false,
    });
    expect(v.allowed).toBe(true);
  });

  it("REFUSES on a row of a REBUILT kind that this run does not re-emit (a departed MP)", () => {
    // The kind survives the wipe; that row does not. A committee whose last member
    // left is the same shape — kg-compute skips it (`if (!members) continue`).
    const v = guardKgReset({
      storedNodeKinds: [{ kind: "person", count: 208 }],
      storedEdgeRels: { co_votes_with: 20_496 },
      storedNodeIdsOfRebuiltKinds: ["psp:person:6790", "psp:person:9999"],
      rebuiltNodeIds: ["psp:person:6790"],
      rebuiltNodeKinds: ["person"],
      rebuiltEdgeRels: ["co_votes_with"],
      supersede: false,
    });
    expect(v.allowed).toBe(false);
    expect(v.orphanedNodeIds).toEqual(["psp:person:9999"]);
    expect(v.droppedNodes).toBe(1);
    expect(v.message).toContain("psp:person:9999");
  });

  it("the verdict is deterministic — casualties sort by count desc, then name", () => {
    const input = {
      storedNodeKinds: [
        { kind: "bill", count: 141 },
        { kind: "law", count: 141 },
        { kind: "company", count: 214 },
      ],
      storedEdgeRels: {},
      storedNodeIdsOfRebuiltKinds: [],
      rebuiltNodeIds: [],
      rebuiltNodeKinds: ["person"],
      rebuiltEdgeRels: [],
      supersede: false,
    };
    // company (214) first; bill and law tie at 141 and break on the name.
    expect(guardKgReset(input).droppedNodeKinds.map((k) => k.kind)).toEqual(["company", "bill", "law"]);
    const reordered = { ...input, storedNodeKinds: [...input.storedNodeKinds].reverse() };
    expect(guardKgReset(reordered).message).toBe(guardKgReset(input).message);
  });
});
