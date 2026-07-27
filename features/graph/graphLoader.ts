/*
 * Čtecí vrstva playgroundu nad znalostním grafem.
 *
 * SERVEROVÝ MODUL — nikdy se neimportuje do klientské komponenty. Balíček
 * `server-only` v projektu není; hlídá to stejná konvence jako u ostatních
 * loaderů (getMoneyData, getLawData): tenhle komentář plus `getStore()`, které
 * v prohlížeči rovnou vyhodí výjimku (lib/db/pglite-store.ts).
 *
 * TŘI RŮZNÉ DOTAZY, TŘI RŮZNÉ NÁSTROJE — schválně:
 *
 *   hledání a sčítání  → lehká paměťová cache (id, druh, štítek, stupeň).
 *       ~3 200 řádků; postaví se jednou za život procesu a pak je našeptávač
 *       otázka mikrosekund. Diakritika se skládá v JS, takže „novak" najde
 *       „Novák" — což by `lower(label) like` nedokázal a `unaccent` v PGlite
 *       není.
 *   detail uzlu        → bodový dotaz přes primární klíč (getKgNodes).
 *       (Indexovaný sousedský dotaz kgNeighbours žije v repozitáři dál —
 *       vrátí se s drill-downem vítěze; klienty z kol 1–3 odnesl git.)
 *   mapa masy          → rozvržení celého grafu spočítané na serveru jednou
 *       za život procesu (getMapData): jádro silově, smlouvy deterministicky
 *       na prstenci kolem dodavatele. Podklad: graph-explorer-scale.md.
 *   trasy              → kurátorské výřezy spočítané z hran (getTrails),
 *       cache bez locale — částky jdou ven jako čísla a formátuje je klient.
 *
 * Cache je platná po dobu běhu procesu: graf je odvozený artefakt, mění se
 * dávkou (`npm run da:kg-compute`), ne za provozu. Po přepočtu je potřeba
 * restart — levnější než invalidace, kterou by nikdo netestoval.
 */

import { getStore } from "@/lib/db/store";
import { formattersFor } from "@/lib/format";
import { isLocale, defaultLocale } from "@/lib/i18n/config";
import { forceLayout, hashId } from "@/lib/kg/layout";
import { citableId, sourceLinksFor, type KgNodeKind } from "@/lib/kg/sourceLinks";
import { isKgNodeKind } from "./kindStyle";
import { KG_READ_CAP } from "@/lib/db/readCap";
import type {
  GraphEdge,
  GraphNode,
  GraphSeed,
  MapData,
  NodeDetail,
  NodeFact,
  SearchHit,
  Trail,
  TrailNode,
} from "./graphTypes";

// ── Cache ────────────────────────────────────────────────────────────────────

interface IndexEntry {
  id: string;
  kind: KgNodeKind;
  label: string;
  /** Štítek bez diakritiky a malými písmeny — porovnávací tvar. */
  folded: string;
  degree: number;
}

interface GraphIndex {
  entries: IndexEntry[];
  byId: Map<string, IndexEntry>;
  census: Array<{ kind: KgNodeKind; count: number }>;
  totalNodes: number;
  totalEdges: number;
}

let indexPromise: Promise<GraphIndex | null> | null = null;

