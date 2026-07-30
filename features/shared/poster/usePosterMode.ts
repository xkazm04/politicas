"use client";

// Režim plakátu — po dobu, kdy je na ploše vidět <PosterFrame>, drží na <html>
// atribut `data-poster-mode`. Na ten atribut je PODMÍNĚNÁ celá tisková vrstva
// v app/globals.css (tiskne se jen `.poster-sheet`, chrom aplikace zmizí) —
// běžný tisk ostatních stránek se bez atributu nijak nemění.
//
// Použití (klientská komponenta, která arch hostí):
//   const { printPoster } = usePosterMode();
//   <button onClick={printPoster}>Tisk</button>

import { useCallback, useEffect } from "react";

const ATTR = "data-poster-mode";

export function usePosterMode(): { printPoster: () => void } {
  useEffect(() => {
    document.documentElement.setAttribute(ATTR, "1");
    return () => document.documentElement.removeAttribute(ATTR);
  }, []);

  const printPoster = useCallback(() => {
    window.print();
  }, []);

  return { printPoster };
}
