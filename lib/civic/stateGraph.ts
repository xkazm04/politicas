// Přehledový graf státu — jeden obrázek, který drží všech pět modulů:
// osoba ⋈ strana ⋈ firma ⋈ veřejné peníze ⋈ hlasování ⋈ zákon.
//
// Čistá derivace nad existujícím vzorkem (MPS, MONEY_TIES, ROLL_CALLS,
// LAW_CHANGES, PARTIES) — žádná nová mock data. Uzly nesou JEN topologii a
// souřadnice; popisky si komponenta dotahuje z i18n podle klíče entity
// (`content.moneyTies.<i>`, `content.rollCalls.<id>`, …), takže graf zůstává
// přeložitelný a nedrží duplikát textů.
//
// Souřadnice jsou zaokrouhlené na 2 desetinná místa — SVG čísla z výpočtu
// jinak driftují mezi SSR a CSR a rozbíjejí hydrataci (viz Hemicycle.tsx).

import { LAW_CHANGES, MONEY_TIES, MPS, PARTIES, ROLL_CALLS, type FeedRefs } from "./data";

export type StateNodeKind = "person" | "company" | "money" | "party" | "vote" | "law";

/** Pruh plátna: peníze nahoře, legislativa dole, osoby na svislé ose vlevo. */
export type StateBand = "spine" | "money" | "law";

interface NodeBase {
  id: string;
  x: number; // 0..100
  y: number; // 0..100
  band: StateBand;
  /** Kam uzel vede (spis poslance, plocha modulu). */
  href?: string;
}

export type StateNode =
  | (NodeBase & { kind: "person"; mpId: string })
  | (NodeBase & { kind: "company"; tie: number })
  | (NodeBase & { kind: "money"; tie: number })
  | (NodeBase & { kind: "party"; partyCode: string })
  | (NodeBase & { kind: "vote"; rollCallId: string })
  | (NodeBase & { kind: "law"; lawChangeId: string });

/** Druh hrany — popisek se bere z `dashboard.graph.rel.<rel>`, u vazeb z dat. */
export type EdgeRel = "tie" | "contract" | "donor" | "rebel" | "against" | "amends";

export interface StateEdge {
  from: string;
  to: string;
  rel: EdgeRel;
  /** Index do MONEY_TIES — pak popisek hrany = přeložený `kind` té vazby. */
  tie?: number;
  /** false = čeká na lidskou kontrolu → čárkovaně, do skóre se nepropisuje. */
  verified: boolean;
}

export interface StateGraph {
  nodes: StateNode[];
  edges: StateEdge[];
}

// ── Identifikátory uzlů ──────────────────────────────────────────────────────

export const personId = (mpId: string) => `p:${mpId}`;
export const companyId = (tie: number) => `c:${tie}`;
export const moneyId = (tie: number) => `m:${tie}`;
export const partyId = (code: string) => `y:${code}`;
export const voteId = (rollCallId: string) => `v:${rollCallId}`;
export const lawId = (lawChangeId: string) => `l:${lawChangeId}`;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Rovnoměrné rozložení n uzlů na úsečce [from, to]; 1 uzel = doprostřed. */
const spread = (i: number, n: number, from: number, to: number) =>
  n <= 1 ? r2((from + to) / 2) : r2(from + (i * (to - from)) / (n - 1));

/** Vazba nesoucí veřejné peníze — "—" znamená „firma bez zakázek". */
const hasMoney = (i: number) => MONEY_TIES[i].amount !== "—";

/**
 * Hlasování do výřezu: ta, která něco vypovídají — buď v nich někdo ze vzorku
 * vybočil z linie své strany, nebo z nich vyšla novela. Bere první tři
 * (ROLL_CALLS jsou od nejnovějšího), aby plátno zůstalo čitelné.
 */
export const FEATURED_VOTES = ROLL_CALLS.filter(
  (rc) => rc.rebels.length > 0 || LAW_CHANGES.some((lc) => lc.rollCallId === rc.id),
)
  .slice(0, 3)
  .map((rc) => rc.id);

// ── Přehledový graf ──────────────────────────────────────────────────────────

/**
 * Sloupcová sazba: osoby na svislé ose vlevo, z nich vpravo nahoru peněžní
 * pruh (firma → veřejné peníze / dar straně) a vpravo dolů legislativní pruh
 * (hlasování → novelizovaný zákon). Nepropojená osoba je legitimní stav —
 * poslanec bez nalezené vazby v tomto výřezu, ne chybějící data.
 */
