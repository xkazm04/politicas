import type { NextRequest } from "next/server";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { LENS_PARAM } from "@/features/civicscore/lens";
import { buildEmbedHtml } from "@/features/landing/referendum/embed";

/*
 * /embed/zebricek — vestavný widget žebříčku (moonshot 7B). Route handler
 * MIMO React strom (žádný AppShell, žádný skript, žádná hydratace): vrací
 * hotový samostatný HTML dokument z čistého builderu
 * features/landing/referendum/embed.ts. `?vahy=` nese čtenářovu čočku (týž
 * kodek jako /zebricek); neplatný vektor → 400 s poctivou chybovou kartou.
 *
 * Hlavičky: frame-ancestors * (widget JE na vkládání — to je jeho smysl;
 * neběží v něm žádný skript ani přihlášený stav, takže clickjacking nemá co
 * ukrást), noindex (odvozená plocha — kanonický obsah je /zebricek),
 * krátká CDN cache.
 */

export async function GET(req: NextRequest) {
  const rawVahy = req.nextUrl.searchParams.get(LENS_PARAM);
  const data = await getLeaderboardListData();
  const { html, status } = buildEmbedHtml({
    data,
    rawVahy,
    origin: req.nextUrl.origin,
    generatedAt: new Date().toISOString(),
  });
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *",
      "x-robots-tag": "noindex",
      "cache-control": status === 200 ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store",
    },
  });
}
