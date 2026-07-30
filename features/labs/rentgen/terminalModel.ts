/*
 * Newsroom Evidence Terminal — ČISTÝ pohledový model (moonshot batch-7, 7C).
 *
 * Plain modul, žádný server ani DOM: serverový loader (getTerminalData.ts),
 * klientský terminál (VariantRentgen.tsx) i testy běží tytéž funkce nad
 * týmiž tvary. Dvě disciplíny se vynucují ZDE, ne na plochách:
 *
 *   1. VERIFIED-ONLY: do grafu i do žebříčku terminálu vstupují VÝHRADNĚ
 *      vazby s review_state === "verified" — rozhodnutí, které prošlo lidskou
 *      bránou. Čekající a zamítnuté vazby se POČÍTAJÍ (terminál je přizná
 *      v hlavičce), ale nikdy nevykreslí: tiskový produkt nesmí ukázat
 *      neověřené obvinění ani omylem.
 *   2. KAŽDÝ PRVEK JE ODKAZ NA CITAČNÍ PLOCHU: hrana vazby → účtenka původu
 *      /zdroj/<h.…> (claimRef), uzel firmy → /zdroj/<u.…>, poslanec →
 *      /penize/<pspId> + kompilátor paketu /penize/<pspId>/paket, řádek
 *      tail-logu → kotva /dukazy#z-<id> nebo účtenka hrany. Adresy se skládají
 *      výhradně přes sdílené kodeky (claimRefPath, buildRegistryLinks) —
 *      terminál žádnou adresu nevymýšlí sám.
 *
 * Tail-log slévá dva prameny záznamu: rozhodnutí lidské brány (review_audit)
 * a change eventy grafu (change_event, 5C). review-decision change eventy se
 * NEPŘEBÍRAJÍ — rozhodnutí už nese pramen brány; duplikát by lhal o počtu
 * událostí (stejné pravidlo jako features/denik/getDenikData.readChanges).
 * Řazení je deterministické: čas záznamu DESC, id ASC uvnitř téhož okamžiku.
 */

import { claimRefPath, edgeClaimRef, nodeClaimRef } from "@/features/shared/provenance/claimRef";
import { buildRegistryLinks } from "@/features/money/reviewTypes";
import { czech, czechDate, czechInt } from "@/lib/format";

// ── společné tvary ──────────────────────────────────────────────────────────

/** Pokrytí vrstev záznamu — loader je hlásí, plocha je PŘIZNÁVÁ. */
export interface TerminalCoverage {
  /** Peněžní vrstva čitelná → graf + žebříček jedou nad živými vazbami. */
  money: boolean;
  /** review_audit čitelný → tail-log nese rozhodnutí lidské brány. */
  reviews: boolean;
  /** change_event čitelná → tail-log nese proud „zaznamenáno". */
  changes: boolean;
}

/** Celý pohledový model terminálu — server ho složí (getTerminalData.ts),
 *  klient jen sází. Deklarován ZDE, aby klientská komponenta nikdy
 *  neimportovala ze server-only loaderu. */
export interface TerminalViewData {
  graph: TerminalGraph;
  ledger: TerminalLedgerRow[];
  tail: TailLine[];
  coverage: TerminalCoverage;
  /** Průchod, který peněžní vrstvu materializoval (sebepoznání plochy). */
  pass: number;
  /** Kolik řádků review_audit tail viděl — cituje se v hlavičce logu. */
  auditRows: number;
  /** `YYYY-MM-DD` znovuodvození — datum získání dat pro citační lištu. */
  retrievedOn: string;
}

export type TerminalReviewState = "verified" | "pending_review" | "rejected";
export type TerminalTieClass = "owner-operator" | "manager" | "steward";

/** Řez MoneyTie + endpointů, který terminál potřebuje (loader ho složí
 *  z loadMoneyLayer + mapLinkedToTie; testy z fixture). */
export interface TerminalTieLike {
  /** kg_edge.src — `psp:person:<pspId>`. */
  srcId: string;
  /** kg_edge.dst — id uzlu firmy. */
  dstId: string;
  pspId: number | null;
  mpName: string;
  club: string | null;
  ico: string;
  company: string;
  role: string;
  reviewState: TerminalReviewState;
  tieClass: TerminalTieClass;
  contractCount: number;
  contractCzk: number;
  subsidiesCzk: number;
  /** Doslovný provenienční řetězec hrany (props.source) — cituje se. */
  source: string;
}

export const TIE_CLASS_CS: Record<TerminalTieClass, string> = {
  "owner-operator": "vlastník/jednatel",
  manager: "management",
  steward: "správní role",
};

