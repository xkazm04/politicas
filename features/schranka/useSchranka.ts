"use client";

/*
 * Klientský stav schránky — jediné místo, které čte/píše localStorage.
 *
 * useSyncExternalStore nad kodekem (followCodec.ts): server snapshot je
 * prázdná schránka (SSR nemá localStorage — první klientský render se srovná
 * po hydrataci), změny se šíří vlastní událostí (táž záložka: odznak v liště
 * i tlačítko sledování se překreslí hned) a událostí `storage` (jiné záložky).
 *
 * Zápis jde VŽDY přes kodek: read-modify-write nad čerstvým čtením úložiště,
 * aby dvě komponenty nepřepsaly jedna druhou zastaralým stavem.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_SCHRANKA,
  parseSchrankaState,
  SCHRANKA_STORAGE_KEY,
  serializeSchrankaState,
  withFollow,
  withoutFollow,
  type SchrankaState,
} from "./followCodec";

const CHANGE_EVENT = "politicas:schranka-changed";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SCHRANKA_STORAGE_KEY);
  } catch {
    // Zakázané úložiště (private mode, iframe) = schránka nefunguje, ale
    // aplikace žije dál — degradace na prázdný stav je tu záměr, ne mlčení.
    return null;
  }
}

function writeState(state: SchrankaState): void {
  try {
    window.localStorage.setItem(SCHRANKA_STORAGE_KEY, serializeSchrankaState(state));
  } catch (err) {
    // Táž degradace jako u čtení: bez úložiště se sledování prostě neuloží —
    // ale stopa po tom zůstává (zakázané/plné úložiště čtenář pozná z konzole).
    console.warn("[schranka] sledování se nepodařilo uložit", err);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Cache snapshotu: useSyncExternalStore vyžaduje referenčně stabilní snapshot
// mezi událostmi, jinak se render zacyklí. Klíčem je surový řetězec.
let cachedRaw: string | null | undefined;
let cachedState: SchrankaState = EMPTY_SCHRANKA;

function getSnapshot(): SchrankaState {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseSchrankaState(raw);
  }
  return cachedState;
}

const getServerSnapshot = (): SchrankaState => EMPTY_SCHRANKA;

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SCHRANKA_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export interface SchrankaApi {
  state: SchrankaState;
  isFollowed: (key: string) => boolean;
  follow: (key: string, label: string) => void;
  unfollow: (key: string) => void;
  /** Orazítkuje návštěvu schránky; vrací PŘEDCHOZÍ razítko (práh delty). */
  stampVisit: () => string | null;
}

export function useSchranka(): SchrankaApi {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isFollowed = useCallback((key: string) => state.follows.some((f) => f.key === key), [state]);

  const follow = useCallback((key: string, label: string) => {
    writeState(withFollow(getSnapshot(), key, label, new Date().toISOString()));
  }, []);

  const unfollow = useCallback((key: string) => {
    writeState(withoutFollow(getSnapshot(), key));
  }, []);

  const stampVisit = useCallback((): string | null => {
    const fresh = getSnapshot();
    writeState({ ...fresh, lastVisit: new Date().toISOString() });
    return fresh.lastVisit;
  }, []);

  return { state, isFollowed, follow, unfollow, stampVisit };
}
