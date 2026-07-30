// Kolizní radar — strojové podoby (RSS 2.0 + JSON Feed 1.1), moonshot 4B.
//
// Znovupoužívá kodek Deníku důkazů (features/dukazy/feedCodecs.ts, read-only,
// batch-3 §14 pravidlo): JSON strana emituje PŘESNĚ tvar `EvidenceFeedJson`
// a round-trip se ověřuje jeho veřejným validátorem `parseEvidenceFeedJson`
// — odběratel všech tří deníků (důkazy, republika, radar) čte jeden formát
// jedním čtecím kódem. Guids jsou `politicas:radar:<id>` s isPermaLink=false
// a každá url míří na kotvu nálezu `/zakony/kolize#r-<id>`.
//
// Nedatované záznamy (case-① příznaky) NEMAJÍ pubDate/date_published —
// element se poctivě vynechá (RSS) nebo nese prázdný řetězec (JSON), nikdy
// se datum nevymýšlí; pravidlo řazení je popsané v popisu kanálu.

import {
  parseEvidenceFeedJson,
  type EvidenceFeedJson,
  type EvidenceFeedJsonItem,
} from "@/features/dukazy/feedCodecs";
import type { RadarEntry } from "./deriveRadar";

export interface RadarFeedContext {
  /** Origin bez lomítka na konci — např. "https://politicas.cz". */
  baseUrl: string;
  /** ISO timestamp vygenerování (injektuje se kvůli determinismu). */
  generatedAt: string;
}

export const RADAR_FEED_TITLE = "Kolizní radar — Politicas";
export const RADAR_FEED_DESCRIPTION =
  "Chronologická kniha nálezů legislativního procesu: kolize souběžně projednávaných tisků nad týmž § " +
  "(datované okamžikem zápisu do archivu analýzy) a odvozené příznaky střetu u předkladatelů " +
  "(bez data detekce, řazené podle čísla tisku, vyžadují lidské ověření). " +
  "Nálezy procesu, nikdy obvinění.";

export function radarEntryUrl(baseUrl: string, e: RadarEntry): string {
  return `${baseUrl}/zakony/kolize#${e.anchor}`;
}

export function radarEntryGuid(e: RadarEntry): string {
  return `politicas:radar:${e.id}`;
}

/** Jednořádkové tělo záznamu, sdílené oběma formáty — brankovaná věta + zdroj. */
export function radarEntrySummaryCs(e: RadarEntry): string {
  return `${e.detailCs} ${e.sourceCs}.`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC-822 datum pro RSS `pubDate`; null když timestamp chybí nebo se
 *  neparsuje (element se pak vynechá, nikdy nepublikuje špatně). */
function rfc822(iso: string | null): string | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toUTCString() : null;
}

export function radarFeedToRss(entries: readonly RadarEntry[], ctx: RadarFeedContext): string {
  const items = entries
    .map((e) => {
      const pub = rfc822(e.detectedAt);
      return [
        "    <item>",
        `      <guid isPermaLink="false">${escapeXml(radarEntryGuid(e))}</guid>`,
        `      <link>${escapeXml(radarEntryUrl(ctx.baseUrl, e))}</link>`,
        `      <title>${escapeXml(e.titleCs)}</title>`,
        ...(pub ? [`      <pubDate>${pub}</pubDate>`] : []),
        `      <description>${escapeXml(radarEntrySummaryCs(e))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const build = rfc822(ctx.generatedAt);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `  <channel>`,
    `    <title>${escapeXml(RADAR_FEED_TITLE)}</title>`,
    `    <link>${escapeXml(`${ctx.baseUrl}/zakony/kolize`)}</link>`,
    `    <description>${escapeXml(RADAR_FEED_DESCRIPTION)}</description>`,
    `    <language>cs</language>`,
    ...(build ? [`    <lastBuildDate>${build}</lastBuildDate>`] : []),
    items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

/**
 * JSON Feed 1.1 — týž tvar (`EvidenceFeedJson`) jako Deník důkazů a Deník
 * republiky, takže `parseEvidenceFeedJson` je i validátorem TOHOHLE feedu
 * (round-trip přibíjí test). `authors` nese case-pipeline nálezu.
 */
export function radarFeedToJson(entries: readonly RadarEntry[], ctx: RadarFeedContext): string {
  const feed: EvidenceFeedJson = {
    version: "https://jsonfeed.org/version/1.1",
    title: RADAR_FEED_TITLE,
    home_page_url: `${ctx.baseUrl}/zakony/kolize`,
    feed_url: `${ctx.baseUrl}/zakony/kolize/feed.json`,
    description: RADAR_FEED_DESCRIPTION,
    language: "cs",
    items: entries.map(
      (e): EvidenceFeedJsonItem => ({
        id: radarEntryGuid(e),
        url: radarEntryUrl(ctx.baseUrl, e),
        title: e.titleCs,
        content_text: radarEntrySummaryCs(e),
        date_published: e.detectedAt ?? "",
        authors: [{ name: e.authorCs }],
      }),
    ),
  };
  return JSON.stringify(feed, null, 2);
}

// Validátor JSON podoby je záměrně SDÍLENÝ s oběma deníky — jeden formát,
// jeden čtecí kód. Reexport, ať odběratel radaru nemusí znát dukazy modul.
export { parseEvidenceFeedJson };
