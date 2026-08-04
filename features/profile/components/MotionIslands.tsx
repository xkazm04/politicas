"use client";

/*
 * Dva jediné kusy spisu, které opravdu potřebují klienta kvůli POHYBU.
 *
 * Spis byl celý `"use client"`, takže každý řádek smlouvy, název tisku i celá
 * kariérní páteř putovaly do RSC flightu jako props — kvůli dvěma animacím a
 * jednomu rozbalovacímu tlačítku. Tyhle dva ostrůvky ten pohyb izolují:
 * `HeaderReveal` dostává potomky jako `children` (RSC je vykreslí na serveru a
 * jen je do ostrůvku vloží — NEserializují se jako props), `ComponentBar` bere
 * tři čísla.
 *
 * Obojí ctí `useReducedMotion` (WCAG 2.3.3) — stejné pravidlo, jaké stránka
 * dodržovala už předtím, jen teď je na jednom místě.
 */

import { motion, useReducedMotion } from "framer-motion";

/** Vjezd hlavičky spisu. Potomci jsou serverový strom vložený přes `children`. */
export function HeaderReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Výplň sloupce jedné složky indexu. `pct` je už useknuté na 0–100. */
export function ComponentBar({ pct, color, opacity }: { pct: number; color?: string; opacity?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="mt-3 h-2 w-full bg-hairline">
      <motion.div
        className="h-full"
        style={{ background: color, opacity }}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.6 }}
      />
    </div>
  );
}
