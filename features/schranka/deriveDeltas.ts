/*
 * Občanská schránka (moonshot 7A) — PURE odvození „co se změnilo od minulé
 * návštěvy" pro sledované entity.
 *
 * Zdroje jsou VÝHRADNĚ existující read-only vrstvy záznamu:
 *   – přepočet indexu přispění (`contribution_provenance` na uzlech osob,
 *     vlna 2) — jediný řádek na sledovaného poslance, BEZ velikosti změny
 *     (graf předchozí hodnoty neuchovává; viz recomputeFact.ts),
 *   – záznamy Deníku republiky (features/denik/deriveDenik — smlouvy,
 *     rejstříkové role, kroky tisků, rozhodnutí lidské brány, proud
 *     „zaznamenáno" z change_event), které už nesou klíče entit i provenance,
 *   – podepsané forenzní posudky z Deníku důkazů (features/dukazy/deriveFeed)
 *     mapované na klíče `tisk:<číslo>`.
 *
 * Žádná nová věta, datum ani částka se tu NEVYMÝŠLÍ: každý řádek delty je
 * doslovný záznam deníku/důkazů se svým zdrojem (provenance) a příznakem
 * pending. Schránka jen filtruje a počítá.
 *
 * ── GRANULARITA „OD MINULÉ NÁVŠTĚVY" ────────────────────────────────────────
 * Záznamy deníku jsou datované DNEM (`YYYY-MM-DD`), poslední návštěva je
 * instant. Delta proto bere záznamy s dnem >= dnem poslední návštěvy — den
 * návštěvy se počítá CELÝ znovu. Raději ukázat záznam podruhé než nějaký
 * zamlčet; plocha granularitu přizná („od dne poslední návštěvy").
 *
 * ── DETERMINISMUS ───────────────────────────────────────────────────────────
 * Vstupní záznamy v libovolném pořadí → byte-identický výstup: entity
 * s novinkami napřed (nejčerstvější den první, pak klíč vzestupně), uvnitř
 * entity řazení deníku (dny sestupně, druh, id). Testy to přibíjejí.
 */

import {
  filterDenikEntries,
  entityLabel,
  type DenikEntry,
} from "@/features/denik/deriveDenik";
import type { EvidenceEntry } from "@/features/dukazy/deriveFeed";
import { entityDenikHref, entityHref, isEntityKey } from "./followCodec";
import { recomputeDelta, type RecomputeFact } from "./recomputeFact";

/** Řádek delty — serializovatelná projekce záznamu deníku (viz hlavička:
 *  žádné nové věty; titulek, zdroj i příznaky jsou doslova záznam). */
export interface DeltaEntry {
  id: string;
  /** `YYYY-MM-DD` — den záznamu (viz pravidlo deníku o dvou proudech času). */
  date: string;
  kind: DenikEntry["kind"] | "forensic" | "recompute";
  titleCs: string;
  czk?: number;
  pending: boolean;
  timeBasis: DenikEntry["timeBasis"];
  /** Doslovné jméno registru/záznamu — provenance řádku. */
  source: string;
  tone: DenikEntry["tone"];
  internalHref: string | null;
}

export interface EntityDelta {
  key: string;
  /** Popisek ze záznamů serveru; klíč, když ho záznamy nenesou. */
  label: string;
  /** Interní evidenční stránka entity (firma poctivě nemá). */
  href: string | null;
  /** Deník entity — trvalá adresa odběru. */
  denikHref: string;
  /** Kolik záznamů od `since` entita nese (před seříznutím na `cap`). */
  total: number;
  /** Nejčerstvější den záznamu delty; null = žádná novinka. */
  latestDate: string | null;
  /**
   * Počty podle DRUHU zápisu, spočítané PŘED seříznutím na `cap` (souhrn
   * v hlavičce entity tedy mluví o celé deltě, ne o tom, co se vešlo).
   * Pořadí je KIND_ORDER — totéž, v jakém pod hlavičkou stojí řádky; nulové
   * druhy se nevydávají. Čtenářské názvy dává kindVocabulary.ts.
   */
  kinds: { kind: DeltaEntry["kind"]; count: number }[];
  entries: DeltaEntry[];
}

/** Kolik řádků delty se na entitu nejvýš posílá/kreslí — zbytek nese `total`
 *  a odkaz na deník entity. */
export const DELTA_ENTRIES_CAP = 25;

/** Okno první návštěvy: bez razítka poslední návštěvy se ukáže posledních
 *  7 dnů záznamu — a plocha to přizná (žádné „všechno od roku 2013"). */