/** „Nováková" → „novakova". Jediné místo, kde se skládá diakritika. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function buildIndex(): Promise<GraphIndex | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const nodes = await store.listKgNodes({ limit: KG_READ_CAP });
    if (nodes.length === 0) return null;

    // Stupeň se počítá z hran jednou; jinak by ho každý našeptávač dopočítával
    // znovu a „kolik toho na uzlu visí" je přitom hlavní řadicí klíč.
    const degree = new Map<string, number>();
    const edges = await store.listKgEdges({ limit: KG_READ_CAP });
    for (const e of edges) {
      degree.set(e.src, (degree.get(e.src) ?? 0) + 1);
      degree.set(e.dst, (degree.get(e.dst) ?? 0) + 1);
    }

    const entries: IndexEntry[] = [];
    const counts = new Map<KgNodeKind, number>();
    for (const n of nodes) {
      if (!isKgNodeKind(n.kind)) continue; // neznámý druh do plátna nepustíme
      entries.push({
        id: n.id,
        kind: n.kind,
        label: n.label,
        folded: fold(n.label),
        degree: degree.get(n.id) ?? 0,
      });
      counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
    }

    return {
      entries,
      byId: new Map(entries.map((e) => [e.id, e])),
      census: [...counts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
      totalNodes: entries.length,
      totalEdges: edges.length,
    };
  } catch (err) {
    // A transient hiccup (PGlite still initializing on cold start, a
    // one-off store error) must not get memoized identically to a
    // genuinely absent dataset — indexPromise ??= would otherwise pin this
    // null result for the process lifetime, permanently disabling the
    // whole Graph Playground until a restart even though the very next
    // call would have succeeded. Clear the memo so the next call retries.
    console.error("[graphLoader] buildIndex failed — will retry on next call", err);
    indexPromise = null;
    return null;
  }
}

function graphIndex(): Promise<GraphIndex | null> {
  indexPromise ??= buildIndex();
  return indexPromise;
}

// ── Veřejné čtení ────────────────────────────────────────────────────────────

const toNode = (e: IndexEntry): GraphNode => ({ id: e.id, kind: e.kind, label: e.label, degree: e.degree });

export async function getGraphSeed(): Promise<GraphSeed | null> {
  const idx = await graphIndex();
  if (!idx) return null;
  return {
    census: idx.census,
    totalNodes: idx.totalNodes,
    totalEdges: idx.totalEdges,
    // Vstupní body: nejpropojenější osoby a firmy — na izolovaném uzlu se
    // playground otevřít dá, ale nedá se z něj nikam jít.
    suggested: idx.entries
      .filter((e) => e.kind === "person" || e.kind === "company")
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 12)
      .map(toNode),
  };
}

export async function searchGraph(q: string, kinds: KgNodeKind[] | null, limit = 24): Promise<SearchHit[]> {
  const idx = await graphIndex();
  if (!idx) return [];
  const needle = fold(q);
  if (needle.length < 2) return [];

  const hits: Array<{ e: IndexEntry; rank: number }> = [];
  for (const e of idx.entries) {
    if (kinds && !kinds.includes(e.kind)) continue;
    const at = e.folded.indexOf(needle);
    if (at < 0) continue;
    // Shoda na začátku štítku bije shodu uprostřed; při rovnosti rozhodne stupeň.
    hits.push({ e, rank: at === 0 ? 0 : 1 });
  }
  hits.sort((a, b) => a.rank - b.rank || b.e.degree - a.e.degree || a.e.label.localeCompare(b.e.label, "cs"));
  return hits.slice(0, limit).map((h) => toNode(h.e));
}

const toEdge = (e: {
  src: string;
  dst: string;
  rel: string;
  weight: number | null;
  props: Record<string, unknown>;
}): GraphEdge => ({
  src: e.src,
  dst: e.dst,
  rel: e.rel,
  weight: e.weight,
  // Vazba osoba–firma je do lidské kontroly tvrzením stroje, ne faktem.
  pending: e.props?.review_state === "pending_review",
});

// ── Mapa masy (rozvržení celého grafu spočítané na serveru) ─────────────────

const MAP_WORLD = { width: 3200, height: 2100 };
/** Kolik smluv nejvýše vykreslit kolem jednoho dodavatele (viz getMapData). */
const MAP_CONTRACTS_PER_SUPPLIER = 12;

let mapPromise: Promise<MapData | null> | null = null;

const clampR2 = (v: number, min: number, max: number) =>
  Math.round(Math.max(min, Math.min(max, v)) * 100) / 100;

/**
 * Celý graf s pozicemi spočítanými jednou za život procesu:
 *
 *  - JÁDRO (vše kromě smluv, ~930 uzlů) projde silovým layoutem nad důkazními
 *    hranami — topologie pak něco říká: firmy u svých poslanců, zákony u tisků;
 *  - SMLOUVY (2 287 čistých listů, stupeň p50=1) se nesimulují: každá dostane
 *    deterministické místo na prstenci kolem svého dodavatele. Masa je vidět
 *    jako halo kolem firem a nestojí ani milisekundu simulace;
 *  - co_votes_with v payloadu vůbec není (96 % hustoty párů — matice, ne síť)
 *    a `degree` je proto DŮKAZNÍ stupeň: plný stupeň má každý poslanec ~200
 *    a velikost uzlu by nic nerozlišovala.
 *
 * Payload ~3 200 uzlů i se štítky ≈ stovky KB — pro prototyp v pořádku;
 * produkce by štítky dotahovala podle výřezu.
 */
