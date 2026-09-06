import { requestOrigin } from "@/features/denik/feedRequest";
import { getRadarData } from "@/features/lawwatch/getRadarData";
import { radarFeedToJson } from "@/features/lawwatch/radarFeedCodecs";

/*
 * /zakony/kolize/feed.json — JSON Feed 1.1 podoba Kolizního radaru (moonshot
 * 4B). Stejná data, stejné guids jako RSS; parseEvidenceFeedJson (sdílený
 * validátor všech tří politicas feedů) payload ověří beze změny.
 */

export const dynamic = "force-dynamic";

// Základ URL skládá JEDNA definice všech feedů (features/denik/feedRequest.ts →
// lib/routing/liveUrl.ts); do 2026-09-07 tu stála vlastní kopie.

export async function GET(): Promise<Response> {
  const data = await getRadarData();
  if (!data) {
    // 503 s `no-store` (parita s /dukazy, 2026-09-05): výpadek se nesmí
    // uložit do cache jako odpověď feedu.
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const json = radarFeedToJson(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
  });
  return new Response(json, {
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
