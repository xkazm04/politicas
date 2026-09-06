import { FEED_CACHE_CONTROL, requestOrigin } from "@/features/denik/feedRequest";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { evidenceFeedToJson } from "@/features/dukazy/feedCodecs";
import { dukazyFeedNotice } from "@/features/dukazy/feedNotes";

/*
 * /dukazy/feed.json — JSON Feed 1.1 podoba Deníku důkazů (batch 2C). Stejná
 * data, stejné guids jako RSS; parseEvidenceFeedJson ve feedCodecs.ts je
 * veřejný validátor, kterým si odběratel může payload ověřit.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const data = await getDukazyData();
  if (!data) {
    // Viz feed.xml: 503 s `no-store`, sdílený `requestOrigin` (2026-09-05).
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  // Viz feed.xml: strop a přiznané ztráty patří do popisu kanálu, ne do položek.
  const json = evidenceFeedToJson(data.entries, {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
    auditCap: data.limits.auditCap,
    notice: dukazyFeedNotice(data.limits),
  });
  return new Response(json, {
    // Táž politika cache jako /denik/feed.* — do 2026-09-08 tu 200 nenesla
    // žádnou hlavičku, takže si každá cache vybírala vlastní chování.
    headers: { "content-type": "application/feed+json; charset=utf-8", "cache-control": FEED_CACHE_CONTROL },
  });
}