export async function getMapData(): Promise<MapData | null> {
  mapPromise ??= (async () => {
    try {
      const store = await getStore();
      const idx = await graphIndex();
      if (!store || !idx) return null;

      const allEdges = await store.listKgEdges({ limit: KG_READ_CAP });
      const evidence = allEdges.filter((e) => e.rel !== "co_votes_with");

      const eDeg = new Map<string, number>();
      for (const e of evidence) {
        eDeg.set(e.src, (eDeg.get(e.src) ?? 0) + 1);
        eDeg.set(e.dst, (eDeg.get(e.dst) ?? 0) + 1);
      }

      const core = idx.entries.filter((e) => e.kind !== "contract");
      const coreIds = new Set(core.map((e) => e.id));
      const corePos = forceLayout(
        core,
        evidence.filter((e) => coreIds.has(e.src) && coreIds.has(e.dst)),
        { ...MAP_WORLD, iterations: 130, seed: "mapa" },
      );

      // supplies je firma → smlouva; kotva smlouvy = její dodavatel.
      const supplierOf = new Map<string, string>();
      for (const e of evidence) if (e.rel === "supplies") supplierOf.set(e.dst, e.src);

      // Batch-012 zvětšila korpus smluv z 2 287 na 152 788. Vykreslit je všechny znamená
      // poslat do prohlížeče přes 150 tisíc uzlů — plátno tím ztratí smysl i výkon.
      // Kolem každého dodavatele proto kreslíme jen omezený „prstenec" smluv; výběr je
      // deterministický (podle id), aby byl mezi načteními stabilní, a payload nese
      // počty, takže mapa nikdy netvrdí, že ukazuje celý graf.
      const contractEntries = idx.entries.filter((e) => e.kind === "contract");
      const perSupplier = new Map<string, number>();
      const shownContracts = new Set<string>();
      for (const entry of [...contractEntries].sort((a, b) => a.id.localeCompare(b.id))) {
        const supplier = supplierOf.get(entry.id) ?? "(bez dodavatele)";
        const n = perSupplier.get(supplier) ?? 0;
        if (n >= MAP_CONTRACTS_PER_SUPPLIER) continue;
        perSupplier.set(supplier, n + 1);
        shownContracts.add(entry.id);
      }

      const visible = idx.entries.filter((e) => e.kind !== "contract" || shownContracts.has(e.id));
      const nodes = visible.map((entry) => {
        const degree = eDeg.get(entry.id) ?? 0;
        if (entry.kind !== "contract") {
          const p = corePos.get(entry.id)!;
          return { id: entry.id, kind: entry.kind, label: entry.label, degree, x: p.x, y: p.y };
        }
        const supplier = supplierOf.get(entry.id);
        const anchor = supplier ? corePos.get(supplier) : undefined;
        const cx = anchor?.x ?? MAP_WORLD.width - 150;
        const cy = anchor?.y ?? MAP_WORLD.height - 120;
        const angle = (hashId(entry.id) / 0x100000000) * Math.PI * 2;
        const radius = 22 + (hashId(`r${entry.id}`) / 0x100000000) * 36;
        return {
          id: entry.id,
          kind: entry.kind,
          label: entry.label,
          degree,
          x: clampR2(cx + Math.cos(angle) * radius, 20, MAP_WORLD.width - 20),
          y: clampR2(cy + Math.sin(angle) * radius, 20, MAP_WORLD.height - 20),
        };
      });

      // Hrany jen mezi vykreslenými uzly — jinak by plátno dostalo hranu do prázdna.
      const visibleIds = new Set(visible.map((e) => e.id));
      const visibleEdges = evidence.filter((e) => visibleIds.has(e.src) && visibleIds.has(e.dst));

      return {
        nodes,
        edges: visibleEdges.map(toEdge),
        world: MAP_WORLD,
        omitted: {
          contractsShown: shownContracts.size,
          contractsTotal: contractEntries.length,
          perSupplierCap: MAP_CONTRACTS_PER_SUPPLIER,
        },
      };
    } catch (err) {
      // See buildIndex's catch above — don't memoize a transient failure.
      console.error("[graphLoader] getMapData failed — will retry on next call", err);
      mapPromise = null;
      return null;
    }
  })();
  return mapPromise;
}

