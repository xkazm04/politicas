import { headers } from "next/headers";
import { deriveDenikEntries, filterDenikEntries, FEED_ENTRIES } from "@/features/denik/deriveDenik";
import { denikFeedToRss } from "@/features/denik/feedCodecs";
import { getDenikData } from "@/features/denik/getDenikData";

/*
 * /denik/feed.xml — RSS 2.0 podoba Deníku republiky (moonshot 3A). Stejná
 * data a guids jako JSON podoba; `?entita=<klíč>` filtruje — URL je odběr.
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
    return new Response("store unavailable", { status: 503 });
  }
  const entityKey = new URL(request.url).searchParams.get("entita");
  const { entries } = deriveDenikEntries({
    contracts: data.contracts,
    roles: data.roles,
    bills: data.bills,
    reviews: data.reviews,
    changes: data.changes,
    today: data.builtOn,
  });
  const scoped = entityKey ? filterDenikEntries(entries, entityKey) : entries;
  const xml = denikFeedToRss(scoped.slice(0, FEED_ENTRIES), {
    baseUrl: await requestOrigin(),
    generatedAt: new Date().toISOString(),
    entityKey,
  });
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
