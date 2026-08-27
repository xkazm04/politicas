// Server-only: the shared half of the /volby loaders — the chamber seen through the
// election-mirror lens (MP → ELECTED PARTY LIST, never club), the sponsored-bill read
// behind the MP findings, the per-list roll-up, and the authority card builder over the
// memoised tender layer. The four route loaders (getVolbyHomeData, getObecData,
// getKrajData, getListData) compose these; nothing here talks to a route.
//
// Result shape: every subject loader returns `VolbyResult<T>` so the route can tell a
// 404 (`not-found`: the ico/slug names nothing) from an outage (`null`: the store was
// dark or a read failed — reported through `reportLoaderFailure`, surface shows
// `DataUnavailable`). A `null` is never a 404 and a 404 is never a null.
//
// CURRENT-HOLDER SIGNAL (measured on the live store 2026-08-27): PSP10 carries 207
// mandate rows for 207 DISTINCT persons; the seat count is 200. The membership table
// holds 228 rows on the chamber organ itself (`organ_psp_id` = the organ whose abbrev
// is `PSP10`, pspId 174), of which 221 have `to_at IS NULL` — exactly 200 persons hold
// an open chamber membership, 7 hold only closed ones (the replaced MPs). `mandate_to`
// / `mandate_from` are null on every one of the 1 332 PSP10 membership rows, so the
// chamber-organ `to_at` is the ONLY current-holder signal the data carries. When the
// store has no chamber organ or no chamber rows at all (a fixture), the fold falls back
// to `dedupeCurrentHolders` (per person) and SAYS so in `currentHolderSignal`.

import "server-only";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { buildLeaderboard, type LeaderboardEntry } from "@/features/civicscore/getLeaderboardData";
import { KG_READ_CAP } from "@/lib/db/readCap";
import type { Store } from "@/lib/db/store";
import type { OrganRow } from "@/lib/db/types";
import { asUnion } from "@/lib/db/narrow";
import { median } from "@/lib/analysis/score-legibility";
import {
  composeAuthorityFindings,
  composeMpFindings,
  dedupeByObject,
  dedupeCurrentHolders,
  listSlug,
  outcomeTimeline,
  rollupLedger,
  type SponsoredBill,
} from "@/lib/analysis/volby/rules";
import type { Arena, Ballot, Finding, ListSummary, Provenance, Severity, SeverityLedger, SubjectCard } from "@/lib/analysis/volby/types";
import type { TenderLayer } from "./tenderLayer";

export type VolbyResult<T> = { kind: "ok"; data: T } | { kind: "not-found" } | null;

export const ok = <T>(data: T): VolbyResult<T> => ({ kind: "ok", data });
export const NOT_FOUND: { kind: "not-found" } = { kind: "not-found" };

/* ── the chamber through the election-mirror lens ───────────────────────────── */

export interface VolbyMp {
  pspId: number;
  mandatePspId: number;
  name: string;
  region: string | null;
  /** Club TODAY (`clubByMandate`), null when the leaderboard has none — kept apart from the list. */
  clubAbbrev: string | null;
  partyListPspId: number | null;
  /** Organ label of `partyListPspId` verbatim (psp.cz), null when the mandate carries none. */
  partyListLabel: string | null;
  /** `listSlug(partyListLabel)`; null when there is no label. */
  listSlug: string | null;
  /** Holds the seat today (see the header for the signal). */
  current: boolean;
  effortWorkhorse: boolean;
  effortRapporteurLoad: number;
  effortRecordedAt: string | null;
  /** Count of `linked_to` edges with this person as src — an UNRATED count, never a valence. */
  moneyTieCount: number;
}

export interface ListKey {
  partyListPspId: number;
  label: string;
  slug: string;
}

export interface VolbyChamber {
  /** Every PSP10 mandate that has a leaderboard entry, current or not. */
  mps: VolbyMp[];
  currentHolderSignal: "chamber_membership_open" | "per_person_fallback";
  lists: ListKey[];
  /** CivicScore/effort provenance pass of the chamber pass (uniform) or null. */
  effortPass: number | null;
  counts: Record<string, number>;
}

