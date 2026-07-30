// Paměť zákona — PURE derivace dosjaru předpisu (moonshot 5A).
//
// LawWatch se tu obrací z pohledu tisku na pohled ZÁKONA: pro každý
// novelizovaný předpis kritické vydání — kdo ho kdy měnil (stopa tisků
// s předkladateli a datem vyhlášení) a tam, kde v archivu leží reálný
// e-Sbírka §-diff, i §-stopa: doslovné před/po každého fragmentu mezi
// dvěma platnými zněními.
//
// POCTIVOST GRANULARITY (změřeno na datech, ne slibováno): §-diff artefakty
// dnes pokrývají jen část předpisů a jen bodově vybrané § — derivace proto
// VŽDY nese pokrytí (StatuteCoverage) a plocha ho přiznává. U jednotlivého
// §-okna se autorství NEURČUJE: vyhlášené pravidlo říká pouze „kandidáti
// okna" — tisky z této stopy vyhlášené ve Sbírce v intervalu
// (windowFrom, windowTo]. Kandidát ≠ doložený autor změny; okno mezi dvěma
// konsolidovanými zněními může nést zásahy více novel najednou.
//
// Čistý modul: z getLawData se importují JEN typy (server-only zůstává na
// loaderu), takže tytéž funkce běží na serveru, v testech i kdekoli jinde.
// Determinismus: stejné vstupy v libovolném pořadí → identický výstup;
// každé řadicí pravidlo je popsané u své funkce a vyhlášené na stránce.

import type { BillOrigin, LawBillView, LawData, ParagraphDiff } from "./getLawData";
import { NON_PARAGRAPH_KEY, paragraphAnchor, paragraphKeyOf, paragraphLabel, statuteSlug } from "./statuteRef";

/** Odkud stopa ví, že tisk tento předpis mění: citace v názvu (amends hrana),
 *  census plného textu (průchod 20), nebo obojí. Dvě poctivě různé provenience
 *  (C6/C8) — nikdy se tiše neslévají. */
export type TrailProvenance = "title" | "census" | "both";

export interface StatuteTrailEntry {
  tiskId: number;
  cislo: number | null;
  title: string;
  summary: string | null;
  origin: BillOrigin;
  stav: string | null;
  fateSb: string | null;
  fatePublishedOn: string | null;
  sponsors: LawBillView["sponsors"];
  flaggedConflict: boolean;
  provenance: TrailProvenance;
}

/** Tisk-kandidát §-okna dle vyhlášeného pravidla (viz hlavičku modulu). */
export interface ParagraphChangeCandidate {
  tiskId: number;
  cislo: number | null;
  title: string;
  fateSb: string | null;
  fatePublishedOn: string; // kandidátem je jen vyhlášený tisk — datum vždy existuje
}

/** Jedna doložená změna fragmentu mezi dvěma platnými zněními (hunk + okno). */
export interface ParagraphChange {
  fragment: string;
  op: "modified" | "added" | "removed";
  before: string | null;
  after: string | null;
  windowFrom: string; // datum staršího znění (from.date)
  windowTo: string; // datum novějšího znění (to.date)
  eliFrom: string;
  eliTo: string;
  source: string;
  candidates: ParagraphChangeCandidate[];
}

export interface ParagraphTrail {
  key: string; // "35ba"
  anchor: string; // "p-35ba" — veřejná kotva #p-<§>
  label: string; // "§ 35ba"
  changes: ParagraphChange[];
  /** Počet různých verzních oken, ze kterých změny tohoto § pocházejí —
   *  víc oken = § měněný opakovaně (vícenásobná novelizace). */
  windows: number;
}

export interface StatuteCoverage {
  trailBills: number;
  enactedBills: number;
  censusOnlyBills: number; // tisky doložené jen censem (bez amends hrany)
  paragraphs: number; // § skupin se §-stopou
  changes: number; // doložených fragmentových změn celkem
  changesWithCandidates: number; // změn s ≥1 tiskem-kandidátem v okně
  windows: number; // různých verzních oken e-Sbírky
}

export interface StatuteDossier {
  ref: string; // "586/1992"
  slug: string; // "586-1992"
  label: string;
  title: string | null; // esbirka_title, když je předpis v rejstříku e-Sbírky
  /** Předpis má vlastní law uzel v grafu (amends hrana) — census-only
   *  předpisy ho nemají a stopa u nich stojí jen na censu. */
  inRegistry: boolean;
  trail: StatuteTrailEntry[];
  paragraphs: ParagraphTrail[];
  coverage: StatuteCoverage;
}

export interface StatuteRegistryRow {
  ref: string;
  slug: string;
  label: string;
  title: string | null;
  trailBills: number;
  enactedBills: number;
  changes: number; // doložených §-změn (0 = §-stopa zatím není)
}

/* ── interní sběr ─────────────────────────────────────────────────────── */

