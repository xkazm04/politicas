import { headers } from "next/headers";
import { getRadarData } from "@/features/lawwatch/getRadarData";
import { radarFeedToRss } from "@/features/lawwatch/radarFeedCodecs";

/*
 * /zakony/kolize/feed.xml — RSS 2.0 podoba Kolizního radaru (moonshot 4B).
 * Tenká skořápka nad čistým kodekem (radarFeedCodecs.ts); guids a permalinky
 * (`politicas:radar:<id>`, `#r-<id>`) jsou veřejné API. Základ URL se čte
 * z request hlaviček (precedens /dukazy): v dev čestně localhost, v nasazení
 * reálný host — nikdy vymyšlená doména.
 */

export const dynamic = "force-dynamic";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export async function GET(): Promise<Response> {
  const data = await getRadarData();
  if (!data) {
    // Úložiště i archiv nedostupné: 503, ne prázdný feed — prázdno by bylo
    // nepravdivé tvrzení „žádné nálezy neexistují".
    return new Response("store unavailable", { status: 503 });
  }
  const xml = radarFeedToRss(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
  });
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
