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

const todayStr = (): string => new Date().toISOString().slice(0, 10);

/** Počet novinek u sledovaných entit; null = nelze říct (nenačteno/chyba). */
export function useNewsCount(): number | null {
  const { state } = useSchranka();

  const keysSig = state.follows
    .map((f) => f.key)
    .sort()
    .join("|");
  const lastVisit = state.lastVisit;
  // Bez razítka návštěvy není žádné „od minula" — odznak mlčí (0, poctivě);
  // bez sledování se nic nestahuje. Odvozeno v renderu, žádný setState.
  const idle = keysSig === "" || lastVisit === null;
  const sig = idle ? null : `${keysSig}@${sinceDay(lastVisit, todayStr())}`;

  // Výsledek nese podpis dotazu — zastaralá odpověď se prostě nepoužije,
  // žádné synchronní nulování v efektu (react-hooks/set-state-in-effect).
  const [res, setRes] = useState<{ sig: string; count: number | null } | null>(null);

  useEffect(() => {
    if (idle || lastVisit === null) return;
    let alive = true;
    const since = sinceDay(lastVisit, todayStr());
    fetchNovinky(keysSig.split("|"), since).then((r) => {
      if (!alive) return;
      setRes({ sig: `${keysSig}@${since}`, count: r === null ? null : totalNews(r.deltas) });
    });
    return () => {
      alive = false;
    };
  }, [idle, keysSig, lastVisit]);

  if (idle) return 0;
  return res !== null && res.sig === sig ? res.count : null;
}