interface RefBucket {
  title: Set<number>; // tiskId s amends hranou
  census: Set<number>; // tiskId s census záznamem
  label: string | null;
  esbirkaTitle: string | null;
}

function collectRefs(data: LawData): Map<string, RefBucket> {
  const out = new Map<string, RefBucket>();
  const bucket = (ref: string): RefBucket => {
    let b = out.get(ref);
    if (!b) {
      b = { title: new Set(), census: new Set(), label: null, esbirkaTitle: null };
      out.set(ref, b);
    }
    return b;
  };
  for (const bill of data.bills) {
    for (const l of bill.amendedLaws) {
      const b = bucket(l.ref);
      b.title.add(bill.tiskId);
      if (b.label === null) b.label = l.label;
      if (b.esbirkaTitle === null) b.esbirkaTitle = l.title;
    }
    for (const ref of bill.amendedLawsFull) bucket(ref).census.add(bill.tiskId);
  }
  return out;
}

/** Pořadí stopy (vyhlášené pravidlo): nejdřív vyhlášené tisky chronologicky
 *  vzestupně podle dne vyhlášení ve Sbírce (kronika zákona), pak projednávané
 *  tisky podle čísla tisku; bez čísla nakonec podle interního id. */
function trailOrder(a: StatuteTrailEntry, b: StatuteTrailEntry): number {
  const aDated = a.fatePublishedOn !== null;
  const bDated = b.fatePublishedOn !== null;
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (aDated && bDated && a.fatePublishedOn !== b.fatePublishedOn) {
    return a.fatePublishedOn! < b.fatePublishedOn! ? -1 : 1;
  }
  const ac = a.cislo ?? Number.MAX_SAFE_INTEGER;
  const bc = b.cislo ?? Number.MAX_SAFE_INTEGER;
  if (ac !== bc) return ac - bc;
  return a.tiskId - b.tiskId;
}

/** Přirozené řazení klíčů § („9" < „35" < „35ba" < „88"); reziduum poslední. */
export function paragraphKeyOrder(a: string, b: string): number {
  if (a === NON_PARAGRAPH_KEY || b === NON_PARAGRAPH_KEY) {
    if (a === b) return 0;
    return a === NON_PARAGRAPH_KEY ? 1 : -1;
  }
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (na !== nb) return na - nb;
  return a.localeCompare(b, "cs");
}

/** Dedup klíč verzního okna diff artefaktu. */
const windowKey = (d: ParagraphDiff): string => `${d.parScope}|${d.from.date}|${d.to.date}`;

/**
 * Kandidáti okna (VYHLÁŠENÉ PRAVIDLO, tištěné na stránce): tisky z této stopy
 * vyhlášené ve Sbírce s dnem vyhlášení v intervalu (windowFrom, windowTo].
 * Používá se den VYHLÁŠENÍ, ne účinnosti — novela vyhlášená před začátkem okna
 * s pozdější účinností pravidlem poctivě propadne (raději mezera než domněnka).
 */
function windowCandidates(
  trail: readonly StatuteTrailEntry[],
  windowFrom: string,
  windowTo: string,
): ParagraphChangeCandidate[] {
  return trail
    .filter(
      (t): t is StatuteTrailEntry & { fatePublishedOn: string } =>
        t.fatePublishedOn !== null && t.fatePublishedOn > windowFrom && t.fatePublishedOn <= windowTo,
    )
    .map((t) => ({
      tiskId: t.tiskId,
      cislo: t.cislo,
      title: t.title,
      fateSb: t.fateSb,
      fatePublishedOn: t.fatePublishedOn,
    }))
    .sort((a, b) => (a.fatePublishedOn < b.fatePublishedOn ? -1 : a.fatePublishedOn > b.fatePublishedOn ? 1 : (a.cislo ?? 1e9) - (b.cislo ?? 1e9)));
}

/* ── veřejná derivace ─────────────────────────────────────────────────── */

/**
 * Dosjar jednoho předpisu nad už načtenými LawData — čisté pivotování, žádné
 * další čtení store (týž přístup jako findBillByCislo). Null, když předpis
 * ve stopě vůbec není nebo jeho ref nemá kanonický tvar č./rok.
 */
