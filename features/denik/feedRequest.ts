/*
 * Sdílené kousky obou feedových route handlerů deníku — aby XML a JSON podoba
 * nemohly odpovídat každá po svém. Zrcadlo features/schranka/feedRequest.ts,
 * které tenhle vzor zavedlo; `requestOrigin` tady do 2026-08-12 existoval
 * DVAKRÁT, v každé routě jednou.
 */

import "server-only";
import { headers } from "next/headers";
import { isEntityKey } from "@/features/schranka/followCodec";

/** Origin requestu. Prázdný, když host chybí — nikdy vymyšlená doména. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

/**
 * Feed je dávkově počítaná vrstva (mění se s ingestem, ne s requestem), takže
 * smí chvíli žít v cache. Týž hlavičkový řetězec jako /embed/zebricek — dvě
 * čísla na dvou místech by znamenala dvě politiky jedné vrstvy.
 */
export const FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

/** Odpověď na nesmyslný `?entita=` — jmenuje držené tvary, ať se adresa dá
 *  opravit. Jednojazyčně česky, jako celý strojový artefakt. */
export const INVALID_ENTITY_KEY_MESSAGE =
  "neplatný klíč entity v ?entita= — držené tvary: poslanec:<číslo>, tisk:<číslo>, firma:<ičo>, obec:<ičo>";

/**
 * Klíč entity z query, nebo verdikt „neplatný".
 *
 * NEPLATNÝ TVAR JE VADA ADRESY, NE PRÁZDNÝ TÝDEN (2026-08-12). Do téhle
 * opravy braly obě routy `?entita=` syrově: „?entita=ahoj" vracelo HTTP 200 a
 * platný prázdný feed, který ten nesmysl nesl ve vlastní `feed_url` i
 * `home_page_url` — tedy vyrobený odběr, který nikdy nic nedoručí, a čtečka
 * se to nedozví. Tvar posuzuje TÝŽ test jako plocha a schránka
 * (`isEntityKey`), ne třetí kopie regulárního výrazu.
 *
 * PLATNÝ klíč, který nic nenajde, si svůj prázdný feed s HTTP 200 ponechává:
 * to je pravdivá odpověď („o téhle entitě zatím nic"), ne vada adresy.
 */
export function readFeedEntityKey(request: Request): { key: string | null } | { invalid: true } {
  const key = new URL(request.url).searchParams.get("entita");
  if (key !== null && !isEntityKey(key)) return { invalid: true };
  return { key };
}
