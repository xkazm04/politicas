/*
 * REJSTŘÍK FORENZNÍCH POSUDKŮ — čistá agregace nad tím, co už graf nese.
 *
 * ── Proč vůbec ──────────────────────────────────────────────────────────────
 * Posudek nese 141 ze 141 tisků, ale čtenář se k němu dostal jedině po jednom
 * na /zakony/[cislo]. Přehled /zakony celý korpus srazil na jediný boolean
 * („posudek" jako facet v prohlížeči tisků): nikde nestálo, že census je
 * UZAVŘENÝ, jak jsou posudky rozdělené podle závažnosti, ani kolik jich má část
 * textu zadrženou jazykovou bránou. Tenhle modul to dopočítá — z hodnot, které
 * loader už přečetl.
 *
 * ── Pravidla, která se nesmí porušit ────────────────────────────────────────
 *  1. ŽÁDNÉ nové čtení grafu. Vstupem je pole, které `getLawData` už postavil.
 *  2. Slovník závažnosti se NEPŘEPISUJE: token se nese doslova a `known` říká,
 *     jestli pro něj katalog má český štítek (vzor features/money/tieFlags.ts —
 *     neznámý token se vypíše doslova a označí, nikdy se neschová).
 *  3. Řazení je NEUTRÁLNÍ a vytištěné na ploše: skupiny podle počtu sestupně,
 *     při shodě podle tokenu vzestupně; tisky uvnitř skupiny podle čísla tisku
 *     vzestupně. Řadit skupiny „nízká → vysoká" by z hodnocení analýzy udělalo
 *     stupnici pochybení, kterou žádný úřad nevydal.
 *  4. Zadržený text se přiznává JAKO ZADRŽENÝ, nikdy jako chybějící: text
 *     zůstává v grafu, jen se nezobrazuje.
 */

import { SEVERITY_KEYS } from "./lawwatchLabels";

/** Strukturální vstup — `LawBillView` ho splňuje, ale modul na něm nezávisí
 *  (a nemusí tak importovat `server-only` loader ani v typu). */
export interface ForensicIndexBill {
  cislo: number | null;
  tiskId: number;
  forensic: {
    severity: string;
    confidence: number | null;
    reviewState: string;
    withheldFields: number;
    pass: number | null;
  } | null;
}

export interface ForensicIndexEntry {
  /** Veřejné číslo tisku — klíč adresy /zakony/<cislo>. `null` ⇒ řádek na dosje nevede. */
  cislo: number | null;
  tiskId: number;
  /** Doslovný token ze záznamu, nikdy přepsaný. */
  severity: string;
  /** false ⇒ katalog pro token nemá štítek; plocha ho vypíše doslova a označí. */
  severityKnown: boolean;
  reviewState: string;
  confidence: number | null;
  /** Kolik čtenářských řetězců tohoto posudku zadržela jazyková brána. */
  withheldFields: number;
}

export interface ForensicSeverityGroup {
  severity: string;
  known: boolean;
  count: number;
  entries: ForensicIndexEntry[];
}

export interface ForensicReviewStateCount {
  state: string;
  count: number;
}

export interface ForensicIndexView {
  /** Kolik tisků korpus vůbec má (jmenovatel „X ze Y"). */
  totalBills: number;
  /** Kolik z nich nese posudek. */
  verdictCount: number;
  /** true ⇒ posudek nese každý tisk korpusu (a korpus není prázdný). */
  complete: boolean;
  groups: ForensicSeverityGroup[];
  reviewStates: ForensicReviewStateCount[];
  /** Posudky s aspoň jedním zadrženým řetězcem. */
  withheldVerdictCount: number;
  /** Součet zadržených řetězců přes všechny posudky. */
  withheldFieldCount: number;
  /** Posudky u tisku bez veřejného čísla — řádek nevede na dosje, a plocha to řekne. */
  unlinkableCount: number;
  /** Různé průchody grafu, které posudky zapsaly, vzestupně. */
  passes: number[];
  /** Jediný průchod, pokud se na něm shodne CELÝ korpus posudků; jinak null. */
  uniformPass: number | null;
}

/** Tisky uvnitř skupiny: podle čísla tisku vzestupně, tisky bez čísla nakonec
 *  (podle interního id) — neutrální pořadí, žádná salience. */
function byPrintNumber(a: ForensicIndexEntry, b: ForensicIndexEntry): number {
  if (a.cislo === null && b.cislo === null) return a.tiskId - b.tiskId;
  if (a.cislo === null) return 1;
  if (b.cislo === null) return -1;
  return a.cislo - b.cislo;
}

/**
 * Agregace posudků nad již načteným polem tisků. Čistá funkce: žádné čtení
 * grafu, žádné čtení souborů, žádné hodiny.
 */
export function deriveForensicIndex(bills: readonly ForensicIndexBill[]): ForensicIndexView {
  const entries: ForensicIndexEntry[] = [];
  for (const b of bills) {
    if (!b.forensic) continue;
    entries.push({
      cislo: b.cislo,
      tiskId: b.tiskId,
      severity: b.forensic.severity,
      severityKnown: SEVERITY_KEYS.has(b.forensic.severity),
      reviewState: b.forensic.reviewState,
      confidence: b.forensic.confidence,
      withheldFields: b.forensic.withheldFields,
    });
  }

  const bySeverity = new Map<string, ForensicIndexEntry[]>();
  for (const e of entries) {
    const arr = bySeverity.get(e.severity) ?? [];
    arr.push(e);
    bySeverity.set(e.severity, arr);
  }
  const groups: ForensicSeverityGroup[] = [...bySeverity.entries()]
    .map(([severity, arr]) => ({
      severity,
      known: SEVERITY_KEYS.has(severity),
      count: arr.length,
      entries: [...arr].sort(byPrintNumber),
    }))
    // Vyhlášené pravidlo: počet sestupně, při shodě token vzestupně. Nikdy
    // podle „síly" závažnosti — to by byla stupnice, kterou nikdo nevydal.
    .sort((a, b) => b.count - a.count || a.severity.localeCompare(b.severity));

  const byState = new Map<string, number>();
  for (const e of entries) byState.set(e.reviewState, (byState.get(e.reviewState) ?? 0) + 1);
  const reviewStates: ForensicReviewStateCount[] = [...byState.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));

  const passes = [...new Set(bills.flatMap((b) => (b.forensic && b.forensic.pass != null ? [b.forensic.pass] : [])))].sort(
    (a, b) => a - b,
  );
  // Jediný průchod se smí vytisknout jen tehdy, když ho nese KAŽDÝ posudek —
  // půl korpusu bez provenience není „průchod 55", je to neúplná evidence.
  const verdictsWithPass = bills.filter((b) => b.forensic && b.forensic.pass != null).length;
  const uniformPass = passes.length === 1 && entries.length > 0 && verdictsWithPass === entries.length ? passes[0] : null;

  return {
    totalBills: bills.length,
    verdictCount: entries.length,
    complete: entries.length > 0 && entries.length === bills.length,
    groups,
    reviewStates,
    withheldVerdictCount: entries.filter((e) => e.withheldFields > 0).length,
    withheldFieldCount: entries.reduce((s, e) => s + e.withheldFields, 0),
    unlinkableCount: entries.filter((e) => e.cislo === null).length,
    passes,
    uniformPass,
  };
}