// ── formát peněz (deterministicky, bez Intl — vzor lib/format.ts) ───────────

/** 4 200 000 → "4,2 mil. Kč" · 350 000 → "350 tis. Kč" · 900 → "900 Kč". */
export function czkCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000_000) return `${czech(n / 1_000_000_000)} mld. Kč`;
  if (n >= 1_000_000) return `${czech(n / 1_000_000)} mil. Kč`;
  if (n >= 1_000) return `${czechInt(Math.round(n / 1_000))} tis. Kč`;
  return `${czechInt(Math.round(n))} Kč`;
}

// ── graf peněžní stopy ──────────────────────────────────────────────────────

export type TerminalNodeKind = "person" | "company" | "money" | "party";

export interface TerminalNode {
  id: string;
  kind: TerminalNodeKind;
  label: string;
  sub: string;
  /** Souřadnice v mřížce 0–100 × 0–100 (viewBox škáluje plocha). */
  x: number;
  y: number;
  /** Citační plocha prvku; null = prvek bez vlastní adresy (ilustrace). */
  href: string | null;
}

export interface TerminalEdge {
  from: string;
  to: string;
  label: string;
  /** Plná čára = doložená peněžní stopa; čárkovaná = kontextová hrana. */
  trail: boolean;
  href: string | null;
}

export interface TerminalGraph {
  nodes: TerminalNode[];
  edges: TerminalEdge[];
  /** Kolik ověřených vazeb graf UKAZUJE (strop MAX_GRAPH_ROWS). */
  shownTies: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  /** Σ smlouvy + dotace přes VŠECHNY ověřené vazby (ne jen zobrazené). */
  verifiedCzk: number;
}

const MAX_GRAPH_ROWS = 8;
const MAX_GRAPH_PERSONS = 5;
const MAX_TIES_PER_PERSON = 3;

const reachable = (t: TerminalTieLike): number => t.contractCzk + t.subsidiesCzk;

/** Deterministický pořadový klíč vazby: peníze DESC, pak IČO ASC, pak src. */
function tieOrder(a: TerminalTieLike, b: TerminalTieLike): number {
  const diff = reachable(b) - reachable(a);
  if (diff !== 0) return diff;
  if (a.ico !== b.ico) return a.ico < b.ico ? -1 : 1;
  return a.srcId < b.srcId ? -1 : a.srcId > b.srcId ? 1 : 0;
}

/**
 * Ověřené vazby → uzly a hrany rentgenového grafu. Deterministické: týž
 * vstup v LIBOVOLNÉM pořadí → byte-identický výstup. Osoby se řadí podle
 * dosažitelných peněz svých ověřených vazeb (DESC, tiebreak pspId/src ASC),
 * vazby uvnitř osoby podle peněz (DESC, tiebreak IČO ASC).
 */
