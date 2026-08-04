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

/**
 * Co serializér z jednoho záznamu SKUTEČNĚ potřebuje. `DenikEntry` to splňuje;
 * jiný kanál nad týmž formátem (Občanská schránka) tak nemusí dopisovat pole,
 * která jeho řádky nemají — dřív by musel vymyslet `kind` a `entities`, tedy
 * dvě nepravdy jen kvůli tvaru typu.
 */
export type DenikFeedItem = Pick<DenikEntry, "id" | "date" | "titleCs" | "pending" | "source"> &
  Partial<Pick<DenikEntry, "internalHref">>;

/**
 * Přepis KANÁLU — jiný deník nad TÝMŽ serializérem (Občanská schránka, vlna 2).
 *
 * Schránka publikuje vlastní feed delt sledovaných entit. Kdyby si na to
 * napsala vlastní serializér, měl by repo dva RSS/JSON kodeky pro jeden formát
 * a jeden z nich by časem zaostal (escapování, pubDate, tvar položky). Kanálová
 * metadata jsou proto parametr; TĚLO položky, escapování i round-trip validátor
 * zůstávají jedny. Bez `channel` se nic nemění — deník serializuje přesně jako
 * dřív (přibíjí feedCodecs.test.ts).
 */
export interface DenikFeedChannel {
  title: string;
  description: string;
  /** Domovská adresa kanálu (u schránky nese celý seznam sledovaných). */
  homeUrl: string;
  /** Adresa feedu samotného. */
  feedUrl: string;
  /** Prefix guidu; default `politicas:denik`. Jiný kanál = jiný prefix, aby
   *  guid netvrdil původ, který řádek nemá (přepočet indexu v deníku není). */
  guidPrefix?: string;
  /** Trvalá adresa položky; default je kotva dne deníku. */
  entryUrl?: (e: DenikFeedItem, baseUrl: string) => string;
}

export interface DenikFeedContext {
  /** Origin bez lomítka na konci — např. "https://politicas.cz". */
  baseUrl: string;
  /** ISO timestamp vygenerování (injektuje se kvůli determinismu). */
  generatedAt: string;
  /** Klíč sledované entity, je-li feed filtrovaný (propíše se do adres). */
  entityKey?: string | null;
  /** Metadata jiného kanálu nad týmž serializérem (viz DenikFeedChannel). */
  channel?: DenikFeedChannel;
}

export const DENIK_FEED_TITLE = "Deník republiky — Politicas";
export const DENIK_FEED_DESCRIPTION =
  "Chronologický denní záznam republiky: podepsané smlouvy, přikázání tisků výborům, vyhlášení ve Sbírce, zápisy a výmazy rejstříkových rolí a rozhodnutí lidské brány — každý záznam datovaný, citovaný a trvale odkazovatelný.";

const entityQuery = (ctx: DenikFeedContext): string =>
  ctx.entityKey ? `?entita=${encodeURIComponent(ctx.entityKey)}` : "";

export function denikHomeUrl(ctx: DenikFeedContext): string {
  return ctx.channel?.homeUrl ?? `${ctx.baseUrl}/denik${entityQuery(ctx)}`;
}

export function denikFeedUrl(ctx: DenikFeedContext): string {
  return ctx.channel?.feedUrl ?? `${ctx.baseUrl}/denik/feed.json${entityQuery(ctx)}`;
}

const channelTitle = (ctx: DenikFeedContext): string => ctx.channel?.title ?? DENIK_FEED_TITLE;
const channelDescription = (ctx: DenikFeedContext): string =>
  ctx.channel?.description ?? DENIK_FEED_DESCRIPTION;
const itemUrl = (e: DenikFeedItem, ctx: DenikFeedContext): string =>
  ctx.channel?.entryUrl?.(e, ctx.baseUrl) ?? denikEntryUrl(ctx.baseUrl, e);

/** Trvalá adresa záznamu = kotva jeho dne (deník adresuje VYDÁNÍ, ne řádky). */
export function denikEntryUrl(baseUrl: string, e: DenikFeedItem): string {
  return `${baseUrl}/denik#${dayAnchor(e.date)}`;
}

export function denikEntryGuid(e: DenikFeedItem, prefix = "politicas:denik"): string {
  return `${prefix}:${e.id}`;
}

/** Jednořádkové tělo záznamu, sdílené oběma formáty — brankovaná věta + zdroj. */
export function denikEntrySummaryCs(e: DenikFeedItem): string {
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

export function denikFeedToRss(entries: readonly DenikFeedItem[], ctx: DenikFeedContext): string {
  const items = entries
    .map((e) => {
      const pub = rfc822(e.date);
      return [
        "    <item>",
        `      <guid isPermaLink="false">${escapeXml(denikEntryGuid(e, ctx.channel?.guidPrefix))}</guid>`,
        `      <link>${escapeXml(itemUrl(e, ctx))}</link>`,
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
    `    <title>${escapeXml(channelTitle(ctx))}</title>`,
    `    <link>${escapeXml(denikHomeUrl(ctx))}</link>`,
    `    <description>${escapeXml(channelDescription(ctx))}</description>`,
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
export function denikFeedToJson(entries: readonly DenikFeedItem[], ctx: DenikFeedContext): string {
  const feed: EvidenceFeedJson = {
    version: "https://jsonfeed.org/version/1.1",
    title: channelTitle(ctx),
    home_page_url: denikHomeUrl(ctx),
    feed_url: denikFeedUrl(ctx),
    description: channelDescription(ctx),
    language: "cs",
    items: entries.map(
      (e): EvidenceFeedJsonItem => ({
        id: denikEntryGuid(e, ctx.channel?.guidPrefix),
        url: itemUrl(e, ctx),
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
