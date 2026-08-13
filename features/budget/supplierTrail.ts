// BudgetMirror — peněžní stopa obce (moonshot 4D „Municipal Money Trail").
//
// Obec je v Registru smluv smluvní stranou (nebo zveřejňujícím subjektem) pod
// týmž IČO, kterým ji vede MONITOR i rejstřík plochy /rozpocty. Peněžní graf
// (batch-012 re-ingest smlouvy.gov.cz) nese na uzlech smluv pole `publisher`,
// `parties` a `partyDirections` — tenhle modul z nich odvozuje, se KTERÝMI
// firmami z grafu má obec smlouvy a kde záznam dokládá i směr platby.
//
// ZVEŘEJNĚNÉ PRAVIDLO SPOJENÍ (plocha ho tiskne doslova):
//   1. Smlouva se obci připíše, jen když je obec sama smluvní stranou nebo
//      zveřejňujícím subjektem — IČO = IČO obce v rejstříku. IČO mimo rejstřík
//      obcí (příspěvkovka, technické služby, stát) se NIKDY nedomýšlí na
//      zřizovatele (pravidlo drop-don't-guess, README §①).
//   2. Protistrana = firma, ze které do smlouvy vede hrana `supplies`
//      peněžního grafu. Graf nese JEN smlouvy firem, které v něm už jsou —
//      tohle není úplný registr obce; chybějící smlouva = „mimo záznam", ne 0.
//   3. „Doložená platba obce" je jen smlouva, kde registr označuje firmu jako
//      příjemce A smlouva má právě dvě strany: obec a firmu. Cokoli jiného
//      (chybějící příznaky — zhruba polovina registru, vícestranné smlouvy)
//      zůstává „směr platby záznam neuvádí" — nikdy se nedomýšlí (týž postoj
//      jako directionFor v lib/ingest/sources/smlouvy-dump.ts, batch 011).
//   4. Částka = váha hrany `supplies` (týž zdroj jako /penize — obě plochy
//      musí hlásit stejné peníze za tutéž smlouvu). Smlouva s více obecními
//      stranami se počítá každé z nich celá; napříč obcemi se nesčítá.
//
// Čisté funkce + přísné kodeky (fail-loud, vzor mirrorData) — testy
// kolokované v supplierTrail.test.ts. Generátor: tools/generate-municipal-suppliers.ts.

import { isPlausibleIsoDate, PLAUSIBLE_FROM } from "@/lib/analysis/plausible-date";
import { median } from "./peerGroups";
import {
  SUPPLIERS_PACKED,
  SUPPLIERS_PASS,
  SUPPLIERS_RETRIEVED_ON,
} from "./data/municipalSuppliers.generated";

/* ── Typy ─────────────────────────────────────────────────────────────────── */

/** Jedna protistrana jedné obce — agregát přes všechny společné smlouvy
 *  v záznamu, rozdělený podle toho, co registr o směru platby DOKLÁDÁ. */
export interface SupplierRow {
  townIc: string;
  supplierIco: string;
  supplierName: string;
  /** id uzlu firmy v peněžním grafu (protistrana v grafu vždy existuje —
   *  řádek vznikl z její hrany `supplies`). */
  companyId: string;
  /** Smlouvy, kde registr dokládá platbu obce firmě (pravidlo 3). */
  paidCount: number;
  paidCzk: number;
  /** Smlouvy, u nichž záznam směr platby neuvádí. */
  otherCount: number;
  otherCzk: number;
  /** Rok první/poslední podepsané smlouvy; null = datum podpisu bez záznamu
   *  NEBO potlačený nemožný rok (rozlišuje `yearsWithheld`). */
  firstYear: number | null;
  lastYear: number | null;
  /** Řádek nesl rok podpisu, který se nemohl stát (viz `isPlausibleSignatureYear`),
   *  takže se rozsah NEUVÁDÍ. Přítomné jen když k tomu došlo — absence znamená
   *  „nic se nezamlčelo", ne „nekontrolováno" (kodek kontroluje každý řádek).
   *  Řádek ani jeho peníze se nezahazují: chybný je údaj o datu, ne smlouva. */
  yearsWithheld?: true;
}

