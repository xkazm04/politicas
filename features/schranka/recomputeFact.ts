/*
 * Občanská schránka — PŘEPOČET INDEXU jako delta (moonshot 7A, vlna 2).
 *
 * „Poslancův index přispění byl přepočten" je nejsdělitelnější změna, kterou
 * graf o poslanci nese — a schránka ji do vlny 1 neuměla říct, protože deník
 * ji nevede (deník staví na smlouvách, rolích, krocích tisků a bráně).
 * Uzly osob přitom nesou `contribution_provenance = {pass, ref, computedAt}`.
 *
 * ── CO SE TU ZÁMĚRNĚ NEDĚLÁ ────────────────────────────────────────────────
 * `computedAt` je JEDEN sdílený okamžik celého průchodu a graf NEUCHOVÁVÁ
 * předchozí hodnoty skóre. Poctivá delta je proto JEDEN řádek na sledovaného
 * poslance — „index přepočten (průchod N)" s datem průchodu — a NIKDY věta
 * „skóre se změnilo o X". Velikost změny je neznámá; dopočítat ji odhadem by
 * bylo přesně to vymyšlené číslo, které tenhle produkt nepublikuje.
 *
 * ── KDY ŘÁDEK NEVZNIKNE ────────────────────────────────────────────────────
 * Jen když sněmovna nese JEDEN `{pass, ref, computedAt}`. Půlka uzlů na starém
 * průchodu (rozbitý zápis) není jeden fakt, ale dva — a schránka by pak
 * datovala poslance průchodem, který ho možná nepřepočítal. Nejednotný stav se
 * proto nehlásí jako delta vůbec a plocha to přizná v pravidlech.
 *
 * Čistý modul (žádné I/O) — čtení uzlů dělá getRecomputeFact.ts.
 */

import { summarizeContributionProvenance } from "@/features/civicscore/provenance";
import type { DeltaEntry } from "./deriveDeltas";

/** Jednotný přepočet indexu, jak ho graf o sobě tvrdí. */
export interface RecomputeFact {
  /** `YYYY-MM-DD` — den `contribution_provenance.computedAt`. */
  computedAt: string;
  /** Číslo průchodu grafu. */
  pass: number;
  /** Ref vzorce (`contribution_provenance.ref`). */
  ref: string;
  /** Kolik uzlů osob ten `{pass, ref, computedAt}` nese. */
  covered: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fakt o přepočtu z props uzlů osob — nebo null, když sněmovna nedrží JEDEN
 * `{pass, ref, computedAt}`.
 *
 * JEDEN AGREGÁTOR, ne půldruhého. Jednotnost `{pass, ref}` sem odjakživa
 * počítal `summarizeContributionProvenance` (features/civicscore/provenance.ts)
 * — tentýž agregát, kterým o svém původu mluví /zebricek, /poslanec a
 * /metodika — a `computedAt` si tenhle modul dopočítával sám, protože ho tehdy
 * agregát nesledoval. Od 2026-08-11 ho nese (`ContributionProvenance
 * .computedAt`) a jeho vlastní hlavička říká, že se nemá znovu odvozovat: laťka
 * je ZÁMĚRNĚ táž přísná, jakou držel tenhle soubor — jeden průchod, jeden den,
 * a ani jeden hodnocený uzel bez razítka.
 *
 * Selhává se ZAVŘENĚ: cokoli jiného než jednotný stav s dnem znamená, že se
 * řádek o přepočtu nehlásí vůbec. Datovat poslance průchodem, který ho možná
 * nepřepočítal, je táž chyba jako číst průchod z prvního uzlu.
 */
export function recomputeFactFromProps(
  personProps: readonly Record<string, unknown>[],
): RecomputeFact | null {
  const prov = summarizeContributionProvenance(personProps);
  if (prov.state !== "uniform" || prov.pass === null || prov.ref === null) return null;
  if (prov.computedAt === null || !DAY_RE.test(prov.computedAt)) return null;

  return { computedAt: prov.computedAt, pass: prov.pass, ref: prov.ref, covered: prov.covered };
}

/** Klíč sledování je poslanec? Přepočet indexu se týká JEN jich. */
export function isPoslanecKey(key: string): boolean {
  return key.startsWith("poslanec:");
}

/**
 * Řádek delty za přepočet indexu — nebo null, když se přepočet do okna
 * čtenáře nevešel, fakt není jednotný nebo klíč není poslanec.
 *
 * `id` je deterministické z průchodu a klíče: dvě sestavení téže delty jsou
 * byte-identická a řádek se v seznamu nezdvojí.
 */
export function recomputeDelta(
  fact: RecomputeFact | null,
  key: string,
  since: string,
): DeltaEntry | null {
  if (fact === null || !isPoslanecKey(key)) return null;
  if (!DAY_RE.test(fact.computedAt) || fact.computedAt < since) return null;
  return {
    id: `recompute:${fact.pass}:${key}`,
    date: fact.computedAt,
    kind: "recompute",
    // Věta netvrdí NIC o velikosti změny — graf předchozí hodnoty nedrží.
    // `titleCs`/`source` zůstávají doslovná čeština (feedy jsou jednojazyčné
    // artefakty a čtou je dál); dvojjazyčná plocha sází `titleKey`/`sourceKey`
    // z katalogu `schranka.*` (precedens features/overeni/verdict.ts — čistý
    // modul vrací klíče, plocha překládá).
    titleCs: `Index přispění přepočten pro celou sněmovnu — průchod ${fact.pass}; o kolik se skóre pohnulo, záznam neříká`,
    titleKey: "schranka.delta.recomputeTitle",
    titleParams: { pass: fact.pass },
    pending: false,
    // Přepočet je čas ZÁZNAMU (kdy jsme počítali), ne čas světa.
    timeBasis: "zaznamenano",
    source: `výpočet politicas — ${fact.ref}`,
    sourceKey: "schranka.delta.recomputeSource",
    sourceParams: { ref: fact.ref },
    tone: "cobalt",
    // Metodika je jediná stránka, která ten vzorec vysvětluje.
    internalHref: "/metodika",
  };
}
