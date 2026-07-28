/*
 * Výřez znalostního grafu pro velín — REÁLNÁ data, čistá funkce.
 *
 * Žádný import ze serveru: vstupem jsou hotové projekce, které už spočítaly
 * loadery vlastnící jejich doménu (`getMoneyData` pro peníze, `getLawData` pro
 * legislativu). Velín tedy nic nepočítá znovu a nemůže se s modulem rozejít —
 * a protože je to čistá funkce, drží ji stejné invarianty jako vzorkový
 * `buildStateGraph()` (viz stateSlice.test.ts).
 *
 * ── PRAVIDLO VÝBĚRU (schváleno 2026-07-28; na ploše se vypisuje, ne skrývá) ──
 *
 * Výřez NENÍ žebříček. Jakékoli řazení podle metriky (peníze, stupeň uzlu,
 * čerstvost smlouvy) by na titulní straně vyneslo tvrzení o konkrétních
 * poslancích, které data neunesou — u řazení podle peněz je to obžaloba, u
 * řazení podle čerstvosti smlouvy obžaloba sousedstvím (nejnovější smlouvy v
 * grafu jsou nemocnice a vodárny, tedy peníze INSTITUCE, ne poslance).
 * Řadíme proto podle ČÍSLA MANDÁTU (pspId) vzestupně — registrové číslo, které
 * o nikom nic netvrdí.
 *
 * Semena:
 *   1. prvních N poslanců podle čísla mandátu z populace, která má v grafu
 *      ZÁROVEŇ firemní vazbu i vlastní tisk novelizující zákon. Průnik je tam
 *      proto, aby výřez unesl všech šest druhů uzlů — jinak by se peněžní a
 *      legislativní pruh nepotkaly na jedné osobě;
 *   2. + poslanci napojení na firmy, které jako JEDINÉ v grafu darovaly straně
 *      (jsou v korpusu dvě) — bez nich by ve výřezu nebyl uzel strany.
 *
 * Uvnitř semene je výběr taky bez metriky: první firma podle IČO, první tisk
 * podle čísla tisku, první zákon podle čísla předpisu.
 *
 * ── CO SE DO PENĚŽNÍHO PRUHU NESMÍ ──
 *
 * Peníze kreslíme jen u vazeb typu vlastník/jednatel nebo člen vedení — stejné
 * pravidlo přisouzení, jaké používá /penize. U „steward" vazby (poslanec sedí v
 * orgánu veřejné instituce) jsou smlouvy aktivitou TÉ INSTITUCE; kdyby je výřez
 * pověsil na poslance, tvrdil by něco nepravdivého. Semeno, které má jen
 * steward vazby, tedy v peněžním pruhu prostě nic nemá.
 */

import { r2, spread, type StateEdge, type StateGraph, type StateNode } from "@/lib/civic/stateGraph";
import type { FactBill, FactTie } from "./datedFacts";

// ── Vstupní projekce (strukturální — MoneyData/LawData je splňují) ──────────

export interface SliceTie {
  companyId: string;
  /** Osmimístné IČO v kanonickém tvaru — je to i id uzlu firmy. */
  ico: string;
  company: string;
  role: string;
  /** "owner-operator" | "manager" | "steward" */
  tieClass: string;
  /** "verified" | "pending_review" | "rejected" */
  reviewState: string;
  contractCzk: number;
  contractCount: number;
  donatedToPartyCzk: number | null;
  donationRecipientParty: string | null;
  /** Rejstříkem potvrzené trvání role — datovaná fakta pro knihu provozu. */
  roleValidFrom?: string | null;
  roleValidTo?: string | null;
}

export interface SliceMp {
  pspId: number;
  name: string;
  ties: SliceTie[];
}

export interface SliceBill {
  cislo: number | null;
  title: string;
  sponsors: { pspId: number; name: string }[];
  amendedLaws: { urn: string; ref: string; label: string; title: string | null }[];
  /** Formální přikázání výborům — datovaná fakta pro knihu provozu. */
  committees?: { organLabel: string; role: string; assignedOn: string | null }[];
  fateSb?: string | null;
  fatePublishedOn?: string | null;
}

export interface SliceInput {
  /** Poslanci s aspoň jednou vazbou (getMoneyData().mps). */
  mps: SliceMp[];
  /** Sněmovní tisky (getLawData().bills). */
  bills: SliceBill[];
  /** Celkový počet poslanců v grafu — do věty o populaci. */
  chamberTotal: number;
  /** pspId → barva klubu (datový údaj z kontribučního loaderu). */
  clubColorByPspId?: Record<number, string>;
  /** zkratka strany → id uzlu strany v grafu (`psp:organ:<id>`). */
  partyNodeIdByLabel?: Record<string, string>;
}

