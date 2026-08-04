/*
 * Z UZLU VÝŘEZU NA VEŘEJNOU ADRESU ENTITY — čistá funkce, žádné I/O.
 *
 * Velín byl ostrov: kreslil reálné poslance, firmy a tisky, ale nevedl z nich
 * ANI JEDEN odkaz do deníku (`/denik?entita=`), do schránky (sledování) ani na
 * spis firmy. Přitom je to táž entita s týmž veřejným klíčem — deník, schránka
 * i feedy schránky adresují `poslanec:<pspId>` · `firma:<ičo>` · `tisk:<č>`.
 *
 * ── PROČ TENHLE MODUL EXISTUJE ──────────────────────────────────────────────
 * Uzly výřezu nesou id ve tvaru `p:<pspId>` / `c:<ičo>` / `m:<ičo>` / `b:<č>`
 * (viz ./stateSlice.ts). Překlad na klíč entity je tedy PRAVIDLO, ne řetězcová
 * úprava někde v JSX — a jako pravidlo se testuje. Klíče staví výhradně
 * `features/denik/deriveDenik.ts` (mpEntityKey / companyEntityKey /
 * billEntityKey); tenhle soubor si je NIKDY nepíše sám, jinak by druhá kopie
 * mlčky rozpojila deník od schránky při první změně tvaru klíče.
 *
 * ── CO SE ZÁMĚRNĚ NEPŘEKLÁDÁ ────────────────────────────────────────────────
 * Strana (`y:`), zákon (`l:`) a hlasování (`v:`) klíč NEDOSTANOU. Žádný stream
 * není klíčovaný stranou ani předpisem, takže nabídnout „sledovat" nebo „deník
 * této entity" by slibovalo doručení, které nikdo neumí splnit — přesně důvod,
 * proč schránka stáhla klíč `obec:` (CLAUDE.md, /schranka).
 *
 * ── A CO VZORKOVÝ GRAF ──────────────────────────────────────────────────────
 * `buildStateGraph()` používá tytéž prefixy nad SMYŠLENÝMI identifikátory
 * (`c:<index vazby>`). Odkaz na `/penize/firma/3` nebo sledování smyšleného
 * poslance by byla fabrikace, proto plocha tyhle afordance nabízí jen tehdy,
 * když kreslí REÁLNÝ výřez (`rule !== null`). Tvar id se tu navíc ověřuje:
 * IČO musí být osmimístné, pspId a číslo tisku celé kladné číslo.
 */

import { billEntityKey, companyEntityKey, dayAnchor, mpEntityKey } from "@/features/denik/deriveDenik";
import { isEntityKey } from "@/features/schranka/followCodec";

const ICO_RE = /^\d{8}$/;
const NUM_RE = /^\d+$/;

/**
 * Veřejný klíč entity pro uzel REÁLNÉHO výřezu, nebo null.
 *
 * null znamená „tahle entita nemá veřejný proud" (strana, zákon, hlasování)
 * NEBO „id nemá tvar, který by šlo bezpečně přeložit" (vzorkový graf). Nikdy se
 * nedosazuje náhradní klíč.
 */
export function sliceNodeEntityKey(nodeId: string): string | null {
  const sep = nodeId.indexOf(":");
  if (sep < 0) return null;
  const prefix = nodeId.slice(0, sep);
  const raw = nodeId.slice(sep + 1);
  if (raw.length === 0) return null;

  let key: string | null = null;
  if (prefix === "p") key = NUM_RE.test(raw) ? mpEntityKey(Number(raw)) : null;
  // Uzel peněz i uzel firmy jsou tatáž firma — peníze jsou jen její pruh v obrázku.
  else if (prefix === "c" || prefix === "m") key = ICO_RE.test(raw) ? companyEntityKey(raw) : null;
  else if (prefix === "b") key = NUM_RE.test(raw) ? billEntityKey(Number(raw)) : null;

  // Poslední pojistka: klíč, který schránka neumí přečíst, se nenabízí vůbec.
  return key !== null && isEntityKey(key) ? key : null;
}

/** Adresa filtru deníku pro klíč entity — táž adresa, kterou schránka odebírá. */
export const denikEntityHref = (entityKey: string): string =>
  `/denik?entita=${encodeURIComponent(entityKey)}`;

/**
 * Adresa deníku i s kotvou dne, na kterém fakt stojí (`d-<YYYY-MM-DD>`, viz
 * `dayAnchor` v deníku). Kotva je NÁPOVĚDA, ne tvrzení: deník ukazuje posledních
 * `DAYS_SHOWN` dní, takže starší den v něm být nemusí — prohlížeč pak prostě
 * otevře začátek seznamu a nic nepředstírá.
 */
export function denikFactHref(entityKey: string, date: string | null): string {
  const base = denikEntityHref(entityKey);
  // Kotvu staví deník sám (`dayAnchor`) — druhý tvar téže kotvy by se rozešel.
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${base}#${dayAnchor(date)}` : base;
}

/** Spis firmy — junction uzel grafu; jen pro uzel firmy/peněz s platným IČO. */
export function companyCaseFileHref(nodeId: string): string | null {
  const sep = nodeId.indexOf(":");
  if (sep < 0) return null;
  const prefix = nodeId.slice(0, sep);
  const raw = nodeId.slice(sep + 1);
  if (prefix !== "c" && prefix !== "m") return null;
  return ICO_RE.test(raw) ? `/penize/firma/${raw}` : null;
}
