import { headers } from "next/headers";
import { deriveDenikEntries, filterDenikEntries, FEED_ENTRIES } from "@/features/denik/deriveDenik";
import { denikFeedToJson } from "@/features/denik/feedCodecs";
import { getDenikData } from "@/features/denik/getDenikData";

/*
 * /denik/feed.json — JSON Feed 1.1 podoba Deníku republiky (moonshot 3A).
 * Týž tvar jako Deník důkazů: `parseEvidenceFeedJson` (features/dukazy)
 * je veřejný validátor i pro tenhle payload. `?entita=<klíč>` filtruje —
 * URL je odběr.
 */

export const dynamic = "force-dynamic";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export async function GET(request: Request): Promise<Response> {
  const data = await getDenikData();
  if (!data) {
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const entityKey = new URL(request.url).searchParams.get("entita");
  const { entries } = deriveDenikEntries({
    contracts: data.contracts,
    roles: data.roles,
    bills: data.bills,
    reviews: data.reviews,
    today: data.builtOn,
  });
  const scoped = entityKey ? filterDenikEntries(entries, entityKey) : entries;
  const json = denikFeedToJson(scoped.slice(0, FEED_ENTRIES), {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
    entityKey,
  });
  return new Response(json, {
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
