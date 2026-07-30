"use client";

/*
 * ODPOVĚDI V URL — stav kompasu (?hlasy=92793a-92810n-…). Stejná disciplína
 * jako features/civicscore/useLensWeights.ts (tam je plné zdůvodnění):
 *  - URL se čte až PO připojení (žádné useSearchParams — první render na
 *    serveru i klientu je prázdný kompas; sdílený výsledek naskočí o snímek
 *    později, hydratace se nikdy nerozjede).
 *  - Zápis přes history.replaceState — odpověď na otázku není navigace.
 *  - Neplatná hodnota se z adresy VYHODÍ, nikdy neopraví (adresa je tvrzení).
 *    Prázdná mapa = čistá adresa.
 */

import { useCallback, useEffect, useState } from "react";
import { ANSWERS_PARAM, decodeAnswers, encodeAnswers } from "./codec";
import type { Answer } from "./score";

export interface KompasAnswersState {
  answers: ReadonlyMap<number, Answer>;
  /** Nastavit / přepsat postoj; `null` = vzít odpověď zpět (přeskočit). */
  setAnswer: (votePspId: number, answer: Answer | null) => void;
  /** Smazat všechny odpovědi (čistá adresa). */
  reset: () => void;
}

const EMPTY: ReadonlyMap<number, Answer> = new Map();

export function useKompasAnswers(): KompasAnswersState {
  const [answers, setAnswers] = useState<ReadonlyMap<number, Answer>>(EMPTY);

  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(ANSWERS_PARAM);
      const decoded = raw !== null ? decodeAnswers(raw) : null;
      setAnswers(decoded ?? EMPTY);
      if (raw !== null && (decoded === null || decoded.size === 0)) {
        url.searchParams.delete(ANSWERS_PARAM);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const write = useCallback((next: Map<number, Answer>) => {
    const url = new URL(window.location.href);
    const encoded = encodeAnswers(next);
    if (encoded === null) url.searchParams.delete(ANSWERS_PARAM);
    else url.searchParams.set(ANSWERS_PARAM, encoded);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setAnswers(next);
  }, []);

  const setAnswer = useCallback(
    (votePspId: number, answer: Answer | null) => {
      const next = new Map(answers);
      if (answer === null) next.delete(votePspId);
      else next.set(votePspId, answer);
      write(next);
    },
    [answers, write],
  );

  const reset = useCallback(() => write(new Map()), [write]);

  return { answers, setAnswer, reset };
}
