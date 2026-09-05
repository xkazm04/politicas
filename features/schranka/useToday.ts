"use client";

/*
 * Dnešek jako PŘEDPLATNÉ, ne jako hodnota přečtená v renderu.
 *
 * Schránka počítá práh „od minulé návštěvy" ze dneška (okno první návštěvy,
 * srovnání s vodoznakem). Když se `new Date()` přečte přímo v těle renderu,
 * nová hodnota po půlnoci se do polí závislostí efektu nikdy nedostane:
 * podpis dotazu se přepočítá, uložená odpověď mu přestane odpovídat a odběratel
 * (odznak) zůstane navždy v „nevím" — dokud čtenář nezmění sledování.
 *
 * Tenhle hook je proto vnější úložiště: modulová hodnota + jeden interval na
 * všechny odběratele. Zrnitost přechodu je minuta (den se mění jednou za den,
 * přesnost na sekundu nemá co koupit); mimo prohlížeč (SSR) se vrací den
 * spočtený při načtení modulu — nic z něj se nekreslí, schránka je do hydratace
 * prázdná.
 */

import { useSyncExternalStore } from "react";
import { pragueDay } from "@/features/denik/pragueDay";

/** Dnešek jako PRAŽSKÝ den (features/denik/pragueDay.ts) — server datuje `builtOn`
 *  i práh delty pražským dnem, a do 2026-09-07 tu stál řez UTC řetězce: mezi půlnocí
 *  a 01:00/02:00 pražského času měl klient jiný „dnešek“ než server, okno první
 *  návštěvy bylo o den posunuté a odznak přepínal den ve dvě ráno. */
export const todayStr = (): string => pragueDay();

const TICK_MS = 60_000;

let day = todayStr();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  const now = todayStr();
  if (now === day) return;
  day = now;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (timer === null) timer = setInterval(tick, TICK_MS);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Referenčně stabilní mezi ticky — useSyncExternalStore jinak zacyklí render.
const getSnapshot = (): string => day;

/** Dnešní den `YYYY-MM-DD`; překreslí odběratele, když se den změní. */
export function useToday(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
