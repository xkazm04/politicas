/*
 * Sdílené kousky obou feedových route handlerů schránky — aby XML a JSON
 * podoba nemohly stavět adresy ani prahy každá po svém.
 */

import "server-only";
import { headers } from "next/headers";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Origin requestu (precedens /denik/feed.*). Prázdný, když host chybí. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

/** Práh z `od=`; nevalidní nebo chybějící → null, tedy okno první návštěvy
 *  (getSchrankaDeltas). Nevalidní den se NEOPRAVUJE odhadem. */
export function feedSince(raw: string | null): string | null {
  return raw !== null && DAY_RE.test(raw) ? raw : null;
}
