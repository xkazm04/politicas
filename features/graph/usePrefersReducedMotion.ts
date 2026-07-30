"use client";

/*
 * prefers-reduced-motion jako stav — pro animace ŘÍZENÉ KÓDEM (postupné
 * rozsvěcení kroků cesty intervalem), na které CSS media query nedosáhne.
 * useSyncExternalStore, aby se hodnota měnila živě s nastavením systému a
 * server snapshot byl bezpečný default (bez pohybu, dokud klient neřekne jinak).
 */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => true;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
