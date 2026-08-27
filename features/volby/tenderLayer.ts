// Server-only: the ONE tender read behind every /volby surface.
//
// The tender corpus is the biggest slice of the graph a reader-facing page has ever
// folded (measured on the live store 2026-08-27: 61 421 `tender` nodes, 61 383
// `procures` + 31 744 `wins` edges, 17 728 `company` nodes of which 5 240 carry an
// `electoral_arena` or a `tender_winner_circle`). Four surfaces need the same fold —
// the arena census on /volby, one authority's lots on /volby/obec/[ico] and
// /volby/kraj/[slug], and the winner totals that turn "wins here" into "dependence" —
// so it is read ONCE per process window and memoised across requests exactly like
// `features/money/moneyLoader.ts`: bounded by `MONEY_MEMO_TTL_MS` (imported, never
// re-declared — two memos over one graph on two clocks is how two surfaces print two
// vintages of one number), and NEVER memoising an empty layer or a failure (a cold
// PGlite hiccup must not freeze into „0 zakázek" for a day).
//
// The memo is keyed on the Store INSTANCE (WeakMap): a test that swaps the store, or a
// process whose `getStore()` re-opened after a close, gets a fresh fold rather than a
// vintage read from a store that no longer exists.
//
// ARENA CORRECTION (found 2026-08-27, probe over the live store): `electoral_arena` is
// pass 74's map of the RVZ `kategorie_zadavatele`, a SELF-DECLARED field, and for obce it
// is wrong at scale — 1 296 registry obce (statutární město Havířov among them) are filed
// as „Příspěvková organizace kraje" → krajske, 129 obce as „Kraj", 70 as „Česká
// republika"; Středočeský kraj is komunalni and Jihočeský kraj statni. Rendering Havířov
// under the krajské term window would be fiction. So the fold takes a REGISTRY arena
// first — an ico in the 6 254-obec registry is komunalni, a kraj's own ico (crosswalk)
// is krajske — and only then the node's declared arena. Both are kept (`arena` and
// `arenaDeclared`), and `counts.arenaCorrectedByRegistry` says how many moved.
//
// What this module refuses to do: guess an arena (an authority without a mapped node
// is counted under `counts.lotsUnmappedAuthority`, never assigned one), guess a date
// (`decidedOn` is the `wins` edge's `decided_on`, `endedOn` the tender's `ended_on`;
// both may be null and the rules count that as `undated`), or turn a price into a
// contract value: `czkFloor` is the SUM of `wins.price_czk` (= the lot's lowest bid,
// `lowest_bid_czk`, which is what the persist script wrote as the edge weight) over the
// 16 955 of 31 744 wins that carry one — a FLOOR, never a total.

import "server-only";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import type { Store } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { asUnion } from "@/lib/db/narrow";
import type { ArenaBaseline, AuthorityLot, WinnerCircle } from "@/lib/analysis/volby/rules";
import type { Arena } from "@/lib/analysis/volby/types";
import { getRegistry } from "@/features/budget/mirrorData";
import { KRAJ_CROSSWALK } from "@/lib/analysis/volby/kraje";

export const ARENAS: readonly Arena[] = ["komunalni", "krajske", "statni", "nejasne"];

/** One authority (obec / kraj / state body) as zadavatel, folded from the graph. */
export interface AuthorityStats {
  ico: string;
  /** The company node's label — a registry name, rendered verbatim. */
  name: string;
  /** The arena the RULES use: registry-corrected (see header), else the declared one. */
  arena: Arena;
  /** `electoral_arena` as the node declares it (pass 74). */
  arenaDeclared: Arena;
  /** `tender_authority_category` — the RVZ kategorie_zadavatele string, or null. */
  category: string | null;
  lots: AuthorityLot[];
  circle: WinnerCircle | null;
  /** winner ico → wins at THIS authority (one per `wins` edge). */
  winCounts: Record<string, number>;
}

