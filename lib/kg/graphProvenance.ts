/*
 * PROVENIENCE GRAFU JAKO POPULACE — čistá agregace, žádné I/O, žádný server.
 *
 * Uzel na /graf svou provenienci nese (`graphLoader.getNodeDetail`), ale GRAF
 * jako celek žádnou nepublikoval: cesta ani trasa nenesly ani jeden `pass`,
 * a rozcestí ukazovalo jen počty. Přitom přesně tuhle otázku už jednou
 * vyřešil žebříček — `summarizeContributionProvenance`
 * (features/civicscore/provenance.ts) nad `contribution_provenance`.
 *
 * Tvar se odsud ZRCADLÍ, neimportuje: `lib/**` nesmí záviset na `features/**`,
 * a dvě agregace jednoho tvaru se čtou stejně. Rozdíl je klíč seskupení —
 * žebříček agreguje přes JEDNU populaci (poslance), graf přes RELACE, protože
 * hrany různých relací píší různé průchody. Průchod tenderů (68) přistál na
 * skladu, který pro ostatní relace pořád nese starší průchody, takže graf je
 * KONSTRUKČNĚ `mixed` napříč relacemi. To je v pořádku publikovat jako
 * tabulku variant a špatně publikovat jako jedno číslo.
 *
 * PRAVIDLO (stejné jako u žebříčku): hlásí se, co DATA nesou, porovná se to
 * s tím, co KÓD vyhlašuje, a neshoda se nikdy neslije do jednoho úhledného
 * čísla. `absent` navíc netvrdí nic — chybějící provenience není průchod č. 0
 * (missing-is-not-zero) a nesmí se dopočítat.
 *
 * ALARM vs. INFORMACE — dvě různé „mixed":
 *   mixed NAPŘÍČ relacemi   … normální stav postupně přepočítávaného grafu;
 *   mixed UVNITŘ jedné relace … poloviční přepočet: část hran té relace píše
 *                               jeden průchod, část jiný. To je poplach.
 */

/** Jedna nalezená kombinace `{pass, ref, method}` s velikostí své populace. */
export interface GraphProvenanceVariant {
  pass: number | null;
  ref: string | null;
  method: string | null;
  /** Kolik hran tuhle kombinaci nese. */
  count: number;
}

/** Provenience JEDNÉ relace nad hranami, které o ní plocha ví. */
export interface RelProvenance {
  rel: string;
  /**
   * `uniform` — každá orazítkovaná hrana relace nese TUTÉŽ kombinaci;
   * `mixed`   — víc kombinací (poloviční přepočet: poplach, ne informace);
   * `absent`  — ani jedna hrana relace provenienci nenese.
   */
  state: "uniform" | "mixed" | "absent";
  /** Průchod / odkaz na pravidlo / metoda — JEN při `uniform`; jinak null:
   *  `mixed` populace ŽÁDNÝ jeden průchod nemá a nesmí si ho vymyslet. */
  pass: number | null;
  ref: string | null;
  method: string | null;
  /** Všechny kombinace, count desc → pass desc → ref — pořadí je přibité,
   *  aby se hlášení daly diffovat. */
  variants: GraphProvenanceVariant[];
  /** Hrany s provenienci / hrany přečtené. */
  coverage: { stamped: number; read: number };
}

export interface GraphProvenance {
  /** Relace v otištěném pořadí: nejvíc hran první, remíza abecedně. */
  rels: RelProvenance[];
  /**
   * Souhrn NAD RELACEMI: `uniform` jen když každá relace je uniform A všechny
   * se shodnou na téže kombinaci; `mixed` jinak; `absent` když nic není
   * orazítkované. Napříč relacemi je `mixed` běžný a informativní stav — kdo
   * hledá poplach, dívá se na `mixedWithinRel`.
   */
  state: "uniform" | "mixed" | "absent";
  pass: number | null;
  ref: string | null;
  /** Relace, které jsou rozpolcené SAMY V SOBĚ — poloviční přepočet. */
  mixedWithinRel: string[];
  /** Hrany s provenienci / hrany přečtené, přes celou populaci. */
  coverage: { stamped: number; read: number };
}

/**
 * Hrana tak, jak ji agregace potřebuje — užší než KgEdgeRow, ale dost široká
 * i pro `GraphEdge.provenance` ({pass, method, ref}), takže se tatáž agregace
 * pouští nad řádky skladu i nad hranami, které už doputovaly na plátno.
 */