export const rowTotalCzk = (r: SupplierRow): number => r.paidCzk + r.otherCzk;
export const rowTotalCount = (r: SupplierRow): number => r.paidCount + r.otherCount;

export interface TownSupplierSummary {
  /** Řádky obce, celkové CZK sestupně (pořadí z generátoru, deterministické). */
  rows: SupplierRow[];
  /** Σ hodnot smluv v záznamu — NIKOLI uskutečněné platby (pravidlo 4: částka
   *  je váha hrany `supplies`, tedy hodnota smlouvy podle registru). */
  totalCzk: number;
  paidCzk: number;
  contractCount: number;
  paidContractCount: number;
  supplierCount: number;
  /** Rozsah let podpisu smluv v záznamu — bez něj se Σ za roky 1995–2026 čte
   *  jako roční tok. null = žádná smlouva obce nenese použitelné datum podpisu. */
  firstYear: number | null;
  lastYear: number | null;
  /** Kolika řádkům obce se rozsah POTLAČIL, protože nesly nemožný rok podpisu.
   *  Plocha to říká vedle rozsahu — potlačené ≠ chybějící, a Σ peněz zůstává. */
  yearsWithheldRows: number;
}

/* ── Odvození spojení (čisté — sdílí ho generátor i testy) ────────────────── */

export interface ContractNodeLike {
  id: string;
  props: Record<string, unknown> | null;
}
export interface SuppliesEdgeLike {
  src: string;
  dst: string;
  weight: unknown;
}

/** Částka hrany: číslo, číselný řetězec, jinak 0 (týž postoj jako
 *  moneyLoader.num — absence váhy není záporná informace, jen nevykázaná). */