export interface ArenaCensusRow {
  arena: Arena;
  authorities: number;
  lots: number;
  flaggedShare: number;
  /** Sum of `wins.price_czk` over the arena's lots — a floor (see header). */
  czkFloor: number;
}

export interface TenderLayerProvenance {
  /** Highest pass among `arena_provenance` / `flags_provenance` seen; null if none. */
  pass: number | null;
  arenaPass: number | null;
  flagsPass: number | null;
  computedAt: string;
  /** Wall-clock of the cold read + fold, ms. */
  coldFoldMs: number;
  counts: Record<string, number>;
  /** Any of the four reads returned exactly KG_READ_CAP rows. */
  truncated: boolean;
  /** What `czkFloor` sums — printed beside the figure, never implied. */
  czkFloorBasis: string;
  /** What the arena baselines are computed over. */
  baselineBasis: string;
}

export interface TenderLayer {
  authorities: Map<string, AuthorityStats>;
  /** winner ico → all its wins across the corpus (the denominator of dependence). */
  winnerTotals: Map<string, number>;
  census: ArenaCensusRow[];
  baselines: Record<Arena, ArenaBaseline>;
  provenance: TenderLayerProvenance;
}

const ICO_PREFIX = "company:ico:";
const icoOf = (id: string): string | null => (id.startsWith(ICO_PREFIX) ? id.slice(ICO_PREFIX.length) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const passOf = (prov: unknown): number | null =>
  typeof prov === "object" && prov !== null ? num((prov as Record<string, unknown>).pass) : null;
const isoDay = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

function readCircle(v: unknown): WinnerCircle | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const circle3Share = num(o.circle3_share);
  const switchRate = num(o.switch_rate);
  const datedWins = num(o.dated_wins);
  if (circle3Share === null || switchRate === null || datedWins === null) return null;
  const circle3 = Array.isArray(o.circle3)
    ? o.circle3.flatMap((c) => {
        if (typeof c !== "object" || c === null) return [];
        const r = c as Record<string, unknown>;
        const ico = str(r.ico);
        const wins = num(r.wins);
        return ico && wins !== null ? [{ ico, name: str(r.name) ?? ico, wins }] : [];
      })
    : [];
  return { circle3_share: circle3Share, switch_rate: switchRate, dated_wins: datedWins, circle3 };
}

