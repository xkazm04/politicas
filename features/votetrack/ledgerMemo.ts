/**
 * JEDNA politika memoizace pro obě plochy nad hlasovacím záznamem.
 *
 * ── Proč vůbec ──────────────────────────────────────────────────────────────
 * `listVoteBallots` vrací ~406 000 řádků a čte se **15 758 / 15 987 / 15 984 ms**
 * (změřeno na živém store, tři kola — čísla drží features/profile/getRebellionRecord.ts
 * a nejsou tu opsaná jako odhad). `react.cache()` má rozsah JEDNOHO požadavku, takže
 * /hlasovani i /kompas ten šestnáctisekundový průchod platily znovu na každé načtení.
 * Graf je přitom DÁVKOVÝ artefakt: mění se přepočtem, ne za běhu požadavku.
 *
 * ── Co se memoizuje a co ne ─────────────────────────────────────────────────
 * Memoizuje se ODVOZENÝ výsledek (VoteRecordData / KompasData) — kompaktní objekt
 * řádu stovek kB — nikdy syrové hlasy: držet 406 000 řádků 24 h v paměti procesu je
 * cena, kterou tahle úspora nevykupuje. Dedupli­kaci čtení UVNITŘ jednoho požadavku
 * řeší `react.cache()` v ledgerRead.ts, napříč požadavky tenhle memo.
 *
 * ── Disciplína (celý smysl tohohle modulu) ──────────────────────────────────
 *  • `null` (selhání / prázdný store / záznam pod prahem připravenosti) se
 *    NEMEMOIZUJE — jinak by jeden výpadek PGlite zmrazil „hlasování nejsou" na den.
 *  • Prázdný výsledek se NEMEMOIZUJE (`usable`) — prázdno je k nerozeznání od
 *    nenaingestovaného záznamu a zmrazit ho znamená publikovat sněmovnu bez hlasování.
 *  • Prahy připravenosti (EVENT_FLOOR / BALLOT_FLOOR) běží v ledgerRead.ts PŘED
 *    zápisem do mema, takže polovičně naingestovaný záznam se nikdy nezapamatuje.
 *  • Okno je `MONEY_MEMO_TTL_MS` — IMPORTOVANÉ, nikdy nepředeklarované: dvě mema nad
 *    jedním grafem na dvou hodinách jsou přesně to, jak dvě plochy začnou tisknout
 *    dvě různá vydání jednoho čísla.
 *
 * Modul je ČISTÝ (žádné `server-only`, žádný store), takže se ta disciplína dá
 * otestovat bez PGlite — viz ledgerMemo.test.ts.
 */

import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";

export interface LedgerMemo<T> {
  /** Platná hodnota, nebo `null` (nic uloženo / okno vypršelo). */
  read(now?: number): T | null;
  /** Uloží hodnotu, POKUD není `null` a projde `usable`. */
  write(value: T | null, now?: number): void;
  /** Testovací šev — aplikace ho nikdy nevolá (vzor `resetSuppliesMemo`). */
  reset(): void;
}

export function createLedgerMemo<T>(opts: {
  /** Je tenhle výsledek hodný zapamatování? Prázdno nikdy není. */
  usable: (value: T) => boolean;
  /** Výchozí okno je sdílená mez peněžní vrstvy; přepis jen pro testy. */
  ttlMs?: number;
}): LedgerMemo<T> {
  const ttlMs = opts.ttlMs ?? MONEY_MEMO_TTL_MS;
  let cell: { at: number; value: T } | null = null;

  return {
    read(now = Date.now()): T | null {
      if (cell === null) return null;
      if (now - cell.at >= ttlMs) {
        cell = null;
        return null;
      }
      return cell.value;
    },
    write(value: T | null, now = Date.now()): void {
      if (value === null) return;
      if (!opts.usable(value)) return;
      cell = { at: now, value };
    },
    reset(): void {
      cell = null;
    },
  };
}
