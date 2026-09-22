/*
 * FORENZNÍ POHLED NA GRAF — čisté odvození (batch 7D).
 *
 * Referenční integrace forenzního režimu (features/shared/forensic/**):
 * ve forenzním režimu se /graf VÝCHOZÍM stavem přepíná na „jen ověřené
 * hrany" — krajina ukazuje pouze vazby, které prošly lidskou kontrolou
 * (review_state), a čtenáři to ŘEKNE (skryté se počítají, nemizí mlčky).
 *
 * TŘI KOŠE, NE DVA (2026-09-04). Do té doby filtr znal jen `pending`, takže
 * hrana, kterou člověk ZAMÍTL, procházela „jen ověřenou" krajinou jako ověřená
 * — forenzní režim, jehož jediný smysl je ukázat prokázané vazby, tiše
 * propouštěl to jediné tvrzení, o kterém VÍME, že neplatí. Teď se skrývají
 * obojí a počítají se ZVLÁŠŤ: „čeká na kontrolu" a „kontrola ho odmítla" jsou
 * dvě různé věty a jedno číslo z nich udělat nesmí.
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
  /** Kolik ZAMÍTNUTÝCH hran pohled skryl — nikdy se neslévá s hiddenPending. */
  hiddenRejected: number;
  /**
   * Kolik zamítnutých hran zůstalo kvůli vyžádané čočce. Vyžádaná odpověď se
   * nefiltruje ani tady (vynechaný krok by byl lež), ale kreslí se OZNAČENÁ:
   * jeviště pro ni má vlastní tah a tohle je její počet.
   */
  keptRejected: number;
}

/**
 * Výchozí forenzní filtr: ověřené hrany + čekající hrany držené čočkou.
 * Pořadí hran se zachovává (deterministický výstup pro plátno i testy).
 */
export function forensicEdges(edges: GraphEdge[], keep: ReadonlySet<string> = new Set()): ForensicEdgeView {
  const out: GraphEdge[] = [];
  let hiddenPending = 0;
  let keptPending = 0;
  let hiddenRejected = 0;
  let keptRejected = 0;
  for (const e of edges) {
    // `gate === null` = negated relace (deterministické odvození): nemá co
    // ověřovat, takže ji forenzní pohled neskrývá — a netvrdí o ní „ověřeno".
    if (e.gate !== "pending_review" && e.gate !== "rejected") {
      out.push(e);
      continue;
    }
    const requested = keep.has(edgeKey(e));
    if (requested) out.push(e);
    if (e.gate === "rejected") {
      if (requested) keptRejected++;
      else hiddenRejected++;
    } else if (requested) keptPending++;
    else hiddenPending++;
  }
  return { edges: out, hiddenPending, keptPending, hiddenRejected, keptRejected };
}

/** Jedna relace v rozpadu stavů kontroly kolem uzlu. */
export interface ReviewBreakdownRow {
  rel: string;
  verified: number;
  pending: number;
  /** Hrany, které lidská kontrola ODMÍTLA — vlastní sloupec, nikdy přičtené
   *  k ověřeným (do 2026-09-04 se přesně tam počítaly). */
  rejected: number;
  /** Hrany negated relace: brána se jich netýká. Nejsou ani „ověřeno", ani
   *  „čeká" — a mlčky přičíst je k ověřeným by bylo tvrzení navíc. */
  ungated: number;
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
  /** Hrany, které kontrola odmítla — týmž pravidlem jako `pending`. */
  rejected: number;
  /** Hrany relací, které branou neprocházejí (deterministické odvození). */
  ungated: number;
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
  let rejected = 0;
  let ungated = 0;
  for (const e of edges) {
    if (e.src !== node.id && e.dst !== node.id) continue;
    let row = byRel.get(e.rel);
    if (!row) {
      row = { rel: e.rel, verified: 0, pending: 0, rejected: 0, ungated: 0 };
      byRel.set(e.rel, row);
    }
    // Čtyři stavy, čtyři sloupce. „Ověřeno" je tvrzení, které smí padnout jen
    // o hraně, u které to člověk skutečně napsal.
    if (e.gate === "pending_review") {
      row.pending++;
      pending++;
    } else if (e.gate === "rejected") {
      row.rejected++;
      rejected++;
    } else if (e.gate === "verified") {
      row.verified++;
      verified++;
    } else {
      row.ungated++;
      ungated++;
    }
  }
  const total = (r: ReviewBreakdownRow) => r.verified + r.pending + r.rejected + r.ungated;
  const sorted = [...byRel.values()].sort(
    (a, b) => total(b) - total(a) || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0),
  );
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    verified,
    pending,
    rejected,
    ungated,
    rows: sorted.slice(0, MAX_ROWS),
    more: Math.max(0, sorted.length - MAX_ROWS),
  };
}
