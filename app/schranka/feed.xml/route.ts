import { denikFeedToRss } from "@/features/denik/feedCodecs";
import { parseFollowKeys } from "@/features/schranka/followCodec";
import { schrankaFeedChannel, schrankaFeedEntries } from "@/features/schranka/feed";
import { feedSince, requestOrigin } from "@/features/schranka/feedRequest";
import { getSchrankaDeltas } from "@/features/schranka/getSchrankaDeltas";

/*
 * /schranka/feed.xml — RSS 2.0 podoba novinek sledovaných entit.
 *
 * ODBĚR JE ADRESA: `?e=<klíč>&e=<klíč>…` nese seznam sledovaných, `od=` práh
 * (bez něj okno první návštěvy). Klíče validuje a řeže TÁŽ stráž jako
 * novinky.json (parseFollowKeys), delty staví TENTÝŽ server-only modul
 * (getSchrankaDeltas) a serializuje TENTÝŽ kodek jako Deník republiky —
 * schránka dodává jen kanálová metadata. Nic se neukládá.
 *
 * Seznam klíčů se ze serverové telemetrie škrtá (sentry.server.config.ts →
 * features/schranka/telemetryScrub.ts); v adrese je záměrně, ve stopách ne.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = parseFollowKeys(url.searchParams.getAll("e"));
  const built = await getSchrankaDeltas(keys, feedSince(url.searchParams.get("od")));
  if (!built) {
    // Čestný stav „nečitelné, ne prázdné" — precedens /denik/feed.xml.
    return new Response("store unavailable", { status: 503 });
  }

  const baseUrl = await requestOrigin();
  const xml = denikFeedToRss(schrankaFeedEntries(built.deltas), {
    baseUrl,
    generatedAt: new Date().toISOString(),
    channel: schrankaFeedChannel({ baseUrl, keys, since: built.since, format: "xml" }),
  });
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
