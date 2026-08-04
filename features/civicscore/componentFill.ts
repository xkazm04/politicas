/*
 * Barva jedné složky příspěvkového indexu — jedna definice pro všechny plochy.
 *
 * Žila v `components/LeaderboardTable.tsx`, což je `"use client"` modul. Dokud
 * ji četly jen klientské plochy, nevadilo to; od 2026-08-04 je ale /poslanec
 * SERVEROVÝ strom a hodnotový import z klientského modulu do serverové
 * komponenty je přesně ta hrana, na které Next vydává klientskou referenci
 * místo objektu. Mapa proto stojí ve vlastním, neutrálním modulu — importují ji
 * obě strany a `LeaderboardTable` ji re-exportuje, aby žádný volající nemusel
 * měnit adresu.
 *
 * Jen tokeny palety (custom/no-hardcoded-colors). Šest složek, pět tokenů →
 * leadership sdílí odstín s účastí, odlišen průhledností.
 */

import { COBALT, INK, OCHRE, SIGNAL, STEEL } from "@/features/landing/palette";

export const COMPONENT_FILL: Record<string, { color: string; opacity?: number }> = {
  participation: { color: COBALT },
  committee: { color: SIGNAL },
  legislative: { color: OCHRE },
  speech: { color: INK },
  attendance: { color: STEEL },
  leadership: { color: COBALT, opacity: 0.5 },
};