const CHAMBER_ABBREV = "PSP10";

/** psp.cz-shaped `to_at`: null, a future stamp, or an unparseable value like `infinity` all mean OPEN. */
function membershipOpen(toAt: string | null, now: number): boolean {
  if (toAt === null) return true;
  const t = Date.parse(toAt);
  return Number.isNaN(t) || t > now;
}

async function readChamber(store: Store): Promise<VolbyChamber | null> {
  const built = await buildLeaderboard();
  if (!built) return null;
  const entryByPspId = new Map<number, LeaderboardEntry>(built.data.entries.map((e) => [e.pspId, e]));
  const organByPsp: Map<number, OrganRow> = built.directory.organByPspId;

  const mandates = await store.listMandates({ termCode: CHAMBER_ABBREV, limit: KG_READ_CAP });
  const personIds = [...new Set(mandates.map((m) => m.personPspId))];
  const memberships =
    personIds.length > 0 ? await store.listMemberships({ termCode: CHAMBER_ABBREV, personPspIds: personIds, limit: KG_READ_CAP }) : [];
  const chamberOrgan = [...organByPsp.values()].find((o) => (o.abbrev ?? "").toUpperCase() === CHAMBER_ABBREV) ?? null;
  const now = Date.now();
  const openOnChamber = new Set<number>();
  let chamberRows = 0;
  if (chamberOrgan) {
    for (const m of memberships) {
      if (m.organPspId !== chamberOrgan.pspId) continue;
      chamberRows++;
      if (membershipOpen(m.toAt, now)) openOnChamber.add(m.personPspId);
    }
  }
  const signal: VolbyChamber["currentHolderSignal"] = chamberRows > 0 ? "chamber_membership_open" : "per_person_fallback";
  const fallbackCurrent = new Set(
    dedupeCurrentHolders(mandates.map((m) => ({ pspId: m.personPspId, partyListPspId: m.partyListPspId, mandateId: m.pspId }))).map(
      (r) => r.pspId,
    ),
  );

  // linked_to, counted once per person (src = psp:person:<id>).
  const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
  const tiesByPerson = new Map<number, number>();
  for (const e of linked) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    if (!m) continue;
    const id = Number(m[1]);
    tiesByPerson.set(id, (tiesByPerson.get(id) ?? 0) + 1);
  }

  const organLabel = (id: number | null): string | null =>
    id == null ? null : (organByPsp.get(id)?.nameCz ?? organByPsp.get(id)?.abbrev ?? null);

  let mandatesWithoutEntry = 0;
  const mps: VolbyMp[] = [];
  const listByPsp = new Map<number, ListKey>();
  for (const m of mandates) {
    const e = entryByPspId.get(m.personPspId);
    if (!e) {
      mandatesWithoutEntry++;
      continue;
    }
    const label = organLabel(m.partyListPspId);
    const slug = label ? listSlug(label) : null;
    if (m.partyListPspId != null && label && slug && !listByPsp.has(m.partyListPspId)) {
      listByPsp.set(m.partyListPspId, { partyListPspId: m.partyListPspId, label, slug });
    }
    mps.push({
      pspId: m.personPspId,
      mandatePspId: m.pspId,
      name: e.name,
      region: e.region,
      clubAbbrev: e.clubAbbrev === "—" ? null : e.clubAbbrev,
      partyListPspId: m.partyListPspId,
      partyListLabel: label,
      listSlug: slug,
      current: signal === "chamber_membership_open" ? openOnChamber.has(m.personPspId) : fallbackCurrent.has(m.personPspId),
      effortWorkhorse: e.effortWorkhorse,
      effortRapporteurLoad: e.effortRapporteurLoad,
      effortRecordedAt: e.effortRecordedAt,
      moneyTieCount: tiesByPerson.get(m.personPspId) ?? 0,
    });
  }
  mps.sort((a, b) => a.name.localeCompare(b.name, "cs") || a.pspId - b.pspId);
  const lists = [...listByPsp.values()].sort((a, b) => a.label.localeCompare(b.label, "cs"));
  return {
    mps,
    currentHolderSignal: signal,
    lists,
    effortPass: built.data.provenancePass,
    counts: {
      mandates: mandates.length,
      current: mps.filter((x) => x.current).length,
      chamberMembershipRows: chamberRows,
      mandatesWithoutEntry,
      linkedToEdges: linked.length,
      lists: lists.length,
    },
  };
}

