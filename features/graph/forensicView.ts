/*
 * FORENZNÍ POHLED NA GRAF — čisté odvození (batch 7D).
 *
 * Referenční integrace forenzního režimu (features/shared/forensic/**):
 * ve forenzním režimu se /graf VÝCHOZÍM stavem přepíná na „jen ověřené
 * hrany" — krajina ukazuje pouze vazby, které prošly lidskou kontrolou
 * (review_state), a čtenáři to ŘEKNE (skryté se počítají, nemizí mlčky).
 *
 * Výjimka s pravidlem: hrany výslovně vyžádané čočky (kurátorská trasa,
 * spočítaná cesta „Spoj dva body") se NEfiltrují — vyžádaná odpověď
 * s vynechanými kroky by byla lež. Čekající kroky v čočce zůstávají
 * čárkované a jejich počet se přiznává zvlášť (keptPending).
 *
 * Čistý modul bez DOM (doktrína trailPath.ts) — všechno tady se testuje
 * na fixture datech ve forensicView.test.ts.
 */

import type { GraphEdge, GraphNode } from "./graphTypes";

/** Klíč hrany `src|rel|dst` — KANONICKÁ definice; jeviště (GraphStage) ji
 *  re-exportuje, aby čočka i filtr mluvily týmž jazykem. */
export const edgeKey = (e: { src: string; rel: string; dst: string }): string => `${e.src}|${e.rel}|${e.dst}`;

export interface ForensicEdgeView {
  edges: GraphEdge[];
  /** Kolik čekajících hran výchozí forenzní pohled skryl. */
  hiddenPending: number;
  /** Kolik čekajících hran zůstalo kvůli vyžádané čočce (přiznávají se). */
  keptPending: number;
}

/**
 * Výchozí forenzní filtr: ověřené hrany + čekající hrany držené čočkou.
 * Pořadí hran se zachovává (deterministický výstup pro plátno i testy).
 */
export function forensicEdges(edges: GraphEdge[], keep: ReadonlySet<string> = new Set()): ForensicEdgeView {
  const out: GraphEdge[] = [];
  let hiddenPending = 0;
  let keptPending = 0;
  for (const e of edges) {
    if (!e.pending) {
      out.push(e);
      continue;
    }
    if (keep.has(edgeKey(e))) {
      out.push(e);
      keptPending++;
    } else {
      hiddenPending++;
    }
  }
  return { edges: out, hiddenPending, keptPending };
}

/** Jedna relace v rozpadu stavů kontroly kolem uzlu. */
export interface ReviewBreakdownRow {
  rel: string;
  verified: number;
  pending: number;
}

/** Karta najetí — stavy lidské kontroly kolem uzlu BEZ klikání. */
export interface HoverCardModel {
  id: string;
  kind: GraphNode["kind"];
  label: string;
  /** Ověřené hrany uzlu v aktuálním výřezu grafu. */
  verified: number;
  /** Hrany čekající na kontrolu — počítají se VŽDY z nefiltrovaného
   *  seznamu, i když je výchozí pohled skrývá: karta říká pravdu o stavu
   *  záznamu, ne o tom, co je zrovna vidět. */
  pending: number;
  /** Rozpad po relacích, seřazený sestupně podle objemu (remíza: abecedně),
   *  oříznutý na `MAX_ROWS`. */
  rows: ReviewBreakdownRow[];
  /** Kolik dalších relací se do karty nevešlo. */
  more: number;
}

export const MAX_ROWS = 4;

export function hoverCardModel(node: GraphNode, edges: GraphEdge[]): HoverCardModel {
  const byRel = new Map<string, ReviewBreakdownRow>();
  let verified = 0;
  let pending = 0;
  for (const e of edges) {
    if (e.src !== node.id && e.dst !== node.id) continue;
    let row = byRel.get(e.rel);
    if (!row) {
      row = { rel: e.rel, verified: 0, pending: 0 };
      byRel.set(e.rel, row);
    }
    if (e.pending) {
      row.pending++;
      pending++;
    } else {
      row.verified++;
      verified++;
    }
  }
  const sorted = [...byRel.values()].sort(
    (a, b) =>
      b.verified + b.pending - (a.verified + a.pending) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0),
  );
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    verified,
    pending,
    rows: sorted.slice(0, MAX_ROWS),
    more: Math.max(0, sorted.length - MAX_ROWS),
  };
}
