// Tvary, které putují ze serveru na plátno. Záměrně užší než KgNodeRow:
// props celého uzlu můžou být tučné (dossier poslance má desítky klíčů) a
// plátno z nich potřebuje jen štítek a druh. Detail se dotahuje až na kliknutí.

import type { KgNodeKind, SourceLink } from "@/lib/kg/sourceLinks";

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

export interface GraphEdge {
  src: string;
  dst: string;
  rel: string;
  weight: number | null;
  /** Hrana čeká na lidskou kontrolu (review_state) — kreslí se čárkovaně. */
  pending: boolean;
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
}

export interface GraphSeed {
  /** Sčítání uzlů podle druhu — podklad pro mapu i pro popis rozsahu. */
  census: Array<{ kind: KgNodeKind; count: number }>;
  totalNodes: number;
  totalEdges: number;
  /** Nabídnuté vstupní body: nejpropojenější uzly, na kterých má smysl začít. */
  suggested: SearchHit[];
}
