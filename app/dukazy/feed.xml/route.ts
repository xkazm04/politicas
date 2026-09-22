import { FEED_CACHE_CONTROL, requestOrigin } from "@/features/denik/feedRequest";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { evidenceFeedToRss } from "@/features/dukazy/feedCodecs";
import { dukazyFeedNotice } from "@/features/dukazy/feedNotes";

/*
 * /dukazy/feed.xml — RSS 2.0 podoba Deníku důkazů (batch 2C). Tenká skořápka
 * nad čistým kodekem (feedCodecs.ts); guids a permalinky jsou veřejné API.
 * Základ URL se čte z request hlaviček TÝMŽ `requestOrigin` jako /denik/feed.*
 * (features/denik/feedRequest.ts) — do 2026-09-05 tu byla vlastní kopie: v dev
 * čestně localhost, v nasazení reálný host — nikdy vymyšlená doména.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const data = await getDukazyData();
  if (!data) {
    // Úložiště nedostupné: 503, ne prázdný feed — prázdno by bylo nepravdivé
    // tvrzení „žádná rozhodnutí neexistují". `no-store` jako u sourozenců
    // (c210d19 to dalo /schranka a /denik; věstník zůstal bez hlavičky, takže
    // sdílená cache mohla „store unavailable" držet). Pinuje feedRoutes.test.ts.
    return new Response("store unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  // Strop odečtu i to, co z výpisu vypadlo, jde do POPISU KANÁLU — obojí se tu
  // do 2026-08-13 počítalo a zahazovalo, zatímco popis tvrdil „každé rozhodnutí".
  const xml = evidenceFeedToRss(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
    auditCap: data.limits.auditCap,
    notice: dukazyFeedNotice(data.limits),
  });
  return new Response(xml, {
    // Táž politika cache jako /denik/feed.* — do 2026-09-08 tu 200 nenesla
    // žádnou hlavičku, takže si každá cache vybírala vlastní chování.
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": FEED_CACHE_CONTROL },
  });
}