/** Čísla, kterými plocha vypíše pravidlo výběru. Renderují se, takže se nemohou
 *  rozejít s tím, co výřez skutečně kreslí. */
export interface StateSliceRule {
  seeds: number;
  dualBandTotal: number;
  chamberTotal: number;
  donorCompanies: number;
  tiesDrawn: number;
  pendingTies: number;
  /** Semena, jejichž všechny vazby jsou steward → v peněžním pruhu nic nemají. */
  stewardOnlySeeds: number;
}

/**
 * Entity, které výřez SKUTEČNĚ nakreslil, přeložené do vstupu knihy datovaných
 * faktů. Vzniká tady, protože jen tenhle kód ví, co se do obrázku vešlo — a
 * kniha nesmí obsahovat řádek, jehož zaměřovač míří na uzel mimo plátno.
 */
export interface SliceSources {
  /** Firmy, jejichž smlouvy SMÍ být připsané poslanci (ne steward).
   *  `subjectRef` je uzel firmy — podmět věty o podepsané smlouvě. */
  contractCompanies: { kgId: string; company: string; refs: string[]; subjectRef: string; pending: boolean }[];
  ties: FactTie[];
  bills: FactBill[];
}

export interface StateSlice {
  graph: StateGraph;
  rule: StateSliceRule;
  sources: SliceSources;
}

/**
 * Kolik poslanců výřez zaseje. TŘI: současný renderer překresluje při najetí
 * celou SVG scénu a je vyladěný na ~17 uzlů (viz velin-hover-cost-freshness);
 * tři semena dávají ~5 osob, ~4 firmy, ~2 peníze, 1 stranu, 3 tisky a 3 zákony,
 * tedy přesně ten rozpočet. Zvýšit až se sníží cena hoveru, ne dřív.
 */
export const SLICE_SEEDS = 3;

// ── Identifikátory uzlů (reálné, ne indexy do vzorku) ───────────────────────

export const slicePersonId = (pspId: number) => `p:${pspId}`;
export const sliceCompanyId = (ico: string) => `c:${ico}`;
export const sliceMoneyId = (ico: string) => `m:${ico}`;
export const slicePartyId = (label: string) => `y:${label}`;
export const sliceBillId = (cislo: number) => `b:${cislo}`;
export const sliceLawId = (urn: string) => `l:${urn}`;