export function deriveTerminalGraph(ties: readonly TerminalTieLike[]): TerminalGraph {
  const verified = ties.filter((t) => t.reviewState === "verified");
  const pendingCount = ties.filter((t) => t.reviewState === "pending_review").length;
  const rejectedCount = ties.filter((t) => t.reviewState === "rejected").length;
  const verifiedCzk = verified.reduce((s, t) => s + reachable(t), 0);

  // Skupiny po osobách, deterministicky seřazené.
  const byPerson = new Map<string, TerminalTieLike[]>();
  for (const t of verified) {
    const list = byPerson.get(t.srcId) ?? [];
    list.push(t);
    byPerson.set(t.srcId, list);
  }
  const persons = [...byPerson.entries()]
    .map(([srcId, list]) => ({
      srcId,
      ties: [...list].sort(tieOrder).slice(0, MAX_TIES_PER_PERSON),
      czk: list.reduce((s, t) => s + reachable(t), 0),
    }))
    .sort((a, b) => {
      const diff = b.czk - a.czk;
      if (diff !== 0) return diff;
      return a.srcId < b.srcId ? -1 : a.srcId > b.srcId ? 1 : 0;
    })
    .slice(0, MAX_GRAPH_PERSONS);

  // Výběr řádků (jedna vazba = jeden řádek) do stropu.
  const rows: { person: (typeof persons)[number]; tie: TerminalTieLike }[] = [];
  for (const p of persons) {
    for (const t of p.ties) {
      if (rows.length >= MAX_GRAPH_ROWS) break;
      rows.push({ person: p, tie: t });
    }
    if (rows.length >= MAX_GRAPH_ROWS) break;
  }

  const nodes: TerminalNode[] = [];
  const edges: TerminalEdge[] = [];
  const rowY = (i: number): number =>
    rows.length === 1 ? 50 : Math.round((12 + (i * 76) / (rows.length - 1)) * 10) / 10;

  // Uzly firem + peněz po řádcích.
  const personRows = new Map<string, number[]>();
  rows.forEach(({ person, tie }, i) => {
    const y = rowY(i);
    personRows.set(person.srcId, [...(personRows.get(person.srcId) ?? []), y]);
    const tieRef = claimRefPath(edgeClaimRef(tie.srcId, "linked_to", tie.dstId));
    nodes.push({
      id: `c:${tie.dstId}`,
      kind: "company",
      label: tie.company,
      sub: `IČO ${tie.ico} · ${TIE_CLASS_CS[tie.tieClass]}`,
      x: 52,
      y,
      href: claimRefPath(nodeClaimRef(tie.dstId)),
    });
    edges.push({
      from: `p:${tie.srcId}`,
      to: `c:${tie.dstId}`,
      label: TIE_CLASS_CS[tie.tieClass],
      trail: true,
      href: tieRef,
    });
    if (tie.contractCzk > 0) {
      nodes.push({
        id: `m:${tie.dstId}`,
        kind: "money",
        label: czkCompact(tie.contractCzk),
        sub: `${czechInt(tie.contractCount)} smluv · registr smluv`,
        x: 84,
        y,
        href: buildRegistryLinks(tie.ico, tie.source).registrSmluv,
      });
      edges.push({
        from: `c:${tie.dstId}`,
        to: `m:${tie.dstId}`,
        label: "dodávky státu",
        trail: true,
        href: buildRegistryLinks(tie.ico, tie.source).registrSmluv,
      });
    }
  });

  // Uzly osob — y = průměr řádků osoby.
  for (const p of persons) {
    const ys = personRows.get(p.srcId);
    if (!ys || ys.length === 0) continue;
    const first = p.ties[0];
    nodes.unshift({
      id: `p:${p.srcId}`,
      kind: "person",
      label: first.mpName,
      sub: first.club ? `poslanec · ${first.club}` : "poslanec",
      x: 14,
      y: Math.round((ys.reduce((s, v) => s + v, 0) / ys.length) * 10) / 10,
      href: first.pspId !== null ? `/penize/${first.pspId}` : null,
    });
  }

  return {
    nodes,
    edges,
    shownTies: rows.length,
    verifiedCount: verified.length,
    pendingCount,
    rejectedCount,
    verifiedCzk,
  };
}

// ── žebříček ověřených vazeb (tiskový výpis pod grafem) ─────────────────────

export interface TerminalLedgerRow {
  /** stabilní klíč řádku (src↔dst). */
  key: string;
  mpName: string;
  club: string | null;
  pspId: number | null;
  company: string;
  ico: string;
  tieClassCs: string;
  czk: number;
  czkCs: string;
  /** Účtenka původu vazby — /zdroj/<h.…>. */
  receiptHref: string;
  /** Kompilátor důkazního paketu poslance; null bez čitelného pspId. */
  paketHref: string | null;
}

const MAX_LEDGER_ROWS = 12;

/** Ověřené vazby jako auditní řádky, peníze DESC — verified-only disciplína
 *  platí i zde (jediný vstupní filtr, týž jako v grafu). */
export function deriveTerminalLedger(ties: readonly TerminalTieLike[]): TerminalLedgerRow[] {
  return ties
    .filter((t) => t.reviewState === "verified")
    .sort(tieOrder)
    .slice(0, MAX_LEDGER_ROWS)
    .map((t) => ({
      key: `${t.srcId}→${t.dstId}`,
      mpName: t.mpName,
      club: t.club,
      pspId: t.pspId,
      company: t.company,
      ico: t.ico,
      tieClassCs: TIE_CLASS_CS[t.tieClass],
      czk: reachable(t),
      czkCs: czkCompact(reachable(t)),
      receiptHref: claimRefPath(edgeClaimRef(t.srcId, "linked_to", t.dstId)),
      paketHref: t.pspId !== null ? `/penize/${t.pspId}/paket` : null,
    }));
}

// ── živý tail-log provenience ───────────────────────────────────────────────

export interface TailReviewLike {
  /** review_audit uuid — kotva /dukazy#z-<id>. */
  id: string;
  decision: "confirm" | "reject" | "needs-more";
  decidedAt: string;
  /** Labely endpointů (loader je rozliší; bez labelu degradace na id). */
  mp: string;
  company: string;
}

