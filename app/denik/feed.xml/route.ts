import { deriveDenikEntries, filterDenikEntries, FEED_ENTRIES } from "@/features/denik/deriveDenik";
import { denikFeedToRss } from "@/features/denik/feedCodecs";
import { denikFeedNotice } from "@/features/denik/feedNotes";
import {
  FEED_CACHE_CONTROL,
  INVALID_ENTITY_KEY_MESSAGE,
  readFeedEntityKey,
  requestOrigin,
} from "@/features/denik/feedRequest";
import { getDenikData } from "@/features/denik/getDenikData";

/*
 * /denik/feed.xml — RSS 2.0 podoba Deníku republiky (moonshot 3A). Stejná
 * data a guids jako JSON podoba; `?entita=<klíč>` filtruje — URL je odběr.
 */

export const dynamic = "force-dynamic";

const textError = (message: string, status: number): Response =>
  new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET(request: Request): Promise<Response> {
  // Tvar klíče se posuzuje PŘED čtením úložiště: je to vada adresy, ne dat.
  const parsed = readFeedEntityKey(request);
  if ("invalid" in parsed) return textError(INVALID_ENTITY_KEY_MESSAGE, 400);
  const entityKey = parsed.key;

  const data = await getDenikData();
  if (!data) return textError("store unavailable", 503);

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
    // Tmavá vrstva je jinak v čtečce k nerozeznání od klidného týdne.
    notice: denikFeedNotice(data.coverage, data.limits),
  });
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": FEED_CACHE_CONTROL,
    },
  });
}
