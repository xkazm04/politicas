// Server-only: ŽIVÁ adresa účtenky pro návod na /overeni.
//
// Návod zve čtenáře „zkopírujte tenhle tvar a vložte ho sem" — a příklad
// /zdroj/… byl do 2026-08-04 postavený z vymyšlených id („osoba-priklad",
// „firma-priklad"), takže zkopírovaný z <pre> vracel „Neznámý odkaz.".
// Zaručený slepý konec v jediném místě plochy, které o kopírování prosí.
//
// PROČ SE ADRESA BERE ZE STORE A NEPŘIPÍNÁ SE NATVRDO: příklad zapsaný do
// zdrojáku je tvrzení o obsahu grafu, které nic nedrží — hrana zmizí při
// příštím přepočtu a návod zase lže, aniž by cokoli spadlo (v repozitáři není
// žádná testovací sada nad živým grafem, která by to chytila). Odvození za
// běhu je naopak sebedoložené: adresa se skládá z hrany, kterou jsme PRÁVĚ
// přečetli, takže buď existuje, nebo příklad není a plocha ukáže ilustrační
// tvar OZNAČENÝ jako ilustrační.
//
// Výběr je NEUTRÁLNÍ a vytištěný v poznámce pod příkladem: první hrana
// `linked_to` v pořadí grafu (src, rel, dst vzestupně) — pořadí registru,
// žádná míra. Jakékoli řazení podle peněz či podezřelosti by z návodu udělalo
// obvinění konkrétní firmy.

import "server-only";
import { cache } from "react";
import { byListOrder } from "@/lib/db/kgOrder";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import { edgeClaimRef } from "@/features/shared/provenance/claimRef";

/** Relace příkladu — lidskou branou procházející vazba, tedy přesně ten druh
 *  záznamu, u kterého na verdiktu záleží nejvíc. */
const EXAMPLE_REL = "linked_to";

export interface GuideZdrojExample {
  /** Segment adresy /zdroj/<ref>. */
  ref: string;
  src: string;
  rel: string;
  dst: string;
}

export const getGuideExample = cache(async function getGuideExample(): Promise<GuideZdrojExample | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const edges = await store.listKgEdges({ rel: EXAMPLE_REL, limit: KG_READ_CAP });
    // kgNeighbours/listKgEdges pořadí není totální — sjednotíme ho explicitně,
    // aby příklad byl mezi sestaveními týž (memory/kgneighbours-weight-order…).
    const first = [...edges].sort(byListOrder)[0];
    if (!first) return null;
    return {
      ref: edgeClaimRef(first.src, first.rel, first.dst),
      src: first.src,
      rel: first.rel,
      dst: first.dst,
    };
  } catch (err) {
    reportLoaderFailure("overeni/getGuideExample", err);
    return null;
  }
});