const byIco = (a: SliceTie, b: SliceTie) => a.ico.localeCompare(b.ico);
/** „586/1992" → 586 · 1992; řadí podle čísla předpisu, ne podle řetězce. */
const lawKey = (ref: string) => {
  const m = ref.match(/(\d+)\s*\/\s*(\d{4})/);
  return m ? Number(m[2]) * 100000 + Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/** Vazba, jejíž peníze smí výřez připsat poslanci (pravidlo /penize). */
const isAttributable = (t: SliceTie) => t.tieClass !== "steward";

export function buildStateSlice(input: SliceInput): StateSlice | null {
  const { mps, bills, chamberTotal } = input;
  const clubColor = input.clubColorByPspId ?? {};
  const partyNodeId = input.partyNodeIdByLabel ?? {};

  // Tisky, které skutečně novelizují zákon — jen ty umí spojit oba pruhy.
  const amendingBySponsor = new Map<number, SliceBill[]>();
  for (const b of bills) {
    if (b.cislo === null || b.amendedLaws.length === 0) continue;
    for (const s of b.sponsors) {
      amendingBySponsor.set(s.pspId, [...(amendingBySponsor.get(s.pspId) ?? []), b]);
    }
  }
  for (const list of amendingBySponsor.values()) {
    list.sort((a, b) => (a.cislo ?? 0) - (b.cislo ?? 0));
  }

  const tiedMps = mps.filter((m) => m.ties.length > 0);
  const dual = tiedMps
    .filter((m) => (amendingBySponsor.get(m.pspId) ?? []).length > 0)
    .sort((a, b) => a.pspId - b.pspId);
  if (dual.length === 0) return null;

  const primary = dual.slice(0, SLICE_SEEDS);

  // Dárcovské firmy — v korpusu jediné firmy s darem straně. Bez nich by výřez
  // neunesl uzel strany. Každou bere první napojený poslanec podle mandátu.
  const donorRows: { mp: SliceMp; tie: SliceTie }[] = [];
  const donorCompanySeen = new Set<string>();
  for (const m of [...tiedMps].sort((a, b) => a.pspId - b.pspId)) {
    for (const t of [...m.ties].sort(byIco)) {
      if ((t.donatedToPartyCzk ?? 0) <= 0 || !t.donationRecipientParty) continue;
      if (donorCompanySeen.has(t.companyId)) continue;
      donorCompanySeen.add(t.companyId);
      donorRows.push({ mp: m, tie: t });
    }
  }

  // Osy: semena podle mandátu, pak držitelé dárcovských firem (kteří ještě nejsou uvnitř).
  const persons: SliceMp[] = [...primary];
  for (const d of donorRows) {
    if (!persons.some((p) => p.pspId === d.mp.pspId)) persons.push(d.mp);
  }

  // Řádky peněžního pruhu: za semeno první NE-steward firma podle IČO; za
  // dárcovské semeno ta konkrétní dárcovská firma (i když je steward — kreslí
  // se kvůli daru, ne kvůli penězům, a peněžní uzel proto nedostane).
  const rows: { pspId: number; tie: SliceTie; donor: boolean }[] = [];
  const rowCompanySeen = new Set<string>();
  const pushRow = (pspId: number, tie: SliceTie, donor: boolean) => {
    if (rowCompanySeen.has(tie.companyId)) return;
    rowCompanySeen.add(tie.companyId);
    rows.push({ pspId, tie, donor });
  };
  for (const p of primary) {
    const own = [...p.ties].sort(byIco).find(isAttributable);
    if (own) pushRow(p.pspId, own, false);
  }
  for (const d of donorRows) pushRow(d.mp.pspId, d.tie, true);

  // Řádky legislativního pruhu — jen za primární semena, ta byla vybrána právě
  // pro ně. Dva poslanci mohou předkládat týž tisk: uzel je jeden, hrany dvě.
  const billRows: { cislo: number; bill: SliceBill; sponsors: number[] }[] = [];
  for (const p of primary) {
    const b = (amendingBySponsor.get(p.pspId) ?? [])[0];
    if (!b || b.cislo === null) continue;
    const existing = billRows.find((r) => r.cislo === b.cislo);
    if (existing) existing.sponsors.push(p.pspId);
    else billRows.push({ cislo: b.cislo, bill: b, sponsors: [p.pspId] });
  }

  const nodes: StateNode[] = [];
  const edges: StateEdge[] = [];

  persons.forEach((p, i) => {
    nodes.push({
      id: slicePersonId(p.pspId),
      kind: "person",
      mpId: String(p.pspId),
      band: "spine",
      href: `/poslanec/${p.pspId}`,
      label: p.name,
      partyColor: clubColor[p.pspId],
      x: 13,
      // Spodní mez 91: pod uzlem visí podtitul a stranický čip.
      y: spread(i, persons.length, 8, 91),
    });
  });

  rows.forEach((row, i) => {
    const { tie } = row;
    const y = spread(i, rows.length, 8, 44);
    const verified = tie.reviewState === "verified";
    nodes.push({
      id: sliceCompanyId(tie.ico),
      kind: "company",
      band: "money",
      href: `/penize/${row.pspId}`,
      label: tie.company,
      sub: `IČO ${tie.ico}`,
      pending: !verified,
      x: 42,
      y,
    });
    edges.push({
      from: slicePersonId(row.pspId),
      to: sliceCompanyId(tie.ico),
      rel: "tie",
      label: tie.role || undefined,
      verified,
    });

    // Peníze jen u přisouditelné vazby a jen když nějaké jsou.
    if (isAttributable(tie) && tie.contractCzk > 0) {
      nodes.push({
        id: sliceMoneyId(tie.ico),
        kind: "money",
        band: "money",
        href: `/penize/${row.pspId}`,
        label: tie.company,
        czk: tie.contractCzk,
        count: tie.contractCount,
        pending: !verified,
        x: 74,
        y,
      });
      edges.push({
        from: sliceCompanyId(tie.ico),
        to: sliceMoneyId(tie.ico),
        rel: "contract",
        verified,
      });
    }
  });

  // Strany, kterým dárcovské firmy poslaly peníze.
  const partyLabels = [...new Set(donorRows.map((d) => d.tie.donationRecipientParty!))].sort((a, b) =>
    a.localeCompare(b, "cs"),
  );
  partyLabels.forEach((label, i) => {
    nodes.push({
      id: slicePartyId(label),
      kind: "party",
      partyCode: partyNodeId[label] ?? label,
      band: "money",
      label,
      x: 74,
      y: partyLabels.length <= 1 ? 54 : spread(i, partyLabels.length, 50, 58),
    });
  });
  for (const d of donorRows) {
    const label = d.tie.donationRecipientParty!;
    edges.push({
      from: sliceCompanyId(d.tie.ico),
      to: slicePartyId(label),
      rel: "donor",
      czk: d.tie.donatedToPartyCzk ?? undefined,
      verified: d.tie.reviewState === "verified",
    });
  }

  billRows.forEach((row, i) => {
    const y = spread(i, billRows.length, 62, 91);
    nodes.push({
      id: sliceBillId(row.cislo),
      kind: "bill",
      band: "law",
      href: `/zakony/${row.cislo}`,
      label: `sn. tisk ${row.cislo}`,
      sub: row.bill.title,
      x: 42,
      y,
    });
    for (const pspId of row.sponsors) {
      edges.push({ from: slicePersonId(pspId), to: sliceBillId(row.cislo), rel: "sponsors", verified: true });
    }
    const law = [...row.bill.amendedLaws].sort((a, b) => lawKey(a.ref) - lawKey(b.ref))[0];
    if (!law) return;
    if (!nodes.some((n) => n.id === sliceLawId(law.urn))) {
      nodes.push({
        id: sliceLawId(law.urn),
        kind: "law",
        lawChangeId: law.urn,
        band: "law",
        href: "/zakony",
        label: `č. ${law.ref} Sb.`,
        sub: law.title ?? undefined,
        x: 74,
        y,
      });
    }
    edges.push({ from: sliceBillId(row.cislo), to: sliceLawId(law.urn), rel: "amends", verified: true });
  });

  const drawnTies = rows.length;
  const pendingTies = rows.filter((r) => r.tie.reviewState !== "verified").length;
  const stewardOnlySeeds = primary.filter((p) => !p.ties.some(isAttributable)).length;

  // ── Podklad pro knihu datovaných faktů ────────────────────────────────────
  // Bere se JEN z toho, co výřez opravdu nakreslil, takže žádný řádek knihy
  // nemůže mít zaměřovač do prázdna. Smlouvy jen u přisouditelných vazeb —
  // steward peníze nejsou peníze poslance ani v knize, nejen na obrázku.
  const nodeIds = new Set(nodes.map((n) => n.id));
  const drawn = (ids: string[]) => ids.filter((id) => nodeIds.has(id));
  const mpNameByPspId = new Map(persons.map((p) => [p.pspId, p.name]));

  const sources: SliceSources = {
    contractCompanies: rows
      .filter((r) => isAttributable(r.tie))
      .map((r) => ({
        kgId: r.tie.companyId,
        company: r.tie.company,
        refs: drawn([sliceCompanyId(r.tie.ico), sliceMoneyId(r.tie.ico)]),
        // Smlouva je fakt o FIRMĚ, ne o penězích ani o poslanci — zaměřovač
        // proto míří na uzel firmy, ať je v `refs` na kterémkoli místě.
        subjectRef: sliceCompanyId(r.tie.ico),
        pending: r.tie.reviewState !== "verified",
      }))
      .filter((c) => c.refs.length > 0),
    ties: rows.map((r) => ({
      company: r.tie.company,
      mpName: mpNameByPspId.get(r.pspId) ?? String(r.pspId),
      role: r.tie.role,
      roleValidFrom: r.tie.roleValidFrom ?? null,
      roleValidTo: r.tie.roleValidTo ?? null,
      refs: drawn([slicePersonId(r.pspId), sliceCompanyId(r.tie.ico)]),
      // Zápis/výmaz role je fakt o POSLANCI („X zapsán do rejstříku").
      subjectRef: slicePersonId(r.pspId),
      pending: r.tie.reviewState !== "verified",
    })),
    bills: billRows.map((r) => ({
      cislo: r.cislo,
      refs: drawn([sliceBillId(r.cislo)]),
      // Přikázání výboru i vyhlášení ve Sbírce je fakt o TISKU.
      subjectRef: sliceBillId(r.cislo),
      committees: (r.bill.committees ?? []).map((c) => ({
        organLabel: c.organLabel,
        role: c.role,
        assignedOn: c.assignedOn,
      })),
      fateSb: r.bill.fateSb ?? null,
      fatePublishedOn: r.bill.fatePublishedOn ?? null,
    })),
  };

  return {
    graph: { nodes, edges },
    sources,
    rule: {
      seeds: primary.length,
      dualBandTotal: dual.length,
      chamberTotal,
      donorCompanies: donorRows.length,
      tiesDrawn: drawnTies,
      pendingTies,
      stewardOnlySeeds,
    },
  };
}

/** Zaokrouhlení, které drží SSR == CSR — reexport, ať ho testy vidí odsud. */
export { r2 };
