import { getAtlasReport } from "@/features/atlas/getAtlasData";

/*
 * /atlas/atlas.json — strojově čitelný atlas kvality (batch 6D). Týž report,
 * ze kterého se sází stránka /atlas: per-zdroj skóre všech čtyř dimenzí,
 * podklady, poctivá „nehodnoceno“ a KOMPLETNÍ metodika (vytištěná pravidla,
 * kadence, slovník čerstvosti) — skóre se nevydává bez pravidla ani strojově.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await getAtlasReport();
  if (!report) {
    // An outage is never cacheable: the rule the feed routes adopted in c210d19,
    // reached these endpoints on 2026-09-06.
    return new Response(JSON.stringify({ error: "store unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "600" },
    });
  }
  return new Response(JSON.stringify(report, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
