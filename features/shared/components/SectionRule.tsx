"use client";

/**
 * @catalog Červená linka, která se dokreslí při scrollu — pravítko sekce.
 *
 * Jednorázová entry animace (scaleX 0→1, once), gated přes viewport.
 * Sutnarovský podpis vítězné výtvarné řeči.
 *
 * PREFERENCI „MÉNĚ POHYBU" SI VYŽÁDÁ (2026-08-12). Tohle je nejrozšířenější
 * pohyblivá komponenta v repu — montuje se 65× na dvaceti stranách — a jako
 * jediná ho ignorovala: `features/landing/motion.test.ts` prohledával jen
 * `features/landing/**`, takže pravítko preferenci obcházelo hranicí složky.
 * Při `prefers-reduced-motion` se vysadí rovnou na cílový stav (`initial={false}`
 * + nulová délka), tedy statická linka — ne skrytá linka.
 */

import { motion, useReducedMotion } from "framer-motion";

export default function SectionRule({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      initial={reduceMotion ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
      className={`h-1.5 origin-left bg-signal ${className}`}
    />
  );
}
