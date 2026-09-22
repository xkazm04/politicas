import { requestOrigin } from "@/features/denik/feedRequest";
import { getRadarData } from "@/features/lawwatch/getRadarData";
import { radarFeedToRss } from "@/features/lawwatch/radarFeedCodecs";

/*
 * /zakony/kolize/feed.xml — RSS 2.0 podoba Kolizního radaru (moonshot 4B).
 * Tenká skořápka nad čistým kodekem (radarFeedCodecs.ts); guids a permalinky
 * (`politicas:radar:<id>`, `#r-<id>`) jsou veřejné API. Základ URL se čte
 * z request hlaviček TÝMŽ `requestOrigin` jako /denik a /dukazy
 * (features/denik/feedRequest.ts): v dev čestně localhost, v nasazení reálný
 * host — nikdy vymyšlená doména. Do 2026-09-07 tu stála vlastní kopie.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const data = await getRadarData();
  if (!data) {
    // Úložiště i archiv nedostupné: 503, ne prázdný feed — prázdno by bylo
    // nepravdivé tvrzení „žádné nálezy neexistují".
    // 503 s `no-store` (parita s /dukazy, 2026-09-05): výpadek se nesmí
    // uložit do cache jako odpověď feedu.
    return new Response("store unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
  const xml = radarFeedToRss(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
  });
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
