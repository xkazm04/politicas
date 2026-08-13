/*
 * JEDNO ČTENÍ LIDSKÉ BRÁNY — sdílený odečet `review_audit` + labelů endpointů.
 *
 * Append-only log rozhodnutí revizora čtou DVA deníky: /dukazy (věstník brány,
 * který z něj sází každý řádek) a /denik (kde je rozhodnutí jednou ze skupin
 * dne). Do 2026-08-12 měl každý svůj vlastní odečet — týž dotaz se stropem
 * 10 000 a týž `getKgNodes` na jména obou konců vazby — a `getSchrankaDeltas`
 * spouští OBA loadery v jednom `Promise.all` na každý dotaz odběratele, takže
 * jedna schránková odpověď platila dvakrát za tentýž řádek. Dvě čtení jednoho
 * logu jsou navíc dvě místa, kde se dá zapomenout na strop.
 *
 * ČERSTVOST, NE MEMO OKNO. Vrstva se ZÁMĚRNĚ nememoizuje na `MONEY_MEMO_TTL_MS`
 * jako peněžní a legislativní čtení: rozhodnutí revizora se nesmí opozdit o
 * okno dávkových vrstev (hlavička getDenikData). Sdílení je proto dvojí a obojí
 * je omezené na JEDEN požadavek:
 *
 *   1. `cache()` — identita v rámci jednoho RSC požadavku.
 *   2. SDÍLENÍ ROZBĚHNUTÉHO ČTENÍ — volání, které přijde, dokud předchozí ještě
 *      běží, dostane TÝŽ slib. Tohle je to, co dedupuje dva loadery běžící
 *      souběžně (schránka), a je to jediná půlka, kterou je vidět mimo RSC:
 *      ZMĚŘENO 2026-08-12 — `react.cache()` bez React dispatcheru nededuplikuje
 *      vůbec (tři volání = tři průchody), takže test běžící v vitestu by na něm
 *      neověřil nic. Slib se zahazuje, jakmile doběhne, takže další požadavek
 *      čte znovu; žádné okno, žádná stará data.
 *
 * STROP SE PŘIZNÁVÁ. `listReviewAudit` má tvrdý strop 10 000 a repozitář u něj
 * sám varuje, že useknuté čtení „publikuje špatné číslo" — /dukazy i /denik
 * vypisují délku toho pole JAKO POČET rozhodnutí brány. Useknutí se proto
 * detekuje (délka === strop, táž heuristika jako `warnIfTruncated`), vrací se
 * jako `truncated` a obě plochy ho vysloví větou.
 */

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import type { ReviewAuditRow } from "@/lib/db/types";

/** Strop odečtu — tvrdý strop `listReviewAudit` (lib/db/pglite/repositories/review.ts). */
export const REVIEW_AUDIT_CAP = 10_000;

export interface ReviewAuditRead {
  rows: ReviewAuditRow[];
  /** id uzlu → label pro oba konce vazby. Obohacení: při selhání zůstane
   *  prázdná a plochy degradují na id uzlů, nikdy neumřou. */
  nodeLabels: Map<string, string>;
  /**
   * Podařilo se labely přečíst? PŘÍDAVNÉ POLE (2026-08-13): prázdná mapa má dvě
   * příčiny, které čtenář rozezná jen tehdy, když mu je plocha řekne — buď
   * nebylo co číst (žádné řádky), nebo čtení SELHALO a záznam pak jmenuje uzly
   * urnami (`psp:person:6543 ↔ kg:company:04544152`) bez jediného vysvětlení.
   * `true` i tehdy, když se nečetlo nic: neproběhlé čtení nic neztratilo.
   */
  labelsRead: boolean;
  /** Čtení vrátilo přesně strop → `rows.length` je SPODNÍ mez, ne počet. */
  truncated: boolean;
  cap: number;
}

async function readOnce(): Promise<ReviewAuditRead | null> {
  try {
    const store = await getStore();
    // null = záznam je NEČITELNÝ. Prázdný deník brány je `{ rows: [] }` — dvě
    // různé věci, které obě plochy vyslovují různě.
    if (!store) return null;

    const rows = await store.listReviewAudit({ limit: REVIEW_AUDIT_CAP });
    const truncated = rows.length >= REVIEW_AUDIT_CAP;
    if (truncated) {
      reportLoaderFailure(
        "readReviewAudit",
        new Error(
          `review_audit vrátil přesně strop ${REVIEW_AUDIT_CAP} řádků — publikovaný počet rozhodnutí je spodní mez`,
        ),
      );
    }

    const ids = [...new Set(rows.flatMap((r) => [r.src, r.dst]))];
    const nodeLabels = new Map<string, string>();
    // Nečetlo-li se nic, nic se neztratilo — degradace začíná až selháním.
    let labelsRead = true;
    if (ids.length > 0) {
      try {
        for (const n of await store.getKgNodes(ids)) nodeLabels.set(n.id, n.label);
      } catch (err) {
        labelsRead = false;
        reportLoaderFailure("readReviewAudit.getKgNodes", err);
      }
    }

    return { rows, nodeLabels, labelsRead, truncated, cap: REVIEW_AUDIT_CAP };
  } catch (err) {
    reportLoaderFailure("readReviewAudit", err);
    return null;
  }
}

let inFlight: Promise<ReviewAuditRead | null> | null = null;

/** Sdílený odečet brány. Viz hlavička: `cache()` drží identitu v požadavku,
 *  sdílený slib deduplikuje souběžné volající, a nic se nepřenáší do dalšího
 *  požadavku — brána musí být čerstvá. */
export const readReviewAudit = cache(async (): Promise<ReviewAuditRead | null> => {
  if (inFlight !== null) return inFlight;
  const p = readOnce().finally(() => {
    if (inFlight === p) inFlight = null;
  });
  inFlight = p;
  return p;
});