export interface ProvenancedEdge {
  rel: string;
  provenance?: { pass?: unknown; ref?: unknown; method?: unknown } | null;
}

/**
 * Prázdná agregace — „nic jsme nečetli", ne „nic tu není". Slouží jen jako
 * počáteční hodnota tam, kde se skutečná agregace dopočítá o krok později;
 * nikdy se nevydává za odpověď o skutečném grafu (`coverage.read === 0` to
 * čtenáři i sentinelu prozradí).
 */
export const EMPTY_GRAPH_PROVENANCE: GraphProvenance = {
  rels: [],
  state: "absent",
  pass: null,
  ref: null,
  mixedWithinRel: [],
  coverage: { stamped: 0, read: 0 },
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const readProv = (
  prov: Record<string, unknown> | null | undefined,
): { pass: number | null; ref: string | null; method: string | null } | null => {
  if (!prov || typeof prov !== "object") return null;
  const pass = num(prov.pass);
  const ref = str(prov.ref);
  const method = str(prov.method);
  // Prázdný objekt NENÍ provenience. Kdyby se počítal, `coverage.stamped` by
  // rostlo o hrany, které o svém původu neříkají nic.
  if (pass === null && ref === null && method === null) return null;
  return { pass, ref, method };
};

const variantKey = (v: { pass: number | null; ref: string | null; method: string | null }) =>
  `${v.pass ?? "—"}|${v.ref ?? "—"}|${v.method ?? "—"}`;

const sortVariants = (a: GraphProvenanceVariant, b: GraphProvenanceVariant) =>
  b.count - a.count ||
  (b.pass ?? -1) - (a.pass ?? -1) ||
  (a.ref ?? "").localeCompare(b.ref ?? "") ||
  (a.method ?? "").localeCompare(b.method ?? "");

/**
 * Agreguj `kg_edge.provenance` po relacích. Deterministické: výsledek závisí
 * jen na multimnožině vstupu, nikdy na pořadí iterace.
 */
export function summarizeGraphProvenance(edges: readonly ProvenancedEdge[]): GraphProvenance {
  const byRel = new Map<string, { buckets: Map<string, GraphProvenanceVariant>; read: number; stamped: number }>();

  for (const e of edges) {
    let slot = byRel.get(e.rel);
    if (!slot) {
      slot = { buckets: new Map(), read: 0, stamped: 0 };
      byRel.set(e.rel, slot);
    }
    slot.read++;
    const p = readProv(e.provenance);
    if (!p) continue;
    slot.stamped++;
    const key = variantKey(p);
    const hit = slot.buckets.get(key);
    if (hit) hit.count++;
    else slot.buckets.set(key, { pass: p.pass, ref: p.ref, method: p.method, count: 1 });
  }

  const rels: RelProvenance[] = [...byRel.entries()]
    .map(([rel, slot]) => {
      const variants = [...slot.buckets.values()].sort(sortVariants);
      const state: RelProvenance["state"] =
        variants.length === 0 ? "absent" : variants.length === 1 ? "uniform" : "mixed";
      return {
        rel,
        state,
        pass: state === "uniform" ? variants[0].pass : null,
        ref: state === "uniform" ? variants[0].ref : null,
        method: state === "uniform" ? variants[0].method : null,
        variants,
        coverage: { stamped: slot.stamped, read: slot.read },
      };
    })
    .sort((a, b) => b.coverage.read - a.coverage.read || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const stamped = rels.reduce((s, r) => s + r.coverage.stamped, 0);
  const read = rels.reduce((s, r) => s + r.coverage.read, 0);

  // Souhrn nad relacemi: jedna kombinace přes celý graf, nebo žádná. Bere se
  // z relací, které něco NESOU — relace bez razítka souhrnu neodporuje, jen
  // k němu nepřispívá (a `coverage` říká, kolik jich je).
  const stampedRels = rels.filter((r) => r.state !== "absent");
  const allKeys = new Set(stampedRels.flatMap((r) => r.variants.map(variantKey)));
  const state: GraphProvenance["state"] =
    stampedRels.length === 0 ? "absent" : allKeys.size === 1 ? "uniform" : "mixed";
  const only = state === "uniform" ? stampedRels[0].variants[0] : null;

  return {
    rels,
    state,
    pass: only?.pass ?? null,
    ref: only?.ref ?? null,
    mixedWithinRel: rels.filter((r) => r.state === "mixed").map((r) => r.rel),
    coverage: { stamped, read },
  };
}
