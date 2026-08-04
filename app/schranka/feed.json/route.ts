import { denikFeedToJson } from "@/features/denik/feedCodecs";
import { parseFollowKeys } from "@/features/schranka/followCodec";
import { schrankaFeedChannel, schrankaFeedEntries } from "@/features/schranka/feed";
import { feedSince, requestOrigin } from "@/features/schranka/feedRequest";
import { getSchrankaDeltas } from "@/features/schranka/getSchrankaDeltas";

/*
 * /schranka/feed.json — JSON Feed 1.1 podoba novinek sledovaných entit.
 * Týž tvar jako oba deníky, takže `parseEvidenceFeedJson` je veřejným
 * validátorem i tohohle payloadu. Zbytek pravidel viz feed.xml.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = parseFollowKeys(url.searchParams.getAll("e"));
  const built = await getSchrankaDeltas(keys, feedSince(url.searchParams.get("od")));
  if (!built) {
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const baseUrl = await requestOrigin();
  const json = denikFeedToJson(schrankaFeedEntries(built.deltas), {
    baseUrl,
    generatedAt: new Date().toISOString(),
    channel: schrankaFeedChannel({ baseUrl, keys, since: built.since, format: "json" }),
  });
  return new Response(json, {
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
