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
import { dayAnchor, entityDayHref, FEED_ENTRIES, type DenikEntry } from "./deriveDenik";
import { pragueDayRfc3339 } from "./pragueDay";

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
  /**
   * Jedna věta o tom, co tenhle výpis NENESE — tmavá vrstva, useknuté čtení
   * (skládá `features/denik/feedNotes.ts`). Přilepuje se k popisu kanálu,
   * protože položka feedu je záznam o státu, ne o našem čtení: syntetická
   * položka „vrstva je tmavá" by v čtečce stála mezi datovanými fakty a
   * tvářila se jako jedno z nich. `null`/vynecháno = popis beze změny, takže
   * kanál, který upozornění nepočítá (schránka), serializuje bajt po bajtu
   * stejně jako dřív.
   */
  notice?: string | null;
}

export const DENIK_FEED_TITLE = "Deník republiky — Politicas";
export const DENIK_FEED_DESCRIPTION =
  "Chronologický denní záznam republiky: podepsané smlouvy, přikázání tisků výborům, vyhlášení ve Sbírce, zápisy a výmazy rejstříkových rolí a rozhodnutí lidské brány — každý záznam datovaný, citovaný a trvale odkazovatelný.";

/**
 * Popis kanálu deníku VČETNĚ STROPU (2026-08-12).
 *
 * Obě routy krájejí `slice(0, FEED_ENTRIES)` a popis o tom mlčel, takže
 * odběratel neměl jak poznat, že vidí výřez — položky se prostě přestaly
 * objevovat. Strop se navíc počítá po ZÁPISECH, ne po dnech: sto nejnovějších
 * zápisů je zpravidla míň dnů, než ukazuje plocha, takže feed není archiv a
 * věta musí říct, kde zbytek je. Číslo je dosazené z konstanty, která řez
 * opravdu dělá (precedens popisu kanálu schránky) — přepsané do věty by se
 * s kódem rozešlo první změnou stropu.
 */
export function denikFeedDescription(): string {
  return (
    `${DENIK_FEED_DESCRIPTION} ` +
    `Feed nese nejvýš ${FEED_ENTRIES} nejnovějších zápisů a řeže se po zápisech, ne po dnech — ` +
    `starší dny nese plocha /denik a trvalé kotvy dnů (#d-<datum>).`
  );
}

const entityQuery = (ctx: DenikFeedContext): string =>
  ctx.entityKey ? `?entita=${encodeURIComponent(ctx.entityKey)}` : "";

export function denikHomeUrl(ctx: DenikFeedContext): string {
  return ctx.channel?.homeUrl ?? `${ctx.baseUrl}/denik${entityQuery(ctx)}`;
}

export function denikFeedUrl(ctx: DenikFeedContext): string {
  return ctx.channel?.feedUrl ?? `${ctx.baseUrl}/denik/feed.json${entityQuery(ctx)}`;
}

const channelTitle = (ctx: DenikFeedContext): string => ctx.channel?.title ?? DENIK_FEED_TITLE;
const channelDescription = (ctx: DenikFeedContext): string => {
  const base = ctx.channel?.description ?? denikFeedDescription();
  return ctx.notice ? `${base} ${ctx.notice}` : base;
};
const itemUrl = (e: DenikFeedItem, ctx: DenikFeedContext): string =>
  ctx.channel?.entryUrl?.(e, ctx.baseUrl) ?? denikEntryUrl(ctx.baseUrl, e, ctx.entityKey);

/**
 * Trvalá adresa záznamu = kotva jeho dne (deník adresuje VYDÁNÍ, ne řádky).
 *
 * VE FILTROVANÉM FEEDU NESE ADRESA I FILTR (2026-08-12). Do téhle opravy
 * mířila každá položka na `/denik#d-<datum>`, tedy do NEFILTROVANÉ plochy —
 * jenže ta ukazuje posledních 30 dnů CELÉHO deníku, kdežto feed jedné entity
 * sahá o svých sto zápisů mnohem dál. U řídké entity tak položky od jistého
 * stáří ukazovaly na den, který cílová stránka vůbec nevykresluje: odkaz
 * vypadal správně a nikam nevedl. Adresu skládá `entityDayHref` — týž kodek,
 * jakým vede z brány do dne /dukazy, ne druhá šablona u nás.
 *
 * Den, ze kterého kotvu složit nejde, spadne zpátky na nefiltrovanou kotvu:
 * adresa s vymyšleným dnem by vypadala správně a nevedla nikam.
 */
export function denikEntryUrl(
  baseUrl: string,
  e: DenikFeedItem,
  entityKey?: string | null,
): string {
  if (entityKey) {
    const href = entityDayHref(entityKey, e.date);
    if (href !== null) return `${baseUrl}${href}`;
  }
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

/**
 * Razítko vydání položky — RFC 3339, jak JSON Feed 1.1 u `date_published`
 * VYŽADUJE. Do 2026-08-04 se emitoval holý `YYYY-MM-DD` (`e.date`), což RFC
 * 3339 není; sdílený validátor to nechytil, protože kontroluje jen `typeof
 * string` (Deník důkazů posílá plný ISO instant a formát tím splňoval).
 *
 * Řádek deníku nese DEN, ne okamžik — razítkem je proto PRAŽSKÁ PŮLNOC toho
 * dne i s posunem, který v ní platil (`2026-08-04T00:00:00+02:00`). Půlnoc UTC
 * by o pražském dni tvrdila něco jiného než plocha; a `pubDate` v RSS jde ze
 * stejného okamžiku, aby obě podoby feedu nedatovaly týž řádek jinam.
 * Neparsovatelný den → null a element se vynechá (nikdy odhad).
 */
export function denikEntryPublishedAt(e: DenikFeedItem): string | null {
  return pragueDayRfc3339(e.date);
}

export function denikFeedToRss(entries: readonly DenikFeedItem[], ctx: DenikFeedContext): string {
  const items = entries
    .map((e) => {
      const pub = rfc822(denikEntryPublishedAt(e) ?? "");
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
        // RFC 3339 (viz denikEntryPublishedAt). Nedatovatelný den → prázdný
        // řetězec: čtečka pozná chybějící datum, ale nikdy nedostane odhad.
        date_published: denikEntryPublishedAt(e) ?? "",
        authors: [{ name: e.source }],
      }),
    ),
  };
  return JSON.stringify(feed, null, 2);
}

// Validátor JSON podoby je záměrně SDÍLENÝ s Deníkem důkazů — jeden formát,
// jeden čtecí kód. Reexport, ať odběratel deníku nemusí znát dukazy modul.
export { parseEvidenceFeedJson };