const chamberMemo = new WeakMap<Store, { at: number; read: Promise<VolbyChamber | null> }>();

/** The chamber fold, memoised across requests per store (never a null, never an empty chamber). */
export function chamberForVolby(store: Store): Promise<VolbyChamber | null> {
  const hit = chamberMemo.get(store);
  if (hit && Date.now() - hit.at < MONEY_MEMO_TTL_MS) return hit.read;
  const read = readChamber(store)
    .then((c) => {
      if (!c || c.mps.length === 0) chamberMemo.delete(store);
      return c;
    })
    .catch((err) => {
      chamberMemo.delete(store);
      throw err;
    });
  chamberMemo.set(store, { at: Date.now(), read });
  return read;
}

/* ── sponsored bills, read narrowly ─────────────────────────────────────────── */

export interface BillsByMp {
  byPspId: Map<number, SponsoredBill[]>;
  /** Highest `forensic_provenance.pass` seen, or null. */
  forensicPass: number | null;
  counts: Record<string, number>;
}

const SEVERITIES: readonly Severity[] = ["low", "medium", "high"];
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isoDay = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

async function readBills(store: Store): Promise<BillsByMp> {
  // The bill relation is 141 nodes; read whole at the cap, keep only the props the rules take.
  const bills = await store.listKgNodes({ kind: "bill", limit: KG_READ_CAP });
  const sponsors = await store.listKgEdges({ rel: "sponsors", limit: KG_READ_CAP });
  let forensicPass: number | null = null;
  const billById = new Map<string, SponsoredBill>();
  for (const b of bills) {
    const p = b.props;
    const prov = typeof p.forensic_provenance === "object" && p.forensic_provenance !== null ? (p.forensic_provenance as Record<string, unknown>) : null;
    const pass = prov ? num(prov.pass) : null;
    if (pass !== null && (forensicPass === null || pass > forensicPass)) forensicPass = pass;
    billById.set(b.id, {
      tisk: b.id.replace(/^bill:tisk:/, ""),
      forensicSeverity: asUnion(p.forensic_severity, SEVERITIES, null),
      forensicRecordedAt: prov ? isoDay(prov.computedAt) : null,
      flaggedConflict: p.flagged_conflict === true,
      sponsorContractCzk: num(p.sponsor_contract_czk),
      sponsorMoneyCompanies: num(p.sponsor_money_companies),
      fateSb: str(p.fate_sb),
      fatePublishedOn: isoDay(p.fate_published_on),
      // No bill prop carries the sponsorship date (checked 2026-08-27: the only date-shaped
      // prop is `fate_published_on`) — null, never the fate date or the edge's pass stamp.
      sponsoredOn: null,
    });
  }
  const byPspId = new Map<number, SponsoredBill[]>();
  let edgesToUnknownBill = 0;
  for (const e of sponsors) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    const bill = billById.get(e.dst);
    if (!m || !bill) {
      edgesToUnknownBill++;
      continue;
    }
    const id = Number(m[1]);
    const arr = byPspId.get(id) ?? [];
    arr.push(bill);
    byPspId.set(id, arr);
  }
  for (const arr of byPspId.values()) arr.sort((a, b) => a.tisk.localeCompare(b.tisk));
  return { byPspId, forensicPass, counts: { bills: bills.length, sponsorsEdges: sponsors.length, edgesToUnknownBill } };
}

const billsMemo = new WeakMap<Store, { at: number; read: Promise<BillsByMp> }>();

/** Bill nodes + `sponsors` edges once per store window; an empty bill relation is not memoised. */
export function billsByMp(store: Store): Promise<BillsByMp> {
  const hit = billsMemo.get(store);
  if (hit && Date.now() - hit.at < MONEY_MEMO_TTL_MS) return hit.read;
  const read = readBills(store)
    .then((b) => {
      if (b.counts.bills === 0) billsMemo.delete(store);
      return b;
    })
    .catch((err) => {
      billsMemo.delete(store);
      throw err;
    });
  billsMemo.set(store, { at: Date.now(), read });
  return read;
}

