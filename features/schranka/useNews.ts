"use client";

/*
 * Odznak novinek — klientské čtení /schranka/novinky.json pro lištu.
 *
 * Bez razítka poslední návštěvy odznak NESVÍTÍ (nic není „nové od návštěvy",
 * která se nikdy nestala) a bez sledovaných entit se nic nestahuje. Odpověď
 * se drží v modulové cache s TTL, klíčované dotazem — lišta je na každé
 * stránce a nemá záznam dobývat při každé navigaci (server má navíc vlastní
 * memo vrstvy + cache-control).
 */

import { useEffect, useState } from "react";
import { sinceDay, totalNews } from "./deriveDeltas";
import { parseNovinkyResponse, type NovinkyResponse } from "./novinky";
import { useSchranka } from "./useSchranka";
import { useToday } from "./useToday";
import { badgeCount } from "./visitWindow";

const TTL_MS = 60_000;

const cache = new Map<string, { at: number; promise: Promise<NovinkyResponse | null> }>();

export function novinkyQuery(keys: readonly string[], since: string): string {
  const params = new URLSearchParams();
  for (const k of [...keys].sort()) params.append("e", k);
  params.set("od", since);
  return `/schranka/novinky.json?${params.toString()}`;
}

export function fetchNovinky(keys: readonly string[], since: string): Promise<NovinkyResponse | null> {
  const query = novinkyQuery(keys, since);
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = fetch(query)
    .then(async (res) => {
      if (!res.ok) return null;
      return parseNovinkyResponse(await res.json());
    })
    .catch((): null => {
      // Síť/parse selhaly → null; odběratel kreslí čestný stav, cache
      // neúspěch nedrží (příští dotaz to zkusí znovu).
      cache.delete(query);
      return null;
    });
  cache.set(query, { at: Date.now(), promise });
  return promise;
}

/** Počet novinek u sledovaných entit; null = nelze říct (nenačteno/chyba).
 *
 *  Pravidlo odznaku je PŘÍSNĚJŠÍ než pravidlo plochy: od počtu se odečítá
 *  vodoznak viděného (visitWindow.ts), jinak by odznak po návštěvě zůstal
 *  svítit až do půlnoci — den poslední návštěvy se totiž na ploše počítá
 *  celý znovu. Rozdíl je vysvětlený na /schranka. */
export function useNewsCount(): number | null {
  const { state } = useSchranka();
  // Dnešek přes předplatné, ne přes `new Date()` v renderu: hodnota přečtená
  // v těle renderu se po půlnoci změní, ale do polí závislostí efektu se
  // nedostane — podpis by přestal sedět a odznak by zmlkl natrvalo.
  const today = useToday();

  const keysSig = state.follows
    .map((f) => f.key)
    .sort()
    .join("|");
  const lastVisit = state.lastVisit;
  // Bez razítka návštěvy není žádné „od minula" — odznak mlčí (0, poctivě);
  // bez sledování se nic nestahuje. Odvozeno v renderu, žádný setState.
  const idle = keysSig === "" || lastVisit === null;
  const since = idle ? null : sinceDay(lastVisit, today);
  const sig = since === null ? null : `${keysSig}@${since}`;

  // Výsledek nese podpis dotazu — zastaralá odpověď se prostě nepoužije,
  // žádné synchronní nulování v efektu (react-hooks/set-state-in-effect).
  const [res, setRes] = useState<{ sig: string; total: number | null } | null>(null);

  useEffect(() => {
    if (sig === null || since === null) return;
    let alive = true;
    fetchNovinky(keysSig.split("|"), since).then((r) => {
      if (!alive) return;
      setRes({ sig, total: r === null ? null : totalNews(r.deltas) });
    });
    return () => {
      alive = false;
    };
  }, [sig, since, keysSig]);

  if (idle || since === null) return 0;
  if (res === null || res.sig !== sig || res.total === null) return null;
  return badgeCount(res.total, since, state.seen);
}
