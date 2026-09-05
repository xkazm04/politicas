/*
 * Sdílené kousky obou feedových route handlerů schránky — aby XML a JSON
 * podoba nemohly stavět adresy ani prahy každá po svém.
 */

import "server-only";
import { liveUrl } from "@/lib/routing/liveUrl";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Origin requestu (precedens /denik/feed.*). Prázdný, když host chybí. Skládá ho
 *  JEDNA definice (lib/routing/liveUrl.ts, round 37) — do 2026-09-07 tu stála třetí
 *  kopie skládání adresy z hlaviček hostu a proxy schématu vedle /kraj a /plakat. */
export async function requestOrigin(): Promise<string> {
  return liveUrl("");
}

/** Práh z `od=`; nevalidní nebo chybějící → null, tedy okno první návštěvy
 *  (getSchrankaDeltas). Nevalidní den se NEOPRAVUJE odhadem. */
export function feedSince(raw: string | null): string | null {
  return raw !== null && DAY_RE.test(raw) ? raw : null;
}