/** Test seam: drop the per-store memos. Never called by the app. */
export function resetVolbyMemos(store: Store): void {
  chamberMemo.delete(store);
  billsMemo.delete(store);
}

/* ── MP findings and the per-list roll-up ───────────────────────────────────── */

export function mpFindings(mp: VolbyMp, bills: BillsByMp): Finding[] {
  return composeMpFindings({
    pspId: mp.pspId,
    sponsoredBills: bills.byPspId.get(mp.pspId) ?? [],
    effortWorkhorse: mp.effortWorkhorse,
    effortRapporteurLoad: mp.effortRapporteurLoad,
    effortRecordedAt: mp.effortRecordedAt,
    moneyTieCount: mp.moneyTieCount,
  });
}

export const NO_CLUB_KEY = "nezařazení";

export interface ListRollup {
  key: ListKey;
  members: VolbyMp[];
  findingsByPspId: Map<number, Finding[]>;
  summary: ListSummary;
}

/**
 * The chamber baseline every list ledger cites: the MEDIAN count of negative findings per
 * CURRENT mandate holder. Labelled as what it is — a median of counts, not a share of
 * anything — so the reader can compare a list's per-seat load with the chamber's.
 */
export function chamberBaseline(chamber: VolbyChamber, bills: BillsByMp): SeverityLedger["baseline"] {
  const negatives = chamber.mps.filter((m) => m.current).map((m) => mpFindings(m, bills).filter((f) => f.valence === "negative").length);
  const med = median(negatives);
  return {
    label: `medián záporných nálezů na jeden současný mandát (${negatives.length} mandátů)`,
    share: med ?? 0,
    source: "claim:volby-chamber:median-negative-per-mandate",
  };
}

/** One roll-up per elected list over its CURRENT holders, ordered by seats desc then label. */
export function listRollups(chamber: VolbyChamber, bills: BillsByMp): ListRollup[] {
  const baseline = chamberBaseline(chamber, bills);
  const out: ListRollup[] = [];
  for (const key of chamber.lists) {
    const members = chamber.mps.filter((m) => m.current && m.partyListPspId === key.partyListPspId);
    const findingsByPspId = new Map<number, Finding[]>();
    const all: Finding[] = [];
    for (const m of members) {
      const f = mpFindings(m, bills);
      findingsByPspId.set(m.pspId, f);
      all.push(...f);
    }
    const clubsToday: Record<string, number> = {};
    for (const m of members) {
      const k = m.clubAbbrev ?? NO_CLUB_KEY;
      clubsToday[k] = (clubsToday[k] ?? 0) + 1;
    }
    out.push({
      key,
      members,
      findingsByPspId,
      summary: { slug: key.slug, label: key.label, seats: members.length, ledger: rollupLedger(dedupeByObject(all), baseline), clubsToday },
    });
  }
  return out.sort((a, b) => b.summary.seats - a.summary.seats || a.summary.label.localeCompare(b.summary.label, "cs"));
}

export const listSummaries = (chamber: VolbyChamber, bills: BillsByMp): ListSummary[] => listRollups(chamber, bills).map((r) => r.summary);

/* ── authority cards over the tender layer ──────────────────────────────────── */

const arenaOfBallot = (ballot: Ballot): Arena => (ballot === "krajske" ? "krajske" : "komunalni");

/**
 * The card of one authority as zadavatel. An ico the tender graph does not hold gets an
 * EMPTY card (0 lots, ledger.total 0, the arena baseline still cited) — the honest state
 * for an obec with no CPV-45 lot in the corpus, never null and never a guess.
 */