export function deriveStatuteDossier(data: LawData, ref: string): StatuteDossier | null {
  const slug = statuteSlug(ref);
  if (slug === null) return null;
  const bucket = collectRefs(data).get(ref);
  if (!bucket) return null;

  const billById = new Map(data.bills.map((b) => [b.tiskId, b]));
  const ids = new Set<number>([...bucket.title, ...bucket.census]);
  const trail: StatuteTrailEntry[] = [...ids]
    .map((id) => billById.get(id))
    .filter((b): b is LawBillView => b !== undefined)
    .map((b) => ({
      tiskId: b.tiskId,
      cislo: b.cislo,
      title: b.title,
      summary: b.summary,
      origin: b.origin,
      stav: b.stav,
      fateSb: b.fateSb,
      fatePublishedOn: b.fatePublishedOn,
      sponsors: b.sponsors,
      flaggedConflict: b.flaggedConflict,
      provenance: (bucket.title.has(b.tiskId)
        ? bucket.census.has(b.tiskId)
          ? "both"
          : "title"
        : "census") as TrailProvenance,
    }))
    .sort(trailOrder);
  if (trail.length === 0) return null;

  // §-diffy tohoto předpisu: každý tisk s amends hranou je nese duplicitně
  // (getLawData je věší na všechny tisky novelizující týž zákon) — dedup
  // podle verzního okna, žádný hunk se nezdvojí ani neztratí.
  const seen = new Set<string>();
  const diffs: ParagraphDiff[] = [];
  for (const b of data.bills) {
    for (const d of b.paragraphDiffs) {
      if (d.law !== ref) continue;
      const k = windowKey(d);
      if (seen.has(k)) continue;
      seen.add(k);
      diffs.push(d);
    }
  }

  const byKey = new Map<string, ParagraphChange[]>();
  for (const d of diffs) {
    const candidates = windowCandidates(trail, d.from.date, d.to.date);
    for (const h of d.hunks) {
      const key = paragraphKeyOf(h.fragment);
      const arr = byKey.get(key) ?? [];
      arr.push({
        fragment: h.fragment,
        op: h.op,
        before: h.before,
        after: h.after,
        windowFrom: d.from.date,
        windowTo: d.to.date,
        eliFrom: d.from.eli,
        eliTo: d.to.eli,
        source: d.source,
        candidates,
      });
      byKey.set(key, arr);
    }
  }

  const paragraphs: ParagraphTrail[] = [...byKey.entries()]
    .map(([key, changes]) => ({
      key,
      anchor: paragraphAnchor(key),
      label: paragraphLabel(key),
      // v rámci § chronologicky po oknech, uvnitř okna po fragmentu (přirozeně)
      changes: [...changes].sort(
        (a, b) =>
          (a.windowFrom < b.windowFrom ? -1 : a.windowFrom > b.windowFrom ? 1 : 0) ||
          a.fragment.localeCompare(b.fragment, "cs", { numeric: true }),
      ),
      windows: new Set(changes.map((c) => `${c.windowFrom}|${c.windowTo}`)).size,
    }))
    .sort((a, b) => paragraphKeyOrder(a.key, b.key));

  const allChanges = paragraphs.flatMap((p) => p.changes);
  const coverage: StatuteCoverage = {
    trailBills: trail.length,
    enactedBills: trail.filter((t) => t.fatePublishedOn !== null).length,
    censusOnlyBills: trail.filter((t) => t.provenance === "census").length,
    paragraphs: paragraphs.length,
    changes: allChanges.length,
    changesWithCandidates: allChanges.filter((c) => c.candidates.length > 0).length,
    windows: seen.size,
  };

  return {
    ref,
    slug,
    label: bucket.label ?? `zákon č. ${ref} Sb.`,
    title: bucket.esbirkaTitle,
    inRegistry: bucket.title.size > 0,
    trail,
    paragraphs,
    coverage,
  };
}

/**
 * Rejstřík všech předpisů ve stopě (pro /zakony/predpis): řazeno podle počtu
 * tisků sestupně, pak podle ref — týž řád jako topLaws na /zakony. Předpisy
 * s nekanonickým ref (nejdou adresovat) se poctivě vynechávají.
 */
export function listStatuteRegistry(data: LawData): StatuteRegistryRow[] {
  const refs = collectRefs(data);
  const diffChangesByRef = new Map<string, number>();
  const seen = new Set<string>();
  for (const b of data.bills) {
    for (const d of b.paragraphDiffs) {
      const k = `${d.law}|${windowKey(d)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      diffChangesByRef.set(d.law, (diffChangesByRef.get(d.law) ?? 0) + d.hunks.length);
    }
  }
  const billById = new Map(data.bills.map((b) => [b.tiskId, b]));
  const rows: StatuteRegistryRow[] = [];
  for (const [ref, b] of refs) {
    const slug = statuteSlug(ref);
    if (slug === null) continue;
    const ids = new Set([...b.title, ...b.census]);
    let enacted = 0;
    for (const id of ids) if (billById.get(id)?.fatePublishedOn) enacted++;
    rows.push({
      ref,
      slug,
      label: b.label ?? `zákon č. ${ref} Sb.`,
      title: b.esbirkaTitle,
      trailBills: ids.size,
      enactedBills: enacted,
      changes: diffChangesByRef.get(ref) ?? 0,
    });
  }
  return rows.sort((a, b) => b.trailBills - a.trailBills || a.ref.localeCompare(b.ref, "cs", { numeric: true }));
}
