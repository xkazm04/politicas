// Tvary, které putují ze serveru na plátno. Záměrně užší než KgNodeRow:
// props celého uzlu můžou být tučné (dossier poslance má desítky klíčů) a
// plátno z nich potřebuje jen štítek a druh. Detail se dotahuje až na kliknutí.

import type { KgNodeKind, SourceLink } from "@/lib/kg/sourceLinks";
import type { GraphProvenance } from "@/lib/kg/graphProvenance";

export interface GraphNode {
  id: string;
  kind: KgNodeKind;
  label: string;
  /** Stupeň v CELÉM grafu, ne jen na plátně — říká „kolik se sem ještě vejde". */
  degree: number;
  /** Superuzel (agregát druhu v lupě): přepis poloměru na plátně. */
  size?: number;
  /** Druhý řádek popisku (peníze u tras, počty u agregátů). */
  sub?: string;
  /** Trvalé označení kroužkem — ohnisko: „okolí už rozkvetlé". */
  mark?: boolean;
}

/**
 * TŘI STAVY LIDSKÉ BRÁNY, ne jeden boolean.
 *
 * `kg_edge.props.review_state` má tři hodnoty a `rejected` je TERMINÁLNÍ stav,
 * který v grafu ZŮSTÁVÁ (jediný zapisovatel je ReviewRepository). Do 2026-09-04
 * je celá plocha grafu srážela na `pending: boolean`, takže člověkem ZAMÍTNUTÁ
 * vazba se kreslila plnou čarou, řadila se jako doložený krok a v balíčku
 * důkazů odcházela jako `review_state: verified` — nejhůř opravitelný artefakt
 * produktu certifikoval lidské odmítnutí jako ověření.
 *
 * `null` = relace lidskou branou NEPROCHÁZÍ (deterministické odvození, viz
 * `GATED_RELS` v features/shared/provenance/receipt.ts). Není to „ověřeno" ani
 * „čeká" — je to „nemá co ověřovat", a plocha to musí umět říct.
 */
export type GateStatus = "verified" | "pending_review" | "rejected";

/** Provenience hrany — {pass, method, ref} doslova z `kg_edge.provenance`;
 *  null = hrana žádnou nenese (a nedosazuje se žádná). */
export interface EdgeProvenance {
  pass: number | null;
  method: string | null;
  ref: string | null;
}

/** Odvozený stav „čárkovaně" pro jeviště. JEDINÁ definice — do 2026-09-04 ji
 *  loader opisoval na třech místech jako `review_state === "pending_review"`. */
export const pendingFromGate = (gate: GateStatus | null): boolean => gate === "pending_review";

export interface GraphEdge {
  src: string;
  dst: string;
  rel: string;
  weight: number | null;
  /**
   * ODVOZENÉ pole, drží se kvůli jevišti: `gate === "pending_review"`.
   * POZOR — `pending: false` NEZNAMENÁ „ověřeno": znamená jen „nečeká".
   * Kdo se ptá na doloženost, ptá se `gate`, ne tohohle.
   */
  pending: boolean;
  /** Stav lidské brány; null = negated relace (deterministické odvození). */
  gate: GateStatus | null;
  /** Provenience záznamu; null = hrana ji nenese. */
  provenance: EdgeProvenance | null;
  /** Trvalý štítek hrany (agregáty, částky) — kreslí se přes režii popisků. */
  label?: string;
  /** Hrana se kreslí až od tohoto přiblížení (smluvní spoje v mapě). */
  minK?: number;
}

/** Provenience záznamu grafu — {pass, method, ref, computedAt}. */
export interface NodeProvenance {
  pass: number | null;
  method: string | null;
  ref: string | null;
  computedAt: string | null;
}

export interface NodeFact {
  label: string;
  value: string;
}

export interface NodeDetail {
  node: GraphNode;
  provenance: NodeProvenance;
  /** Identifikátor k citaci i tam, kde odkaz neexistuje. */
  citableId: string | null;
  links: SourceLink[];
  facts: NodeFact[];
  /** Kolik hran uzel má celkem a kolik jich už je na plátně. */
  degree: number;
}

export interface SearchHit {
  id: string;
  kind: KgNodeKind;
  label: string;
  degree: number;
}

/** Uzel mapy — pozice spočítaná na serveru; degree = DŮKAZNÍ stupeň
 *  (bez co_votes_with), protože plný stupeň má každý poslanec ~200 a nic
 *  by nerozlišoval. */
export interface MapNodeDto extends GraphNode {
  x: number;
  y: number;
}