export const FIRST_VISIT_DAYS = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` dne, do kterého spadá ISO instant; nevalidní vstup → null. */
export function dayOf(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Den o `days` dnů před `today` (UTC aritmetika — žádné pásmové drifty). */
export function daysBefore(today: string, days: number): string {
  const m = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return today;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - days);
  return new Date(t).toISOString().slice(0, 10);
}

/** Práh delty: den poslední návštěvy, nebo okno první návštěvy. */
export function sinceDay(lastVisitIso: string | null, today: string): string {
  return dayOf(lastVisitIso) ?? daysBefore(today, FIRST_VISIT_DAYS - 1);
}

const toDelta = (e: DenikEntry): DeltaEntry => ({
  id: e.id,
  date: e.date,
  kind: e.kind,
  titleCs: e.titleCs,
  ...(e.czk !== undefined ? { czk: e.czk } : {}),
  pending: e.pending,
  timeBasis: e.timeBasis,
  source: e.source,
  tone: e.tone,
  internalHref: e.internalHref,
});

/** Podepsaný forenzní posudek (Deník důkazů) → řádek delty pro `tisk:<číslo>`.
 *  Mapují se JEN posudky se stavem verified — deriveEvidenceFeed tu disciplínu
 *  drží už na vstupu, tady se drží klíč a den. */
export function forensicToDelta(entry: EvidenceEntry): { key: string; delta: DeltaEntry } | null {
  if (entry.kind !== "forensic") return null;
  const m = entry.internalHref?.match(/^\/zakony\/(\d+)$/);
  const date = dayOf(entry.decidedAt);
  if (!m || date === null) return null;
  return {
    key: `tisk:${m[1]}`,
    delta: {
      id: `forensic:${entry.id}`,
      date,
      kind: "forensic",
      titleCs: `${entry.decisionCs} — ${entry.subjectCs}`,
      pending: false,
      timeBasis: "zaznamenano",
      source: entry.sourceCs.replace(/^zdroj: /, ""),
      tone: "ochre",
      internalHref: entry.internalHref,
    },
  };
}

const KIND_ORDER: Record<DeltaEntry["kind"], number> = {
  contract: 0,
  billAssigned: 1,
  billPublished: 2,
  roleStart: 3,
  roleEnd: 4,
  review: 5,
  change: 6,
  forensic: 7,
  recompute: 8,
};

/** Druhy v pořadí KIND_ORDER — jediný zdroj pořadí souhrnu i řazení řádků. */
const KINDS_IN_ORDER = (Object.keys(KIND_ORDER) as DeltaEntry["kind"][]).sort(
  (a, b) => KIND_ORDER[a] - KIND_ORDER[b],
);

/** Počty podle druhu, v KIND_ORDER; nulové druhy se vynechávají. */
export function countKinds(
  entries: readonly DeltaEntry[],
): { kind: DeltaEntry["kind"]; count: number }[] {
  const counts = new Map<DeltaEntry["kind"], number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return KINDS_IN_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((kind) => ({
    kind,
    count: counts.get(kind) ?? 0,
  }));
}

const deltaCompare = (a: DeltaEntry, b: DeltaEntry): number => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.id.localeCompare(b.id);
};

export interface DeltaInput {
  /** Záznamy deníku (deriveDenikEntries — už datované, možné a seřazené). */
  entries: readonly DenikEntry[];
  /** Podepsané forenzní posudky (deriveEvidenceFeed), smí být prázdné. */
  forensic?: readonly EvidenceEntry[];
  /**
   * Jednotný přepočet indexu přispění (contribution_provenance) — přidá řádek
   * sledovaným POSLANCŮM, spadne-li den průchodu do okna. null = graf o sobě
   * nic jednotného netvrdí (viz recomputeFact.ts).
   */
  recompute?: RecomputeFact | null;
  /** Sledované klíče; nevalidní se přeskočí (kodek je poslední stráž). */
  keys: readonly string[];
  /** `YYYY-MM-DD` — záznamy s dnem >= since jsou novinky (viz hlavička). */
  since: string;
  cap?: number;
}

/** Delta jedné entity. `total`/`latestDate` se počítají PŘED seříznutím. */
export function deriveEntityDelta(input: Omit<DeltaInput, "keys"> & { key: string }): EntityDelta {
  const cap = input.cap ?? DELTA_ENTRIES_CAP;
  const since = DAY_RE.test(input.since) ? input.since : "9999-12-31";

  const own = filterDenikEntries(input.entries, input.key)
    .filter((e) => e.date >= since)
    .map(toDelta);
  for (const f of input.forensic ?? []) {
    const mapped = forensicToDelta(f);
    if (mapped && mapped.key === input.key && mapped.delta.date >= since) own.push(mapped.delta);
  }
  const recompute = recomputeDelta(input.recompute ?? null, input.key, since);
  if (recompute !== null) own.push(recompute);
  own.sort(deltaCompare);

  return {
    key: input.key,
    label: entityLabel(input.entries, input.key) ?? input.key,
    href: entityHref(input.key),
    denikHref: entityDenikHref(input.key),
    total: own.length,
    latestDate: own.length > 0 ? own[0].date : null,
    kinds: countKinds(own),
    entries: own.slice(0, Math.max(0, cap)),
  };
}

/**
 * Delty všech sledovaných entit: novinky napřed (nejčerstvější den první,
 * pak klíč vzestupně), entity beze změny na konci (klíč vzestupně) — schránka
 * je ukazuje taky, „beze změny" je informace, ne mezera.
 */
export function deriveDeltas(input: DeltaInput): EntityDelta[] {
  const keys = [...new Set(input.keys.filter(isEntityKey))];
  const deltas = keys.map((key) => deriveEntityDelta({ ...input, key }));
  deltas.sort((a, b) => {
    const aNews = a.latestDate !== null ? 1 : 0;
    const bNews = b.latestDate !== null ? 1 : 0;
    if (aNews !== bNews) return bNews - aNews;
    if (a.latestDate !== b.latestDate) return (a.latestDate ?? "") < (b.latestDate ?? "") ? 1 : -1;
    return a.key.localeCompare(b.key);
  });
  return deltas;
}

/** Součet novinek přes entity — číslo odznaku v liště. */
export function totalNews(deltas: readonly EntityDelta[]): number {
  return deltas.reduce((s, d) => s + d.total, 0);
}
