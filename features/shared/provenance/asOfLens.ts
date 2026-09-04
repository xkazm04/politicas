/*
 * ČOČKA „K TOMU DNI" — čisté pravidlo pro `?k=YYYY-MM-DD` nad účtenkou i branou.
 *
 * Adresa tvrzení je /zdroj/<ref>; `k` je ČOČKA nad ní: „ukaž mi ten záznam tak,
 * jak jsme ho toho dne zveřejnili". Modul je čistý (žádný store, žádný DOM),
 * takže obě plochy — účtenka a brána — čtou TOTÉŽ pravidlo a nemůžou se
 * rozejít v tom, co je platný den a jaký okamžik z něj plyne.
 *
 * TŘI PRAVIDLA, KTERÁ TENHLE MODUL DRŽÍ
 *
 * 1. ADRESA SE NEOPRAVUJE. `k=2026-13-45`, `k=včera`, `k=2026-9-1` — nic z toho
 *    není den. Parser vrací null a plocha to ŘEKNE; nikdy nedosadí nejbližší
 *    platné datum ani mlčky nespadne na dnešek vydávaný za tehdejšek.
 *    (Táž disciplína jako decodeClaimRef: nerozluštitelná adresa není tvrzení.)
 *
 * 2. DEN KONČÍ VEČER. Čtenář, který cituje 3. srpna, viděl to, co jsme toho dne
 *    zveřejnili — tedy POSLEDNÍ verzi platnou v ten den, ne verzi z půlnoci.
 *    Okamžik dne je proto jeho konec (23:59:59.999 UTC), ne začátek.
 *
 * 3. „NEVÍME" NENÍ „NEZMĚNILO SE". Bitemporální migrace orazítkovala všechny
 *    předmigrační řádky JEDINÝM `recorded_at`; před tou epochou o žádném dni nic
 *    nevíme. Stav `beforeEpoch` je proto vlastní odpověď, ne hodnota — plocha
 *    vysází „záznam k tomu dni neexistuje" a žádné číslo. Stejně tak
 *    `absentThen` (tehdy jsme záznamy vedli a tenhle mezi nimi nebyl) je jiná
 *    věta než `beforeEpoch`, a musí i jinak znít.
 */

import type { ProvenanceReceipt } from "./receipt";

/**
 * Poslední verze, kterou store o jedné adrese kdy zapsal — doklad o HISTORII,
 * ne tvrzení. Tvar žije tady (čistý modul), ne v server-only loaderu: sází ho
 * klientská ReceiptPage a `no-server-import-in-client` zakazuje i typový import
 * z `get*` modulu.
 */
export interface ReceiptLastVersion {
  receipt: ProvenanceReceipt;
  /** ISO okamžik, kdy tenhle obsah vznikl. */
  recordedAt: string;
  /** ISO okamžik nahrazení; null = verze je pořád otevřená. */
  supersededAt: string | null;
}

/** Přesně `YYYY-MM-DD`; nic jiného. */
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Platný ISO den, nebo null. Kontroluje se i to, že datum EXISTUJE:
 * `2026-02-31` projde regulárním výrazem, ale kalendář ho nezná, a
 * `new Date()` by ho tiše posunul na 3. března — přesně ta oprava, kterou
 * tenhle modul odmítá dělat.
 */
export function parseAsOfDay(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const day = raw.trim();
  if (!ISO_DAY_RE.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Zpětný převod odhalí přetečení (2026-02-31 → 2026-03-03).
  return parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** Okamžik, ke kterému se den čte: jeho KONEC (pravidlo 2 výše). */
export const asOfInstant = (day: string): string => `${day}T23:59:59.999Z`;

/**
 * Co plocha o čočce sází. Jeden tvar pro účtenku i pro bránu.
 *
 * - `live`        — nikdo se na žádný den neptal; účtenka je dnešní záznam.
 * - `refused`     — `k` nebyl ISO den. Sází se dnešní záznam, VÝSLOVNĚ označený
 *                   za dnešní, plus přiznání, co bylo odmítnuto (`raw`).
 * - `beforeEpoch` — den leží před nejstarším záznamovým časem, který store nese.
 * - `absentThen`  — záznamy jsme tehdy vedli, tohle tvrzení mezi nimi nebylo.
 * - `at`          — účtenka JE verze platná k tomu dni.
 */
export type ReceiptAsOf =
  | { state: "live" }
  | { state: "refused"; raw: string }
  | { state: "beforeEpoch"; day: string; epoch: string | null }
  | { state: "absentThen"; day: string }
  | { state: "at"; day: string };

export const LIVE_AS_OF: ReceiptAsOf = { state: "live" };

/**
 * Je to, co plocha sází, historická verze? Jen `at` ano — u zbylých tří stavů
 * je na obrazovce DNEŠNÍ záznam a sazba to musí říct, jinak čtenář odejde
 * s dojmem, že takhle to tehdy vypadalo.
 */
export const showsHistoricalVersion = (asOf: ReceiptAsOf): boolean => asOf.state === "at";

/** Klíč do katalogu `shared.receipt.asOf.*` pro banner nad obsahem. */
export const asOfBannerKey = (asOf: ReceiptAsOf): string | null =>
  asOf.state === "live" ? null : `receipt.asOf.${asOf.state}`;