// ── Trasy (kurátorské výřezy spočítané z hran) ───────────────────────────────

let trailsPromise: Promise<Trail[] | null> | null = null;

/**
 * Čtyři trasy = čtyři spočítané odpovědi. Nic se nevymýšlí: uzly a hrany
 * pocházejí z grafu, částky ze `supplies` vah a props firem. Locale se
 * cache nedotýká — částky jdou ven jako čísla (moneyCzk) a formátuje klient.
 */
export async function getTrails(): Promise<Trail[] | null> {
  trailsPromise ??= (async () => {
    try {
      const store = await getStore();
      const idx = await graphIndex();
      if (!store || !idx) return null;

      const [companies, bills, allEdges] = await Promise.all([
        store.listKgNodes({ kind: "company", limit: 10_000 }),
        store.listKgNodes({ kind: "bill", limit: 10_000 }),
        store.listKgEdges({ limit: KG_READ_CAP }),
      ]);

      const byRel = (rel: string) => allEdges.filter((e) => e.rel === rel);
      const linked = byRel("linked_to");
      const supplies = byRel("supplies");
      const amends = byRel("amends");
      const sponsors = byRel("sponsors");
      const influential = byRel("influential_in");

      const asNode = (id: string, column: number, moneyCzk?: number): TrailNode | null => {
        const e = idx.byId.get(id);
        if (!e) return null;
        return { id: e.id, kind: e.kind, label: e.label, degree: e.degree, column, order: 0, moneyCzk };
      };
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

      // Peníze firmy = smlouvy (váhy supplies) + dotace (prop uzlu).
      const contractCzk = new Map<string, number>();
      for (const e of supplies) contractCzk.set(e.src, (contractCzk.get(e.src) ?? 0) + num(e.weight));
      const companyMoney = new Map<string, number>();
      const donated = new Map<string, number>();
      for (const c of companies) {
        companyMoney.set(c.id, (contractCzk.get(c.id) ?? 0) + num(c.props?.subsidies_total_czk));
        const d = num(c.props?.donated_to_party_czk);
        if (d > 0) donated.set(c.id, d);
      }

      const companiesOf = new Map<string, string[]>();
      const personsOf = new Map<string, string[]>();
      for (const e of linked) {
        companiesOf.set(e.src, [...(companiesOf.get(e.src) ?? []), e.dst]);
        personsOf.set(e.dst, [...(personsOf.get(e.dst) ?? []), e.src]);
      }
      const pendingLink = new Set(
        linked.filter((e) => e.props?.review_state === "pending_review").map((e) => e.src + "|" + e.dst),
      );
      const linkEdge = (p: string, c: string): GraphEdge => ({
        src: p,
        dst: c,
        rel: "linked_to",
        weight: null,
        pending: pendingLink.has(p + "|" + c),
      });
      const plainEdge = (src: string, dst: string, rel: string): GraphEdge => ({
        src,
        dst,
        rel,
        weight: null,
        pending: false,
      });

      const trails: Trail[] = [];

      // 1 · Peníze kolem poslanců: top 8 podle peněz dosažitelných přes firmy.
      {
        const nodes: TrailNode[] = [];
        const edges: GraphEdge[] = [];
        const seenCo = new Set<string>();
        const top = [...companiesOf]
          .map(([p, cs]) => [p, cs.reduce((s, c) => s + (companyMoney.get(c) ?? 0), 0)] as const)
          .filter(([, m]) => m > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
        for (const [pid, money] of top) {
          const p = asNode(pid, 0, money);
          if (!p) continue;
          nodes.push(p);
          for (const cid of companiesOf.get(pid) ?? []) {
            if (!seenCo.has(cid)) {
              const c = asNode(cid, 1, companyMoney.get(cid));
              if (!c) continue;
              seenCo.add(cid);
              nodes.push(c);
            }
            edges.push(linkEdge(pid, cid));
          }
        }
        if (nodes.length > 0) trails.push({ key: "penize-poslancu", columns: ["person", "company"], nodes, edges });
      }

      // 2 · Nejpřepisovanější zákony: zákon ← tisky ← předkladatelé.
      {
        const amendCount = new Map<string, number>();
        for (const e of amends) amendCount.set(e.dst, (amendCount.get(e.dst) ?? 0) + 1);
        const flagged = new Set(bills.filter((b) => b.props?.flagged_conflict === true).map((b) => b.id));
        const nodes: TrailNode[] = [];
        const edges: GraphEdge[] = [];
        const billSet = new Set<string>();
        const personSet = new Set<string>();
        for (const [lawId] of [...amendCount].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
          const l = asNode(lawId, 2);
          if (!l) continue;
          nodes.push(l);
          const billIds = amends
            .filter((e) => e.dst === lawId)
            .map((e) => e.src)
            .sort((a, b) => Number(flagged.has(b)) - Number(flagged.has(a)))
            .slice(0, 3);
          for (const bid of billIds) {
            if (!billSet.has(bid)) {
              const b = asNode(bid, 1);
              if (!b) continue;
              billSet.add(bid);
              nodes.push(b);
            }
            edges.push(plainEdge(bid, lawId, "amends"));
            for (const sp of sponsors.filter((e) => e.dst === bid).slice(0, 2)) {
              if (!personSet.has(sp.src)) {
                const p = asNode(sp.src, 0);
                if (!p) continue;
                personSet.add(sp.src);
                nodes.push(p);
              }
              edges.push(plainEdge(sp.src, bid, "sponsors"));
            }
          }
        }
        if (nodes.length > 0)
          trails.push({ key: "nejnovelizovanejsi", columns: ["person", "bill", "law"], nodes, edges });
      }

      // 3 · Dárci stran: firmy s darem straně + poslanci s vazbou na ně.
      {
        const nodes: TrailNode[] = [];
        const edges: GraphEdge[] = [];
        const personSet = new Set<string>();
        for (const [cid, czk] of [...donated].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          const c = asNode(cid, 1, czk);
          if (!c) continue;
          nodes.push(c);
          for (const pid of personsOf.get(cid) ?? []) {
            if (!personSet.has(pid)) {
              const p = asNode(pid, 0);
              if (!p) continue;
              personSet.add(pid);
              nodes.push(p);
            }
            edges.push(linkEdge(pid, cid));
          }
        }
        if (nodes.length > 0) trails.push({ key: "darci-stran", columns: ["person", "company"], nodes, edges });
      }

      // 4 · Výbory a peníze: výbor ← členové s vazbami ← jejich firmy.
      {
        const withTies = new Set(companiesOf.keys());
        const byOrgan = new Map<string, string[]>();
        for (const e of influential) {
          if (!withTies.has(e.src)) continue;
          byOrgan.set(e.dst, [...(byOrgan.get(e.dst) ?? []), e.src]);
        }
        const nodes: TrailNode[] = [];
        const edges: GraphEdge[] = [];
        const personSet = new Set<string>();
        const coSet = new Set<string>();
        for (const [oid, members] of [...byOrgan].sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
          const o = asNode(oid, 0);
          if (!o) continue;
          nodes.push(o);
          const ranked = members
            .map(
              (pid) =>
                [pid, (companiesOf.get(pid) ?? []).reduce((s, c) => s + (companyMoney.get(c) ?? 0), 0)] as const,
            )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          for (const [pid, money] of ranked) {
            if (!personSet.has(pid)) {
              const p = asNode(pid, 1, money > 0 ? money : undefined);
              if (!p) continue;
              personSet.add(pid);
              nodes.push(p);
            }
            edges.push(plainEdge(pid, oid, "influential_in"));
            for (const cid of (companiesOf.get(pid) ?? []).slice(0, 2)) {
              if (!coSet.has(cid)) {
                const c = asNode(cid, 2, companyMoney.get(cid));
                if (!c) continue;
                coSet.add(cid);
                nodes.push(c);
              }
              edges.push(linkEdge(pid, cid));
            }
          }
        }
        if (nodes.length > 0)
          trails.push({ key: "vybory-a-penize", columns: ["organ", "person", "company"], nodes, edges });
      }

      // Pořadí ve sloupci = řádek sazby: podle peněz, pak podle stupně.
      // BEZ TOHOTO se celý sloupec položí na jeden bod (order 0) a z trasy
      // zbydou tři uzly — přesně tak se to jednou rozbilo.
      for (const trail of trails) {
        const perColumn = new Map<number, number>();
        for (const n of [...trail.nodes].sort(
          (a, b) => (b.moneyCzk ?? 0) - (a.moneyCzk ?? 0) || b.degree - a.degree,
        )) {
          const next = perColumn.get(n.column) ?? 0;
          n.order = next;
          perColumn.set(n.column, next + 1);
        }
      }

      return trails;
    } catch (err) {
      // See buildIndex's catch above — don't memoize a transient failure.
      console.error("[graphLoader] getTrails failed — will retry on next call", err);
      trailsPromise = null;
      return null;
    }
  })();
  return trailsPromise;
}

// ── Detail uzlu ──────────────────────────────────────────────────────────────

const FACT_KEYS: Partial<Record<KgNodeKind, string[]>> = {
  person: ["contribution_score", "rebellion_rate", "committee_count", "effort_tenure_class"],
  party: ["seats", "cohesion", "cohesion_votes"],
  organ: ["member_count", "organ_type"],
  company: ["ico", "subsidies_total_czk", "donated_to_party_czk", "donation_recipient_party"],
  contract: ["amount", "signedOn", "supplierIco"],
  bill: ["cislo", "origin", "flagged_conflict"],
  law: ["ref", "esbirka_title"],
  theme: ["classification", "opposed_fraction"],
  bloc: ["overall_win_rate"],
  notice: ["agenda", "spisovaZnacka", "institutionIco"],
};

/** Klíč z databáze zůstává čitelný: `contribution_score` → `contribution score`.
 *  Vlastní překlad by zakryl, které pole grafu se vlastně ukazuje. */
const humanKey = (k: string) => k.replace(/_/g, " ");

function formatFact(key: string, value: unknown, locale: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const f = formattersFor(isLocale(locale) ? locale : defaultLocale);
  if (typeof value === "boolean") return value ? "ano" : "ne";
  if (typeof value === "number") {
    if (key.endsWith("_czk") || key === "amount") return f.czk(value);
    if (Number.isInteger(value)) return f.int(value);
    return f.dec(value);
  }
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 159)}…` : value;
  return null;
}

export async function getNodeDetail(id: string, locale: string): Promise<NodeDetail | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const [row] = await store.getKgNodes([id]);
    if (!row || !isKgNodeKind(row.kind)) return null;
    const idx = await graphIndex();

    const props = row.props ?? {};
    const prov = (row.provenance ?? {}) as Record<string, unknown>;
    const facts: NodeFact[] = [];
    for (const key of FACT_KEYS[row.kind] ?? []) {
      const value = formatFact(key, props[key], locale);
      if (value !== null) facts.push({ label: humanKey(key), value });
    }

    const subject = { kind: row.kind as KgNodeKind, id: row.id, label: row.label, props };
    return {
      node: {
        id: row.id,
        kind: row.kind as KgNodeKind,
        label: row.label,
        degree: idx?.byId.get(row.id)?.degree ?? 0,
      },
      provenance: {
        pass: typeof prov.pass === "number" ? prov.pass : null,
        method: typeof prov.method === "string" ? prov.method : null,
        ref: typeof prov.ref === "string" ? prov.ref : null,
        computedAt: typeof prov.computedAt === "string" ? prov.computedAt : null,
      },
      citableId: citableId(subject),
      links: sourceLinksFor(subject),
      facts,
      degree: idx?.byId.get(row.id)?.degree ?? 0,
    };
  } catch {
    return null;
  }
}