export interface MapData {
  nodes: MapNodeDto[];
  edges: GraphEdge[];
  world: { width: number; height: number };
  /** What the canvas is NOT showing, and why. The contract layer is bounded per supplier
   *  (a landscape of 152 788 identical dots is not a landscape), so the payload states the
   *  omission rather than letting the map imply it is the whole graph. */
  omitted: {
    contractsShown: number;
    contractsTotal: number;
    perSupplierCap: number;
    /** Case ④: zakázková vrstva se na mapě masy nekreslí (payload by nesl ~60 tisíc
     *  uzlů); mapa ji PŘIZNÁVÁ. Uzly zůstávají dohledatelné hledáním a detailem. */
    tendersTotal: number;
    procurementCompaniesTotal: number;
  };
}

/** Uzel trasy: sloupec sazby + peníze (formátuje klient podle locale). */
export interface TrailNode extends GraphNode {
  column: number;
  /** Řádek ve sloupci (přiděluje loader podle peněz/stupně). */
  order: number;
  moneyCzk?: number;
}

export interface Trail {
  key: string;
  /** Druh uzlu na sloupec — titulky se berou z graph.kinds. */
  columns: string[];
  nodes: TrailNode[];
  edges: GraphEdge[];
  /** Provenience hran TÉTO trasy po relacích — citace nese i to, čím vznikla. */
  provenance: GraphProvenance;
}

/** Jeden krok důkazní cesty „Spoj dva body" — sazený řádek účetní knihy. */
export interface PathLedgerRow {
  /** Pořadí kroku od 1. */
  step: number;
  from: GraphNode;
  to: GraphNode;
  rel: string;
  /** ODVOZENÉ z `gate` (viz GraphEdge.pending) — `false` není „ověřeno". */
  pending: boolean;
  /** Stav lidské brány kroku; null = negated relace. */
  gate: GateStatus | null;
  /** Provenience hrany kroku; null = hrana ji nenese. */
  provenance: EdgeProvenance | null;
  /** Trvalá adresa tvrzení kroku — segment do /zdroj/<ref>, aby byl každý
   *  krok cesty sám o sobě dohledatelná účtenka. */
  claimRef: string;
  /** Částka na smluvní hraně (supplies), jinak null — formátuje klient. */
  moneyCzk: number | null;
}

/** Jedna nalezená cesta: uzly pro čočku, hrany v uložené orientaci, kroky. */
export interface PathTrailDto {
  nodeIds: string[];
  /** Hrany v ULOŽENÉ orientaci — klíč src|rel|dst sedne na hrany mapy. */
  edges: GraphEdge[];
  ledger: PathLedgerRow[];
  pendingCount: number;
  moneyCzk: number;
  hops: number;
}

/** Odpověď „Spoj dva body". Prázdné `paths` při status=ok je taky odpověď:
 *  spojení v našich datech doložené není. */
export interface PathQueryResult {
  status: "ok" | "unavailable";
  from: GraphNode | null;
  to: GraphNode | null;
  /** Vítěz + stejně krátké alternativy, v otištěném pořadí. */
  paths: PathTrailDto[];
  totalFound: number;
  capped: boolean;
  /** Konstanty pravidla — UI je tiskne, ne hádá. */
  maxCost: number;
  hubDegree: number;
  /** Kolik ZAMÍTNUTÝCH hran hledání vůbec nepustilo do sousedství. Odmítnuté
   *  tvrzení není doložená vazba — a mlčky vynechaný krok by byl druhá lež,
   *  takže se počet tiskne (viz TrailFinder ruleNote, permalink.rule). */
  excludedRejected: number;
  /** Identita PRAVIDLA, kterým cesta vznikla (PATH_RULE_REF). Do otisku
   *  vstupuje, takže „stejná cesta, jiné pravidlo" se pozná. */
  ruleRef: string;
  /** Provenience hran vrácených cest po relacích. */
  provenance: GraphProvenance;
}

export interface GraphSeed {
  /** Sčítání uzlů podle druhu — podklad pro mapu i pro popis rozsahu. */
  census: Array<{ kind: KgNodeKind; count: number }>;
  totalNodes: number;
  totalEdges: number;
  /** Nabídnuté vstupní body: nejpropojenější uzly, na kterých má smysl začít. */
  suggested: SearchHit[];
  /**
   * Provenience CELÉHO grafu po relacích — kdo hrany napsal a jedním průchodem
   * ho psal, nebo víc. Napříč relacemi je `mixed` běžný stav (průchody běží po
   * relacích); `mixedWithinRel` je ta půlka, která znamená poloviční přepočet.
   */
  provenance: GraphProvenance;
}