export function authorityCard(layer: TenderLayer, ico: string, ballot: Ballot, label: string, href: string): SubjectCard {
  const stats = layer.authorities.get(ico) ?? null;
  const arena = stats?.arena ?? arenaOfBallot(ballot);
  const baseline = layer.baselines[arena];
  const findings = composeAuthorityFindings({
    ico,
    arena,
    lots: stats?.lots ?? [],
    winnerDependence: Object.fromEntries(
      Object.entries(stats?.winCounts ?? {}).map(([w, here]) => [w, here / Math.max(1, layer.winnerTotals.get(w) ?? here)]),
    ),
    circle: stats?.circle ?? null,
    baseline,
  });
  return {
    subjectId: `company:ico:${ico}`,
    ballot,
    label,
    href,
    ledger: rollupLedger(findings, { label: baseline.label, share: baseline.flaggedShare, source: baseline.source }),
    findings,
    timeline: outcomeTimeline(findings),
  };
}

/** Every authority's findings, once per layer instance (pure over the fold; ~5 240 authorities). */
const allAuthorityFindingsMemo = new WeakMap<TenderLayer, Finding[]>();
export function allAuthorityFindings(layer: TenderLayer): Finding[] {
  const hit = allAuthorityFindingsMemo.get(layer);
  if (hit) return hit;
  const out: Finding[] = [];
  for (const a of layer.authorities.values()) {
    const baseline = layer.baselines[a.arena];
    out.push(
      ...composeAuthorityFindings({
        ico: a.ico,
        arena: a.arena,
        lots: a.lots,
        winnerDependence: Object.fromEntries(
          Object.entries(a.winCounts).map(([w, here]) => [w, here / Math.max(1, layer.winnerTotals.get(w) ?? here)]),
        ),
        circle: a.circle,
        baseline,
      }),
    );
  }
  allAuthorityFindingsMemo.set(layer, out);
  return out;
}

/* ── provenance ─────────────────────────────────────────────────────────────── */

export function volbyProvenance(args: {
  layer: TenderLayer | null;
  chamber: VolbyChamber | null;
  bills: BillsByMp | null;
  extraSources?: string[];
  extraCounts?: Record<string, number>;
}): Provenance {
  const { layer, chamber, bills } = args;
  const passes = [layer?.provenance.pass ?? null, bills?.forensicPass ?? null, chamber?.effortPass ?? null].filter(
    (p): p is number => p !== null,
  );
  const sources = [
    ...(layer ? ["kg_node:tender", "kg_edge:procures", "kg_edge:wins", "kg_node:company (electoral_arena, tender_winner_circle)"] : []),
    ...(chamber ? ["kg_node:person (contribution, effort_*)", "mandate (PSP10, party_list_psp_id)", "membership (chamber organ, to_at)", "organ", "kg_edge:linked_to"] : []),
    ...(bills ? ["kg_node:bill (forensic_*, flagged_conflict, sponsor_*, fate_*)", "kg_edge:sponsors"] : []),
    ...(args.extraSources ?? []),
  ];
  const counts: Record<string, number> = {
    ...(layer ? Object.fromEntries(Object.entries(layer.provenance.counts).map(([k, v]) => [`tender.${k}`, v])) : {}),
    ...(layer ? { "tender.coldFoldMs": layer.provenance.coldFoldMs, "tender.truncated": layer.provenance.truncated ? 1 : 0 } : {}),
    ...(chamber ? Object.fromEntries(Object.entries(chamber.counts).map(([k, v]) => [`chamber.${k}`, v])) : {}),
    ...(chamber ? { "chamber.currentHolderSignalFallback": chamber.currentHolderSignal === "per_person_fallback" ? 1 : 0 } : {}),
    ...(bills ? Object.fromEntries(Object.entries(bills.counts).map(([k, v]) => [`bills.${k}`, v])) : {}),
    ...(args.extraCounts ?? {}),
  };
  return {
    pass: passes.length > 0 ? Math.max(...passes) : null,
    computedAt: new Date().toISOString(),
    sources,
    counts,
  };
}

/** Newest first by the later dated fact, then the decision date; undated last; ties by id. */
export function sortNewest(findings: readonly Finding[]): Finding[] {
  const key = (f: Finding) => f.laterOn ?? f.decidedOn ?? "";
  return [...findings].sort((a, b) => key(b).localeCompare(key(a)) || a.id.localeCompare(b.id));
}
