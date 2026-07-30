import { headers } from "next/headers";
import { getRadarData } from "@/features/lawwatch/getRadarData";
import { radarFeedToJson } from "@/features/lawwatch/radarFeedCodecs";

/*
 * /zakony/kolize/feed.json — JSON Feed 1.1 podoba Kolizního radaru (moonshot
 * 4B). Stejná data, stejné guids jako RSS; parseEvidenceFeedJson (sdílený
 * validátor všech tří politicas feedů) payload ověří beze změny.
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
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
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
