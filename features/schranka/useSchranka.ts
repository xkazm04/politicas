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
  readSchranka,
  SCHRANKA_SCHEMA_VERSION,
  SCHRANKA_STORAGE_KEY,
  serializeSchrankaState,
  withFollow,
  withoutFollow,
  withSeen,
  type SchrankaState,
  type SeenWatermark,
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
  // Payload z BUDOUCNOSTI se nepřepisuje. Nastane při rollbacku vydání, ve
  // druhé záložce po nasazení nebo na synchronizovaném profilu: novější verze
  // aplikace zapsala tvar, kterému tenhle kód nerozumí. Běžíme na výchozím
  // stavu (schránka se tváří prázdná), ale ULOŽIT ho znamená zahodit seznam,
  // který si čtenář postavil a který novější verze umí přečíst. Držíme se
  // zpátky a řekneme to nahlas — ticho by z toho udělalo ztrátu dat.
  if (fromFuture) {
    console.warn(
      "[schranka] uložený tvar je novější než tenhle kód (v>%d) — sledování se pro jistotu NEUKLÁDÁ, aby se novější data nepřepsala",
      SCHRANKA_SCHEMA_VERSION,
    );
    return;
  }
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
/** Drží poslední odpověď kodeku na otázku „psala tenhle payload novější verze?"
 *  — jediná informace, kterou samotný `SchrankaState` nést nemůže. */
let fromFuture = false;

function getSnapshot(): SchrankaState {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    const read = readSchranka(raw);
    cachedState = read.state;
    fromFuture = read.fromFuture;
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
  /** Orazítkuje návštěvu schránky; vrací PŘEDCHOZÍ razítko (práh delty) i to
   *  právě zapsané (den, ke kterému se pak zapíše vodoznak viděného). */
  stampVisit: () => { prev: string | null; now: string };
  /** Zapíše vodoznak viděného — co plocha při téhle návštěvě ukázala (odznak
   *  v liště to pak odečítá, viz visitWindow.ts). */
  markSeen: (seen: SeenWatermark) => void;
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

  const stampVisit = useCallback((): { prev: string | null; now: string } => {
    const fresh = getSnapshot();
    const now = new Date().toISOString();
    writeState({ ...fresh, lastVisit: now });
    return { prev: fresh.lastVisit, now };
  }, []);

  const markSeen = useCallback((seen: SeenWatermark) => {
    const fresh = getSnapshot();
    const next = withSeen(fresh, seen);
    // Beze změny se nezapisuje: zápis rozvlní odběratele (odznak i tlačítka)
    // a opakovaný zápis téhož vodoznaku by je překresloval pro nic.
    if (next !== fresh) writeState(next);
  }, []);

  return { state, isFollowed, follow, unfollow, stampVisit, markSeen };
}