/** Pure fold — exported for the colocated test; the loader calls it through the memo. */
export function foldTenderLayer(
  tenders: readonly KgNodeRow[],
  procures: readonly KgEdgeRow[],
  wins: readonly KgEdgeRow[],
  companies: readonly KgNodeRow[],
  coldFoldMs: number,
  truncated: boolean,
  /** Registry arena of an ico (obec → komunalni, kraj → krajske), null = not a registry body. */
  registryArena: (ico: string) => Arena | null = () => null,
): TenderLayer {
  const authorities = new Map<string, AuthorityStats>();
  let arenaPass: number | null = null;
  let arenaCorrectedByRegistry = 0;
  for (const c of companies) {
    const ico = icoOf(c.id);
    if (!ico) continue;
    const arenaRaw = c.props.electoral_arena;
    const circle = readCircle(c.props.tender_winner_circle);
    if (arenaRaw === undefined && circle === null) continue; // only authority nodes are kept
    const p = passOf(c.props.arena_provenance);
    if (p !== null && (arenaPass === null || p > arenaPass)) arenaPass = p;
    const arenaDeclared = asUnion(arenaRaw, ARENAS, "nejasne");
    const fromRegistry = registryArena(ico);
    if (fromRegistry !== null && fromRegistry !== arenaDeclared) arenaCorrectedByRegistry++;
    authorities.set(ico, {
      ico,
      name: c.label,
      arena: fromRegistry ?? arenaDeclared,
      arenaDeclared,
      category: str(c.props.tender_authority_category),
      lots: [],
      circle,
      winCounts: {},
    });
  }

  // authority per tender: the `procures` edge first, the node's own `authority_ico` as fallback.
  const authorityByTender = new Map<string, string>();
  for (const e of procures) {
    const ico = icoOf(e.src);
    if (ico) authorityByTender.set(e.dst, ico);
  }
  let procuresFallback = 0;
  for (const t of tenders) {
    if (authorityByTender.has(t.id)) continue;
    const ico = str(t.props.authority_ico);
    if (ico) {
      authorityByTender.set(t.id, ico);
      procuresFallback++;
    }
  }

  // winner + decided_on per tender from `wins`; totals per winner across the corpus.
  const winnerTotals = new Map<string, number>();
  const winByTender = new Map<string, { winnerIco: string; decidedOn: string | null; priceCzk: number | null }>();
  let multiWinnerLots = 0;
  let pricedWins = 0;
  const priceByTender = new Map<string, number>();
  for (const e of wins) {
    const winnerIco = icoOf(e.src);
    if (!winnerIco) continue;
    winnerTotals.set(winnerIco, (winnerTotals.get(winnerIco) ?? 0) + 1);
    const authorityIco = authorityByTender.get(e.dst);
    if (authorityIco) {
      const a = authorities.get(authorityIco);
      if (a) a.winCounts[winnerIco] = (a.winCounts[winnerIco] ?? 0) + 1;
    }
    const price = num(e.props.price_czk);
    if (price !== null) {
      pricedWins++;
      priceByTender.set(e.dst, (priceByTender.get(e.dst) ?? 0) + price);
    }
    const decidedOn = isoDay(e.props.decided_on);
    const prev = winByTender.get(e.dst);
    if (!prev) {
      winByTender.set(e.dst, { winnerIco, decidedOn, priceCzk: price });
    } else {
      multiWinnerLots++;
      // A lot with several winners keeps the EARLIEST dated one (stable, never guessed);
      // an undated win never displaces a dated one.
      if (decidedOn && (!prev.decidedOn || decidedOn < prev.decidedOn)) {
        winByTender.set(e.dst, { winnerIco, decidedOn, priceCzk: price });
      }
    }
  }

  let flagsPass: number | null = null;
  let lotsUnmappedAuthority = 0;
  let lotsNoAuthority = 0;
  const perArena = new Map<Arena, { authorities: Set<string>; lots: number; flagged: number; shortDeadline: number; czk: number }>();
  for (const arena of ARENAS) perArena.set(arena, { authorities: new Set(), lots: 0, flagged: 0, shortDeadline: 0, czk: 0 });

  for (const t of tenders) {
    const authorityIco = authorityByTender.get(t.id);
    if (!authorityIco) {
      lotsNoAuthority++;
      continue;
    }
    const a = authorities.get(authorityIco);
    if (!a) {
      lotsUnmappedAuthority++;
      continue;
    }
    const flags = Array.isArray(t.props.flags) ? t.props.flags.filter((f): f is string => typeof f === "string") : [];
    if (flags.length > 0) {
      const p = passOf(t.props.flags_provenance);
      if (p !== null && (flagsPass === null || p > flagsPass)) flagsPass = p;
    }
    const win = winByTender.get(t.id);
    a.lots.push({
      id: t.id,
      decidedOn: win?.decidedOn ?? null,
      endedOn: isoDay(t.props.ended_on),
      flags,
      winnerIco: win?.winnerIco ?? null,
    });
    const bucket = perArena.get(a.arena)!;
    bucket.authorities.add(a.ico);
    bucket.lots++;
    if (flags.length > 0) bucket.flagged++;
    if (flags.includes("short_deadline")) bucket.shortDeadline++;
    bucket.czk += priceByTender.get(t.id) ?? 0;
  }

  const baselineBasis = "podíl označených zakázek CPV 45 v aréně přes celý načtený korpus (2024-12 → 2026-07), bez filtru volebního období";
  const census: ArenaCensusRow[] = [];
  const baselines = {} as Record<Arena, ArenaBaseline>;
  for (const arena of ARENAS) {
    const b = perArena.get(arena)!;
    const flaggedShare = b.lots > 0 ? b.flagged / b.lots : 0;
    census.push({ arena, authorities: b.authorities.size, lots: b.lots, flaggedShare, czkFloor: b.czk });
    baselines[arena] = {
      flaggedShare,
      shortDeadlineShare: b.lots > 0 ? b.shortDeadline / b.lots : 0,
      label: `základna arény ${arena}: ${b.flagged} označených z ${b.lots} zakázek`,
      source: `claim:volby-census:flagged-share:${arena}`,
    };
  }

  return {
    authorities,
    winnerTotals,
    census,
    baselines,
    provenance: {
      pass: arenaPass !== null || flagsPass !== null ? Math.max(arenaPass ?? 0, flagsPass ?? 0) : null,
      arenaPass,
      flagsPass,
      computedAt: new Date().toISOString(),
      coldFoldMs,
      counts: {
        tenders: tenders.length,
        procures: procures.length,
        wins: wins.length,
        companies: companies.length,
        authorities: authorities.size,
        arenaCorrectedByRegistry,
        pricedWins,
        multiWinnerLots,
        procuresFallback,
        lotsNoAuthority,
        lotsUnmappedAuthority,
      },
      truncated,
      czkFloorBasis: `součet price_czk na hranách wins (= nejnižší nabídka, lowest_bid_czk); ${pricedWins} z ${wins.length} výher nese cenu — dolní mez, ne hodnota smluv`,
      baselineBasis,
    },
  };
}