export function asCzk(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** IČO z registru smluv může přijít bez vodících nul — normalizuje na
 *  8 číslic; cokoli jiného než 1–8 číslic je nepoužitelné (null, ne odhad). */
export function normalizeIco(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const digits = String(raw).trim();
  if (!/^\d{1,8}$/.test(digits)) return null;
  return digits.padStart(8, "0");
}

/** IČO firmy z id uzlu `company:ico:<ičo>`; jiný tvar id → null. */
export function icoFromCompanyId(id: string): string | null {
  const m = /^company:ico:(\d{8})$/.exec(id);
  return m ? m[1] : null;
}

/**
 * NEMOŽNÉ DATUM MÁ JEDNU HRANICI — i tady (2026-08-13).
 *
 * `yearOf` si do 2026-08-13 držel VLASTNÍ mez `y > 1900 && y < 2100`, přestože
 * `lib/analysis/plausible-date.ts` existuje s odůvodněním „aby hranice byla
 * v celé aplikaci jedna a stejná". Ta soukromá mez pouštěla budoucí roky dál a
 * plocha je publikovala jako rozsah smluvní historie obce: v ZAPSANÉ dávce
 * (`municipalSuppliers.generated.ts`) je řádek `00279676 × Československá
 * obchodní banka` s rozsahem **2009–2043**. Obec s historií zakázek do roku
 * 2043 vysázená vedle Σ hodnoty smluv je přesně ten druh čísla, kvůli kterému
 * modul možných dat vznikl.
 *
 * Horní mez je den, ke kterému se registr ČETL (`SUPPLIERS_RETRIEVED_ON`,
 * z téže generované dávky, takže obě konstanty cestují spolu) — smlouva
 * podepsaná po dni čtení není datum, ale vada dat. Datum se NIKDY neopravuje:
 * potlačí se a přizná (`SupplierRow.yearsWithheld`).
 */
const PLAUSIBLE_YEAR_FROM = Number(PLAUSIBLE_FROM.slice(0, 4));

/** Rok podpisu, nebo `null` — pro cokoli, co není datum v možném rozsahu.
 *  `todayIso` se předává (ne čte z hodin) přesně jako v plausible-date.ts. */
const yearOf = (signedOn: unknown, todayIso: string): number | null => {
  if (typeof signedOn !== "string") return null;
  return isPlausibleIsoDate(signedOn, todayIso) ? Number(signedOn.slice(0, 4)) : null;
};

/** Je rok v mezích, které smí být vysázeny jako rok podpisu? Meze jsou tytéž
 *  jako u `yearOf`, jen na ročníkové zrnitosti: kodek nese rok, ne datum. */
export function isPlausibleSignatureYear(year: number, retrievedOn: string): boolean {
  const upper = Number(retrievedOn.slice(0, 4));
  return (
    Number.isInteger(year) &&
    Number.isInteger(upper) &&
    year >= PLAUSIBLE_YEAR_FROM &&
    year <= upper
  );
}

export interface DeriveStats {
  contractsScanned: number;
  /** Smlouvy s aspoň jedním párem obec×protistrana. */
  municipalContracts: number;
  /** Z nich s doloženým směrem platby obec → firma (pravidlo 3). */
  paidContracts: number;
  /** Smlouvy připsané více obcím najednou (každé celé — pravidlo 4). */
  multiTownContracts: number;
}

/**
 * Spojení IČO: uzly smluv × hrany `supplies` × rejstřík obcí → řádky
 * protistran po obcích. Deterministické (řazení townIc ↑, celkové CZK ↓,
 * IČO ↑); smlouva obce se sebou samou se vynechává (obec je v grafu i jako
 * firma-vlastník, např. Praha).
 */
export function deriveMunicipalSupplierRows(args: {
  contracts: readonly ContractNodeLike[];
  supplies: readonly SuppliesEdgeLike[];
  companyLabelByIco: ReadonlyMap<string, string>;
  municipalIcs: ReadonlySet<string>;
  /** Den, ke kterému se registr čte — horní mez možného data podpisu. Generátor
   *  by měl předat SVŮJ den čtení; výchozí je den zapsané dávky, což je jediná
   *  hodnota, kterou tenhle čistý modul poctivě zná (hodiny nečte — viz
   *  lib/analysis/plausible-date.ts). */
  retrievedOn?: string;
}): { rows: SupplierRow[]; stats: DeriveStats } {
  const { contracts, supplies, companyLabelByIco, municipalIcs } = args;
  const retrievedOn = args.retrievedOn ?? SUPPLIERS_RETRIEVED_ON;

  const suppliersByContract = new Map<string, { ico: string; czk: number }[]>();
  for (const e of supplies) {
    const ico = icoFromCompanyId(e.src);
    if (ico === null) continue;
    const list = suppliersByContract.get(e.dst) ?? [];
    list.push({ ico, czk: asCzk(e.weight) });
    suppliersByContract.set(e.dst, list);
  }

  const stats: DeriveStats = {
    contractsScanned: contracts.length,
    municipalContracts: 0,
    paidContracts: 0,
    multiTownContracts: 0,
  };

  interface Acc {
    paidCount: number;
    paidCzk: number;
    otherCount: number;
    otherCzk: number;
    firstYear: number | null;
    lastYear: number | null;
  }
  // townIc → supplierIco → agregát
  const byTown = new Map<string, Map<string, Acc>>();

  for (const c of contracts) {
    const props = c.props ?? {};
    const sups = suppliersByContract.get(c.id);
    if (!sups || sups.length === 0) continue;

    const publisherIco = normalizeIco((props.publisher as { ico?: unknown } | null | undefined)?.ico);
    const partiesRaw: unknown[] = Array.isArray(props.parties) ? props.parties : [];
    const partyIcos = partiesRaw.map((p) =>
      p !== null && typeof p === "object" ? normalizeIco((p as { ico?: unknown }).ico) : null,
    );

    const townIcs = new Set<string>();
    if (publisherIco !== null && municipalIcs.has(publisherIco)) townIcs.add(publisherIco);
    for (const ico of partyIcos) if (ico !== null && municipalIcs.has(ico)) townIcs.add(ico);
    if (townIcs.size === 0) continue;

    // Právě dvě strany, obě s IČO — jediný tvar, kde „firma je příjemce"
    // doloženě znamená „obec platí" (pravidlo 3).
    const sideCount = (publisherIco !== null || props.publisher != null ? 1 : 0) + partiesRaw.length;
    const knownSides = new Set<string>();
    if (publisherIco !== null) knownSides.add(publisherIco);
    for (const ico of partyIcos) if (ico !== null) knownSides.add(ico);

    const directions = (props.partyDirections ?? {}) as Record<string, unknown>;
    const year = yearOf(props.signedOn, retrievedOn);

    let contractPaired = false;
    let contractPaid = false;
    for (const townIc of townIcs) {
      for (const s of sups) {
        if (s.ico === townIc) continue; // obec sama se sebou
        contractPaired = true;
        const paid =
          directions[s.ico] === "recipient" &&
          sideCount === 2 &&
          knownSides.has(townIc) &&
          knownSides.has(s.ico);
        if (paid) contractPaid = true;

        let townMap = byTown.get(townIc);
        if (!townMap) byTown.set(townIc, (townMap = new Map()));
        const acc =
          townMap.get(s.ico) ??
          ({ paidCount: 0, paidCzk: 0, otherCount: 0, otherCzk: 0, firstYear: null, lastYear: null } as Acc);
        if (paid) {
          acc.paidCount += 1;
          acc.paidCzk += s.czk;
        } else {
          acc.otherCount += 1;
          acc.otherCzk += s.czk;
        }
        if (year !== null) {
          acc.firstYear = acc.firstYear === null ? year : Math.min(acc.firstYear, year);
          acc.lastYear = acc.lastYear === null ? year : Math.max(acc.lastYear, year);
        }
        townMap.set(s.ico, acc);
      }
    }
    if (contractPaired) {
      stats.municipalContracts++;
      if (contractPaid) stats.paidContracts++;
      if (townIcs.size > 1) stats.multiTownContracts++;
    }
  }

  const rows: SupplierRow[] = [];
  for (const townIc of [...byTown.keys()].sort()) {
    const townRows: SupplierRow[] = [...byTown.get(townIc)!.entries()].map(([ico, a]) => ({
      townIc,
      supplierIco: ico,
      supplierName: companyLabelByIco.get(ico) ?? ico,
      companyId: `company:ico:${ico}`,
      paidCount: a.paidCount,
      paidCzk: a.paidCzk,
      otherCount: a.otherCount,
      otherCzk: a.otherCzk,
      firstYear: a.firstYear,
      lastYear: a.lastYear,
    }));
    townRows.sort(
      (a, b) => rowTotalCzk(b) - rowTotalCzk(a) || a.supplierIco.localeCompare(b.supplierIco),
    );
    rows.push(...townRows);
  }
  return { rows, stats };
}

/* ── Kodek (vzor mirrorData: kompaktní řádky, fail-loud parser) ───────────── */

/** Formát řádku: obec|IČO|název|počet₊|Kč₊|počet₀|Kč₀|prvníRok|posledníRok
 *  (₊ = doložené platby, ₀ = směr neuveden; roky prázdné = podpis bez data;
 *  Kč celé, zaokrouhlené). */
export function packSupplierRows(rows: readonly SupplierRow[]): string {
  return rows
    .map((r) => {
      if (!/^\d{8}$/.test(r.townIc) || !/^\d{8}$/.test(r.supplierIco)) {
        throw new Error(`packSupplierRows: vadné IČO ${r.townIc}/${r.supplierIco}`);
      }
      if (/[|\n]/.test(r.supplierName)) {
        throw new Error(`packSupplierRows: nepovolený znak v názvu ${r.supplierName}`);
      }
      return [
        r.townIc,
        r.supplierIco,
        r.supplierName,
        r.paidCount,
        Math.round(r.paidCzk),
        r.otherCount,
        Math.round(r.otherCzk),
        r.firstYear ?? "",
        r.lastYear ?? "",
      ].join("|");
    })
    .join("\n");
}

export function parseSupplierRows(packed: string): SupplierRow[] {
  const out: SupplierRow[] = [];
  for (const line of packed.split("\n")) {
    if (line === "") continue;
    const parts = line.split("|");
    if (parts.length !== 9) throw new Error(`parseSupplierRows: vadný řádek "${line.slice(0, 40)}"`);
    const [townIc, supplierIco, supplierName, paidCountRaw, paidCzkRaw, otherCountRaw, otherCzkRaw, firstRaw, lastRaw] =
      parts;
    const paidCount = Number(paidCountRaw);
    const paidCzk = Number(paidCzkRaw);
    const otherCount = Number(otherCountRaw);
    const otherCzk = Number(otherCzkRaw);
    const firstYear = firstRaw === "" ? null : Number(firstRaw);
    const lastYear = lastRaw === "" ? null : Number(lastRaw);
    if (
      !/^\d{8}$/.test(townIc) ||
      !/^\d{8}$/.test(supplierIco) ||
      !Number.isInteger(paidCount) ||
      paidCount < 0 ||
      !Number.isInteger(otherCount) ||
      otherCount < 0 ||
      paidCount + otherCount === 0 ||
      !Number.isFinite(paidCzk) ||
      !Number.isFinite(otherCzk) ||
      (firstYear !== null && !Number.isInteger(firstYear)) ||
      (lastYear !== null && !Number.isInteger(lastYear))
    ) {
      throw new Error(`parseSupplierRows: vadný řádek "${line.slice(0, 40)}"`);
    }
    /* NEMOŽNÝ ROK SE POTLAČÍ, ŘÁDEK ZŮSTANE — a NEshodí modul.
     *
     * Kodek je jinak fail-loud (vzor mirrorData) a to se nemění: vadná
     * STRUKTURA je chyba kodeku a hází dál. Nemožný ROK je ale vada DAT, a na
     * ty má produkt jiné pravidlo (lib/analysis/plausible-date.ts): potlačit,
     * řádek i peníze ponechat, mezeru přiznat čtenáři. `throw` by tady navíc
     * kvůli jedinému řádku (00279676 × ČSOB, „2009–2043") sebral celou sekci
     * dodavatelů na /rozpocty — tedy trest za vadu dat by nesl čtenář.
     *
     * Potlačují se OBĚ meze najednou: dávka nese jen minimum a maximum, takže
     * po vyřazení nemožné meze se pravdivý rozsah z ničeho nedopočítá. Nechat
     * druhou by byl odhad, a ten je zakázaný. */
    const yearsBad =
      (firstYear !== null && !isPlausibleSignatureYear(firstYear, SUPPLIERS_RETRIEVED_ON)) ||
      (lastYear !== null && !isPlausibleSignatureYear(lastYear, SUPPLIERS_RETRIEVED_ON));
    out.push({
      townIc,
      supplierIco,
      supplierName,
      companyId: `company:ico:${supplierIco}`,
      paidCount,
      paidCzk,
      otherCount,
      otherCzk,
      firstYear: yearsBad ? null : firstYear,
      lastYear: yearsBad ? null : lastYear,
      ...(yearsBad ? { yearsWithheld: true as const } : {}),
    });
  }
  return out;
}

/* ── Tabulka + souhrny (nad generovanou dávkou) ───────────────────────────── */

let tableCache: Map<string, SupplierRow[]> | null = null;

/** townIc → řádky protistran (celkové CZK sestupně). Parsuje se jednou na modul. */
export function getSupplierTable(): Map<string, SupplierRow[]> {
  if (tableCache === null) {
    tableCache = new Map();
    for (const r of parseSupplierRows(SUPPLIERS_PACKED)) {
      const list = tableCache.get(r.townIc) ?? [];
      list.push(r);
      tableCache.set(r.townIc, list);
    }
  }
  return tableCache;
}

/** Souhrn obce; null = obec se v záznamu smluv grafu nevyskytuje — plocha to
 *  PŘIZNÁ (mimo záznam ≠ žádné smlouvy), nikdy nekreslí prázdný graf. */
export function townSupplierSummary(
  townIc: string,
  table: ReadonlyMap<string, SupplierRow[]>,
): TownSupplierSummary | null {
  const rows = table.get(townIc);
  if (!rows || rows.length === 0) return null;
  let totalCzk = 0;
  let paidCzk = 0;
  let contractCount = 0;
  let paidContractCount = 0;
  let firstYear: number | null = null;
  let lastYear: number | null = null;
  let yearsWithheldRows = 0;
  for (const r of rows) {
    totalCzk += rowTotalCzk(r);
    paidCzk += r.paidCzk;
    contractCount += rowTotalCount(r);
    paidContractCount += r.paidCount;
    if (r.yearsWithheld) yearsWithheldRows++;
    // Řádek bez data podpisu rozsah NEROZŠIŘUJE (a nenuluje ho) — chybějící
    // datum není rok 0; týž postoj jako `firstYear === null` na řádku samém.
    if (r.firstYear !== null) firstYear = firstYear === null ? r.firstYear : Math.min(firstYear, r.firstYear);
    if (r.lastYear !== null) lastYear = lastYear === null ? r.lastYear : Math.max(lastYear, r.lastYear);
  }
  return {
    rows,
    totalCzk,
    paidCzk,
    contractCount,
    paidContractCount,
    supplierCount: rows.length,
    firstYear,
    lastYear,
    yearsWithheldRows,
  };
}

/* ── Srovnání s vrstevníky ────────────────────────────────────────────────── */

export interface SupplierPeerStats {
  /** Medián celkových Kč, které s TOUŽ firmou mají vrstevnické obce v záznamu. */
  medianCzk: number | null;
  /** Z kolika vrstevnických obcí se medián počítá. */
  peerTownCount: number;
}

/** Srovnání jedné protistrany: co s ní mají vrstevníci obce. Vrstevník bez
 *  řádku s touto firmou do mediánu nevstupuje (mimo záznam ≠ 0). */
export function supplierPeerStats(
  supplierIco: string,
  peerIcs: readonly string[],
  table: ReadonlyMap<string, SupplierRow[]>,
): SupplierPeerStats {
  const vals: number[] = [];
  for (const ic of peerIcs) {
    const row = table.get(ic)?.find((r) => r.supplierIco === supplierIco);
    if (row) vals.push(rowTotalCzk(row));
  }
  return { medianCzk: median(vals), peerTownCount: vals.length };
}

export interface PeerTotals {
  /** Medián celkového objemu smluv v záznamu u vrstevníků, kteří v něm jsou. */
  medianCzk: number | null;
  sampleSize: number;
}

/** Celkové objemy vrstevníků — jen obce, které v záznamu vůbec jsou;
 *  obec mimo záznam medián nesráží k nule. */
export function peerSupplierTotals(
  peerIcs: readonly string[],
  table: ReadonlyMap<string, SupplierRow[]>,
): PeerTotals {
  const vals: number[] = [];
  for (const ic of peerIcs) {
    const s = townSupplierSummary(ic, table);
    if (s) vals.push(s.totalCzk);
  }
  return { medianCzk: median(vals), sampleSize: vals.length };
}

/* ── Pokrytí (přiznává se na ploše, nikdy se nemaskuje) ───────────────────── */

export interface SupplierCoverage {
  townsInRecord: number;
  supplierPairs: number;
  retrievedOn: string;
  pass: number;
}

export function supplierCoverage(table: ReadonlyMap<string, SupplierRow[]>): SupplierCoverage {
  let pairs = 0;
  for (const rows of table.values()) pairs += rows.length;
  return {
    townsInRecord: table.size,
    supplierPairs: pairs,
    retrievedOn: SUPPLIERS_RETRIEVED_ON,
    pass: SUPPLIERS_PASS,
  };
}
