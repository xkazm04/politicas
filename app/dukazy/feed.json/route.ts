import { headers } from "next/headers";
import { getDukazyData } from "@/features/dukazy/getDukazyData";
import { evidenceFeedToJson } from "@/features/dukazy/feedCodecs";
import { dukazyFeedNotice } from "@/features/dukazy/feedNotes";

/*
 * /dukazy/feed.json — JSON Feed 1.1 podoba Deníku důkazů (batch 2C). Stejná
 * data, stejné guids jako RSS; parseEvidenceFeedJson ve feedCodecs.ts je
 * veřejný validátor, kterým si odběratel může payload ověřit.
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
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
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
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
