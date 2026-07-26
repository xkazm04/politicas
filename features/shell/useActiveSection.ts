"use client";

/*
 * Scroll-spy nad deklarovanými kotvami stránky.
 *
 * Vrací dvojí: která sekce je právě ve čtecím pásmu (`active`) a které
 * z deklarovaných kotev na stránce vůbec EXISTUJÍ (`present`). To druhé není
 * paranoia — plochy mají varianty a větve (reálná data vs. fallback), takže
 * deklarovaná kotva se občas nevykreslí; nabídnout na ni odkaz by znamenalo
 * poslat čtenáře do prázdna.
 *
 * Měří se až po vykreslení (requestAnimationFrame), ne synchronně v těle
 * efektu: při přechodu mezi routami nemusí být sekce v DOM hned, a setState
 * v těle efektu je navíc kaskádový render (react-hooks/set-state-in-effect).
 */

import { useEffect, useMemo, useState } from "react";

export interface SectionSpy {
  active: string | null;
  /** null = ještě neměřeno; do prvního callbacku se kreslí vše deklarované. */
  present: Set<string> | null;
}

export function useActiveSection(ids: string[]): SectionSpy {
  const [active, setActive] = useState<string | null>(null);
  const [present, setPresent] = useState<Set<string> | null>(null);

  // Pole identit se mění identitou pole při každém renderu rodiče — efekt
  // musí viset na obsahu, ne na referenci.
  const key = ids.join("|");

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const frame = requestAnimationFrame(() => {
      const list = key ? key.split("|") : [];
      const els = list
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      setPresent(new Set(els.map((el) => el.id)));
      setActive(null);
      if (els.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          // Aktivní je nejvýše položená sekce, která protíná čtecí pásmo;
          // dokud žádná neprotíná (mezi sekcemi), poslední volba drží.
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length > 0) setActive(visible[0].target.id);
        },
        // Čtecí pásmo je horní třetina okna — sekce se rozsvítí, když do ní
        // vjede nadpis, ne až když zabere celou obrazovku.
        { rootMargin: "-12% 0px -70% 0px", threshold: [0, 0.25, 1] },
      );
      els.forEach((el) => observer!.observe(el));
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [key]);

  return useMemo(() => ({ active, present }), [active, present]);
}
