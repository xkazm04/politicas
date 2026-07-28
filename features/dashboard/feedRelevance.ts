/*
 * PRAVIDLO RELEVANCE pro vzorkový pás provozu — čistá funkce.
 *
 * Zaměřovač u řádku má připnout uzel, o KTERÉM ŘÁDEK JE. Do 2026-07-28 bral
 * `nodeIds[0]`, tedy první prvek pole poskládaného v pořadí mps → ties →
 * rollCalls → lawChanges → parties (`lib/civic/stateGraph.ts#nodesForRefs`).
 * To není pravidlo, to je detail sestavení: řádek o dvou peněžních vazbách
 * připínal poslance, protože poslanec je v tom výčtu první.
 *
 * Pravidlo je proto vázané na DRUH události, který si událost nese sama:
 *   money → firma (uzel `company`), o té je věta „nová smlouva … (vazba: X)"
 *   vote  → hlasování
 *   law   → novelizovaný zákon
 *   score → poslanec, jehož skóre se pohnulo
 * Když druh svůj uzel v tomhle výřezu nemá, vrací se `null` — řádek pak
 * zaměřovač nenabídne a řekne proč. Dosadit náhradu by znamenalo připnout
 * entitu, o které řádek není; to je přesně ta vada, kterou pravidlo ruší.
 *
 * Vzorkový graf žije jen jako označený fallback (reálný výřez má vlastní,
 * silnější pravidlo — `DatedFact.subjectRef`), ale fallback, který připíná
 * náhodně, je pořád rozbité UI.
 */

import type { FeedEvent } from "@/lib/civic/data";
import {
  companyId,
  lawId,
  moneyId,
  partyId,
  personId,
  voteId,
  type StateGraph,
} from "@/lib/civic/stateGraph";

/**
 * Kandidáti na podmět v pořadí, v jakém je druh události preferuje. Vrací se
 * první z nich, který je ve výřezu skutečně nakreslený.
 */
function candidates(event: FeedEvent): string[] {
  const r = event.refs;
  if (!r) return [];
  const mps = (r.mps ?? []).map(personId);
  const companies = (r.ties ?? []).map(companyId);
  const money = (r.ties ?? []).map(moneyId);
  const votes = (r.rollCalls ?? []).map(voteId);
  const laws = (r.lawChanges ?? []).map(lawId);
  const parties = (r.parties ?? []).map(partyId);

  switch (event.kind) {
    // Peněžní událost je o firmě; peněžní uzel je až její následek, poslanec
    // je kontext (a je v grafu tak jako tak dostupný jedním krokem po hraně).
    case "money":
      return [...companies, ...money, ...parties, ...mps];
    case "vote":
      return [...votes, ...mps];
    case "law":
      return [...laws, ...votes];
    case "score":
      return [...mps];
  }
}

/**
 * Uzel, který zaměřovač řádku připne — nebo `null`, když podmět řádku tenhle
 * výřez nekreslí.
 */
export function primaryNodeForEvent(event: FeedEvent, graph: StateGraph): string | null {
  const present = new Set(graph.nodes.map((n) => n.id));
  return candidates(event).find((id) => present.has(id)) ?? null;
}
