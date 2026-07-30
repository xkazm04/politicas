import { headers } from "next/headers";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { evidenceFeedToRss } from "@/features/dukazy/feedCodecs";

/*
 * /dukazy/feed.xml — RSS 2.0 podoba Deníku důkazů (batch 2C). Tenká skořápka
 * nad čistým kodekem (feedCodecs.ts); guids a permalinky jsou veřejné API.
 * Základ URL se čte z request hlaviček (precedens /plakat): v dev čestně
 * localhost, v nasazení reálný host — nikdy vymyšlená doména.
 */

export const dynamic = "force-dynamic";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export async function GET(): Promise<Response> {
  const data = await getDukazyData();
  if (!data) {
    // Úložiště nedostupné: 503, ne prázdný feed — prázdno by bylo nepravdivé
    // tvrzení „žádná rozhodnutí neexistují".
    return new Response("store unavailable", { status: 503 });
  }
  const xml = evidenceFeedToRss(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
  });
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