export function buildStateGraph(): StateGraph {
  const nodes: StateNode[] = [];
  const edges: StateEdge[] = [];

  MPS.forEach((mp, i) => {
    nodes.push({
      id: personId(mp.id),
      kind: "person",
      mpId: mp.id,
      band: "spine",
      href: `/poslanec/${mp.id}`,
      x: 13,
      // Spodní mez je 91, ne 94: pod uzlem visí ještě podtitul a stranický
      // čip, které by se u posledního řádku ořízly o spodní hranu viewBoxu.
      y: spread(i, MPS.length, 8, 91),
    });
  });

  // Peněžní pruh — jedna firma = jeden řádek; peníze až za ní.
  MONEY_TIES.forEach((tie, i) => {
    const y = spread(i, MONEY_TIES.length, 8, 44);
    nodes.push({ id: companyId(i), kind: "company", tie: i, band: "money", href: "/penize", x: 42, y });
    edges.push({ from: personId(tie.mpId), to: companyId(i), rel: "tie", tie: i, verified: tie.verified });

    if (hasMoney(i)) {
      nodes.push({ id: moneyId(i), kind: "money", tie: i, band: "money", href: "/penize", x: 74, y });
      edges.push({ from: companyId(i), to: moneyId(i), rel: "contract", tie: i, verified: tie.verified });
    }
  });

  // Dar straně — jediná hrana firma → strana, kterou vzorek doloží.
  const donorTie = MONEY_TIES.findIndex((t) => t.donorParty);
  if (donorTie >= 0) {
    const code = MONEY_TIES[donorTie].donorParty!;
    if (PARTIES.some((p) => p.code === code)) {
      nodes.push({ id: partyId(code), kind: "party", partyCode: code, band: "money", x: 74, y: 54 });
      edges.push({
        from: companyId(donorTie),
        to: partyId(code),
        rel: "donor",
        verified: MONEY_TIES[donorTie].verified,
      });
    }
  }

  // Legislativní pruh — hlasování a zákon, který z něj vyšel.
  FEATURED_VOTES.forEach((rcId, i) => {
    const rc = ROLL_CALLS.find((r) => r.id === rcId)!;
    const y = spread(i, FEATURED_VOTES.length, 62, 91);
    nodes.push({ id: voteId(rcId), kind: "vote", rollCallId: rcId, band: "law", href: "/hlasovani", x: 42, y });

    for (const mp of MPS) {
      const choice = rc.perMP[mp.id];
      if (rc.rebels.includes(mp.id)) {
        edges.push({ from: personId(mp.id), to: voteId(rcId), rel: "rebel", verified: true });
      } else if (choice === "proti" && rc.result === "přijato") {
        edges.push({ from: personId(mp.id), to: voteId(rcId), rel: "against", verified: true });
      }
    }

    const change = LAW_CHANGES.find((lc) => lc.rollCallId === rcId);
    if (change) {
      nodes.push({
        id: lawId(change.id),
        kind: "law",
        lawChangeId: change.id,
        band: "law",
        href: "/zakony",
        x: 74,
        y,
      });
      edges.push({ from: voteId(rcId), to: lawId(change.id), rel: "amends", verified: true });
    }
  });

  return { nodes, edges };
}

// ── Feed ⋈ graf ──────────────────────────────────────────────────────────────

/**
 * Uzly, kterých se událost dotkla, omezené na to, co plátno skutečně kreslí.
 * Prázdné pole = agregátní událost bez uzlu (např. čtvrtletní přepočet) —
 * takové řádky se nikdy nefiltrují pryč.
 */
export function nodesForRefs(refs: FeedRefs | undefined, graph: StateGraph): string[] {
  if (!refs) return [];
  const present = new Set(graph.nodes.map((n) => n.id));
  const out: string[] = [];
  const take = (id: string) => {
    if (present.has(id) && !out.includes(id)) out.push(id);
  };

  refs.mps?.forEach((id) => take(personId(id)));
  refs.ties?.forEach((i) => {
    take(companyId(i));
    take(moneyId(i));
  });
  refs.rollCalls?.forEach((id) => take(voteId(id)));
  refs.lawChanges?.forEach((id) => take(lawId(id)));
  refs.parties?.forEach((code) => take(partyId(code)));
  return out;
}

/** Uzel + jeho bezprostřední okolí — podklad pro rozsvícení stopy. */
export function neighbourhood(nodeId: string, edges: StateEdge[]): Set<string> {
  const s = new Set<string>([nodeId]);
  for (const e of edges) {
    if (e.from === nodeId) s.add(e.to);
    if (e.to === nodeId) s.add(e.from);
  }
  return s;
}

export const degreeOf = (nodeId: string, edges: StateEdge[]) =>
  edges.filter((e) => e.from === nodeId || e.to === nodeId).length;
