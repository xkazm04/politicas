/*
 * Tvar odpovědi /schranka/novinky.json — sdílený mezi route handlerem
 * (server) a klientskými odběrateli (odznak lišty, plocha schránky).
 * Čistý modul: typ + tolerantní parse (klient nikdy nevěří síti naslepo).
 */

import type { EntityDelta } from "./deriveDeltas";

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
}

/** Tolerantní parse odpovědi: cokoli mimo tvar → null (plocha ukáže čestný
 *  stav „novinky teď nelze načíst", nikdy nespadne na cizím JSONu). */
export function parseNovinkyResponse(data: unknown): NovinkyResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.builtOn !== "string" || typeof o.since !== "string") return null;
  if (typeof o.coverage !== "object" || o.coverage === null) return null;
  if (!Array.isArray(o.deltas)) return null;
  for (const d of o.deltas) {
    if (typeof d !== "object" || d === null) return null;
    const e = d as Record<string, unknown>;
    if (typeof e.key !== "string" || typeof e.total !== "number" || !Array.isArray(e.entries)) return null;
  }
  return data as NovinkyResponse;
}
