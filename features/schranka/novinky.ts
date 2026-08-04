/*
 * Tvar odpovědi /schranka/novinky.json — sdílený mezi route handlerem
 * (server) a klientskými odběrateli (odznak lišty, plocha schránky).
 * Čistý modul: typ + tolerantní parse (klient nikdy nevěří síti naslepo).
 *
 * Tolerantní ZNAMENÁ zahodit vadný kus, ne ho propašovat dál: neplatný řádek
 * (třeba `tone`, které schránka nezná) by prošel do renderu a tam se z něj
 * stala prázdná tečka — čtenář by o něm nevěděl. Vadné řádky a vadné entity
 * se proto zahazují a POČÍTAJÍ (`droppedEntries` / `droppedDeltas`); plocha
 * ten počet přizná. Rozbitá obálka je pořád null — o celé odpovědi se nedá
 * říct nic.
 */

import type { DeltaEntry, EntityDelta } from "./deriveDeltas";

export interface NovinkyCoverage {
  money: boolean;
  law: boolean;
  reviews: boolean;
  changes: boolean;
  /** Deník důkazů (forenzní posudky) čitelný. */
  dukazy: boolean;
}

export interface NovinkyResponse {
  v: 1;
  /** `YYYY-MM-DD` serveru — den sestavení. */
  builtOn: string;
  /** Práh delty, který server skutečně použil (`YYYY-MM-DD`). */
  since: string;
  coverage: NovinkyCoverage;
  deltas: EntityDelta[];
  /** Kolik řádků odpověď nesla v neznámém tvaru a klient je zahodil.
   *  Chybí u odpovědi, kterou sestavuje server (ten vadné řádky netvoří). */
  droppedEntries?: number;
  /** Totéž pro celé entity. */
  droppedDeltas?: number;
}

const TONES = new Set(["signal", "cobalt", "ink", "ochre"]);
const TIME_BASES = new Set(["ucinne", "zaznamenano"]);
const KINDS = new Set([
  "contract",
  "billAssigned",
  "billPublished",
  "roleStart",
  "roleEnd",
  "review",
  "change",
  "forensic",
]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";

/** Jeden řádek delty; cokoli mimo držený tvar → null (řádek se zahodí a spočítá). */
function parseDeltaEntry(v: unknown): DeltaEntry | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.id) || !isStr(o.date) || !DAY_RE.test(o.date)) return null;
  if (!isStr(o.kind) || !KINDS.has(o.kind)) return null;
  if (!isStr(o.titleCs) || !isStr(o.source)) return null;
  if (typeof o.pending !== "boolean") return null;
  if (!isStr(o.timeBasis) || !TIME_BASES.has(o.timeBasis)) return null;
  if (!isStr(o.tone) || !TONES.has(o.tone)) return null;
  if (!isStrOrNull(o.internalHref)) return null;
  if (o.czk !== undefined && (typeof o.czk !== "number" || !Number.isFinite(o.czk))) return null;
  return {
    id: o.id,
    date: o.date,
    kind: o.kind as DeltaEntry["kind"],
    titleCs: o.titleCs,
    ...(typeof o.czk === "number" ? { czk: o.czk } : {}),
    pending: o.pending,
    timeBasis: o.timeBasis as DeltaEntry["timeBasis"],
    source: o.source,
    tone: o.tone as DeltaEntry["tone"],
    internalHref: o.internalHref,
  };
}

function parseEntityDelta(v: unknown): { delta: EntityDelta; dropped: number } | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.key) || !isStr(o.label) || !isStr(o.denikHref)) return null;
  if (!isStrOrNull(o.href)) return null;
  if (typeof o.total !== "number" || !Number.isFinite(o.total)) return null;
  if (!isStrOrNull(o.latestDate)) return null;
  if (!Array.isArray(o.entries)) return null;

  const entries: DeltaEntry[] = [];
  let dropped = 0;
  for (const raw of o.entries) {
    const entry = parseDeltaEntry(raw);
    if (entry === null) dropped += 1;
    else entries.push(entry);
  }
  return {
    delta: {
      key: o.key,
      label: o.label,
      href: o.href,
      denikHref: o.denikHref,
      // `total` je počet PŘED seříznutím na ploše serveru — zahozené řádky ho
      // nesnižují (počet zápisů entity zahozením řádku nezmizel).
      total: o.total,
      latestDate: o.latestDate,
      entries,
    },
    dropped,
  };
}

/** Tolerantní parse odpovědi: rozbitá obálka → null (plocha ukáže čestný
 *  stav „novinky teď nelze načíst", nikdy nespadne na cizím JSONu); vadné
 *  entity a řádky se zahodí a spočítají. */
export function parseNovinkyResponse(data: unknown): NovinkyResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.builtOn !== "string" || typeof o.since !== "string") return null;
  if (typeof o.coverage !== "object" || o.coverage === null) return null;
  if (!Array.isArray(o.deltas)) return null;

  const deltas: EntityDelta[] = [];
  let droppedEntries = 0;
  let droppedDeltas = 0;
  for (const raw of o.deltas) {
    const parsed = parseEntityDelta(raw);
    if (parsed === null) {
      droppedDeltas += 1;
      continue;
    }
    droppedEntries += parsed.dropped;
    deltas.push(parsed.delta);
  }

  const coverage = o.coverage as Record<string, unknown>;
  return {
    v: 1,
    builtOn: o.builtOn,
    since: o.since,
    coverage: {
      money: coverage.money === true,
      law: coverage.law === true,
      reviews: coverage.reviews === true,
      changes: coverage.changes === true,
      dukazy: coverage.dukazy === true,
    },
    deltas,
    droppedEntries,
    droppedDeltas,
  };
}