export interface TailChangeLike {
  id: string;
  eventType: string;
  recordedAt: string;
  src: string | null;
  dst: string | null;
  srcLabel: string | null;
  dstLabel: string | null;
  /** review_state !== "verified" na payloadu (vazby); u smluv bez významu. */
  pending: boolean;
}

export type TailTone = "green" | "amber" | "red";

export interface TailLine {
  id: string;
  /** ISO okamžik záznamu. */
  at: string;
  /** "28. 7. 2026 09:14:02" — deterministický český otisk času záznamu. */
  atCs: string;
  /** Doslovný pramen řádku (název záznamu, cituje se v hranaté závorce). */
  source: string;
  text: string;
  flag: string;
  tone: TailTone;
  /** Citační plocha řádku (/dukazy#z-…, /zdroj/…); null jen bez endpointů. */
  href: string | null;
}

/** ISO instant → "28. 7. 2026 09:14:02" (čas jen je-li v otisku přítomen). */
export function logStamp(iso: string): string {
  const date = czechDate(iso);
  const time = iso.slice(11, 19);
  return /^\d{2}:\d{2}:\d{2}$/.test(time) ? `${date} ${time}` : date;
}

const REVIEW_LINE: Record<TailReviewLike["decision"], { flag: string; tone: TailTone }> = {
  confirm: { flag: "vazba ověřena", tone: "green" },
  reject: { flag: "vazba zamítnuta", tone: "red" },
  "needs-more": { flag: "vyžádáno doplnění podkladů", tone: "amber" },
};

/** Change eventy, které tail-log PŘEBÍRÁ. review-decision je vyloučen záměrně
 *  (rozhodnutí nese pramen review_audit) — viz hlavička modulu. */
const TAIL_CHANGE_TYPES = new Set(["tie-new", "tie-changed", "contract-new"]);

const DEFAULT_TAIL_CAP = 24;

function changeLine(c: TailChangeLike): TailLine {
  const srcName = c.srcLabel ?? c.src ?? "?";
  const dstName = c.dstLabel ?? c.dst ?? "?";
  if (c.eventType === "contract-new") {
    return {
      id: c.id,
      at: c.recordedAt,
      atCs: logStamp(c.recordedAt),
      source: "registr smluv → graf",
      text: `smlouva v grafu: ${dstName} ← ${srcName}`,
      flag: "peněžní stopa",
      tone: "amber",
      href:
        c.src !== null && c.dst !== null
          ? claimRefPath(edgeClaimRef(c.src, "supplies", c.dst))
          : null,
    };
  }
  const isNew = c.eventType === "tie-new";
  return {
    id: c.id,
    at: c.recordedAt,
    atCs: logStamp(c.recordedAt),
    source: "graf · linked_to",
    text: `${isNew ? "nová vazba" : "vazba změněna"}: ${srcName} ↔ ${dstName}`,
    flag: c.pending ? "čeká na lidskou bránu" : "ověřeno",
    tone: c.pending ? "amber" : "green",
    href:
      c.src !== null && c.dst !== null
        ? claimRefPath(edgeClaimRef(c.src, "linked_to", c.dst))
        : null,
  };
}

/**
 * Sloučený tail-log: rozhodnutí brány + change eventy, čas záznamu DESC,
 * id ASC uvnitř téhož okamžiku (deterministický tiebreak), strop `cap`.
 * Nerozluštitelný čas se řadí NAKONEC — poškozený řádek nesmí předběhnout
 * datované záznamy.
 */
export function mergeTailLog(
  input: { reviews: readonly TailReviewLike[]; changes: readonly TailChangeLike[] },
  cap: number = DEFAULT_TAIL_CAP,
): TailLine[] {
  const lines: TailLine[] = [
    ...input.reviews.map((r): TailLine => {
      const grammar = REVIEW_LINE[r.decision];
      return {
        id: r.id,
        at: r.decidedAt,
        atCs: logStamp(r.decidedAt),
        source: "lidská brána",
        text: `${r.mp} ↔ ${r.company}`,
        flag: grammar.flag,
        tone: grammar.tone,
        href: `/dukazy#z-${r.id}`,
      };
    }),
    ...input.changes.filter((c) => TAIL_CHANGE_TYPES.has(c.eventType)).map(changeLine),
  ];
  const ts = (l: TailLine): number => {
    const parsed = Date.parse(l.at);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };
  lines.sort((a, b) => {
    const ta = ts(a);
    const tb = ts(b);
    if (ta !== tb) return tb > ta ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return lines.slice(0, Math.max(0, cap));
}
