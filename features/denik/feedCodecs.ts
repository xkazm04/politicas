// Deník republiky — strojové podoby (RSS 2.0 + JSON Feed 1.1), moonshot 3A.
//
// Znovupoužívá kodek Deníku důkazů (features/dukazy/feedCodecs.ts, read-only):
// JSON strana emituje PŘESNĚ tvar `EvidenceFeedJson` a round-trip se ověřuje
// jeho veřejným validátorem `parseEvidenceFeedJson` — odběratel obou deníků
// tak čte jeden formát jedním čtecím kódem. Kanálová metadata jsou vlastní
// (jiný deník, jiná adresa), guids `politicas:denik:<id>` s isPermaLink=false
// a každá url míří na kotvu dne `/denik#d-<date>` (batch-3 konvence kotev).
//
// URL JE ODBĚR: filtr entity (`?entita=<klíč>`) se propisuje do home_page_url
// i feed_url, takže odběr „sleduj tuhle entitu" je jen jiná adresa téhož feedu
// — žádné účty, žádný stav na serveru.

import {
  parseEvidenceFeedJson,
  type EvidenceFeedJson,
  type EvidenceFeedJsonItem,
} from "@/features/dukazy/feedCodecs";
import { dayAnchor, type DenikEntry } from "./deriveDenik";

export interface DenikFeedContext {
  /** Origin bez lomítka na konci — např. "https://politicas.cz". */
  baseUrl: string;
  /** ISO timestamp vygenerování (injektuje se kvůli determinismu). */
  generatedAt: string;
  /** Klíč sledované entity, je-li feed filtrovaný (propíše se do adres). */
  entityKey?: string | null;
}

export const DENIK_FEED_TITLE = "Deník republiky — Politicas";
export const DENIK_FEED_DESCRIPTION =
  "Chronologický denní záznam republiky: podepsané smlouvy, přikázání tisků výborům, vyhlášení ve Sbírce, zápisy a výmazy rejstříkových rolí a rozhodnutí lidské brány — každý záznam datovaný, citovaný a trvale odkazovatelný.";

const entityQuery = (ctx: DenikFeedContext): string =>
  ctx.entityKey ? `?entita=${encodeURIComponent(ctx.entityKey)}` : "";

export function denikHomeUrl(ctx: DenikFeedContext): string {
  return `${ctx.baseUrl}/denik${entityQuery(ctx)}`;
}

export function denikFeedUrl(ctx: DenikFeedContext): string {
  return `${ctx.baseUrl}/denik/feed.json${entityQuery(ctx)}`;
}

/** Trvalá adresa záznamu = kotva jeho dne (deník adresuje VYDÁNÍ, ne řádky). */
export function denikEntryUrl(baseUrl: string, e: DenikEntry): string {
  return `${baseUrl}/denik#${dayAnchor(e.date)}`;
}

export function denikEntryGuid(e: DenikEntry): string {
  return `politicas:denik:${e.id}`;
}

/** Jednořádkové tělo záznamu, sdílené oběma formáty — brankovaná věta + zdroj. */
export function denikEntrySummaryCs(e: DenikEntry): string {
  const pending = e.pending ? " Vazba čeká na lidskou kontrolu." : "";
  return `${e.titleCs}.${pending} Zdroj: ${e.source}.`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC-822 datum pro RSS `pubDate`; null když se timestamp neparsuje
 *  (element se pak vynechá, nikdy nepublikuje špatně) — zrcadlí dukazy kodek. */
function rfc822(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toUTCString() : null;
}

export function denikFeedToRss(entries: readonly DenikEntry[], ctx: DenikFeedContext): string {
  const items = entries
    .map((e) => {
      const pub = rfc822(e.date);
      return [
        "    <item>",
        `      <guid isPermaLink="false">${escapeXml(denikEntryGuid(e))}</guid>`,
        `      <link>${escapeXml(denikEntryUrl(ctx.baseUrl, e))}</link>`,
        `      <title>${escapeXml(e.titleCs)}</title>`,
        ...(pub ? [`      <pubDate>${pub}</pubDate>`] : []),
        `      <description>${escapeXml(denikEntrySummaryCs(e))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const build = rfc822(ctx.generatedAt);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `  <channel>`,
    `    <title>${escapeXml(DENIK_FEED_TITLE)}</title>`,
    `    <link>${escapeXml(denikHomeUrl(ctx))}</link>`,
    `    <description>${escapeXml(DENIK_FEED_DESCRIPTION)}</description>`,
    `    <language>cs</language>`,
    ...(build ? [`    <lastBuildDate>${build}</lastBuildDate>`] : []),
    items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

/**
 * JSON Feed 1.1 — týž tvar (`EvidenceFeedJson`) jako Deník důkazů, takže
 * `parseEvidenceFeedJson` z features/dukazy je i validátorem TOHOHLE feedu
 * (round-trip přibíjí test). `authors` nese zdrojový registr záznamu — deník
 * nemá revizora u každého řádku, ale autor záznamu je vždy jeho registr.
 */
export function denikFeedToJson(entries: readonly DenikEntry[], ctx: DenikFeedContext): string {
  const feed: EvidenceFeedJson = {
    version: "https://jsonfeed.org/version/1.1",
    title: DENIK_FEED_TITLE,
    home_page_url: denikHomeUrl(ctx),
    feed_url: denikFeedUrl(ctx),
    description: DENIK_FEED_DESCRIPTION,
    language: "cs",
    items: entries.map(
      (e): EvidenceFeedJsonItem => ({
        id: denikEntryGuid(e),
        url: denikEntryUrl(ctx.baseUrl, e),
        title: e.titleCs,
        content_text: denikEntrySummaryCs(e),
        date_published: e.date,
        authors: [{ name: e.source }],
      }),
    ),
  };
  return JSON.stringify(feed, null, 2);
}

// Validátor JSON podoby je záměrně SDÍLENÝ s Deníkem důkazů — jeden formát,
// jeden čtecí kód. Reexport, ať odběratel deníku nemusí znát dukazy modul.
export { parseEvidenceFeedJson };