async function readTenderLayer(store: Store): Promise<TenderLayer> {
  const t0 = performance.now();
  // Every read at the ONE cap (lib/db/readCap.ts): a smaller limit is both a truncation
  // and, on PGlite, slower (the planner walks the primary key instead of the kind index).
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const procures = await store.listKgEdges({ rel: "procures", limit: KG_READ_CAP });
  const wins = await store.listKgEdges({ rel: "wins", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const readMs = performance.now() - t0;
  const truncated = [tenders, procures, wins, companies].some((r) => r.length >= KG_READ_CAP);
  const layer = foldTenderLayer(tenders, procures, wins, companies, 0, truncated, registryArenaOf());
  const coldFoldMs = Math.round(performance.now() - t0);
  layer.provenance.coldFoldMs = coldFoldMs;
  console.info(
    `[volby:tenderLayer] cold fold ${coldFoldMs} ms (reads ${Math.round(readMs)} ms) — ` +
      `${tenders.length} tenders · ${procures.length} procures · ${wins.length} wins · ${layer.authorities.size} authorities`,
  );
  return layer;
}

/** obec ico → komunalni, kraj ico → krajske; the static registry + the 14-row crosswalk. */
export function registryArenaOf(): (ico: string) => Arena | null {
  const obce = new Set(getRegistry().map((m) => m.ic));
  const kraje = new Set(KRAJ_CROSSWALK.map((k) => k.krajIco));
  return (ico) => (kraje.has(ico) ? "krajske" : obce.has(ico) ? "komunalni" : null);
}

const memo = new WeakMap<Store, { at: number; layer: Promise<TenderLayer> }>();

/**
 * The memoised tender layer. Throws on a read failure (the caller's loader catches and
 * reports); returns an EMPTY layer (no authorities, zero census) when the store holds no
 * tender nodes — that empty answer is returned but never memoised.
 */
export function loadTenderLayer(store: Store): Promise<TenderLayer> {
  const hit = memo.get(store);
  if (hit && Date.now() - hit.at < MONEY_MEMO_TTL_MS) return hit.layer;
  const layer = readTenderLayer(store)
    .then((l) => {
      if (l.provenance.counts.tenders === 0) memo.delete(store); // never memoise an absent layer
      return l;
    })
    .catch((err) => {
      memo.delete(store); // never memoise a transient failure
      throw err;
    });
  memo.set(store, { at: Date.now(), layer });
  return layer;
}

/** Test seam: drop the cross-request memo for one store. Never called by the app. */
export function resetTenderLayerMemo(store: Store): void {
  memo.delete(store);
}
