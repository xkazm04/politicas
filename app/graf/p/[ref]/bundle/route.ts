import { getPermalinkData } from "@/features/graph/getPermalinkData";
import { toEvidenceJsonLd } from "@/features/graph/permalink";

/**
 * /graf/p/[ref]/bundle — balíček důkazů citace ke stažení (JSON-LD).
 *
 * Týž objekt, který stránka vkládá do <script type="application/ld+json">,
 * jen jako samostatný soubor: fact-check nástroj nebo redakční archiv si
 * tvrzení (včetně stavu lidské kontroly každé hrany) přečte bez parsování
 * HTML. Jen čtení, žádný zápis; stavová disciplína kopíruje stránku:
 * invalid → 404, gone → 410, nedostupný sklad → 503 (výpadek není „neexistuje").
 */
export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const result = await getPermalinkData(ref);
  if (result.status === "invalid") {
    return new Response(null, { status: 404 });
  }
  if (result.status === "gone") {
    return new Response(null, { status: 410 });
  }
  if (result.status === "unavailable") {
    return new Response(null, { status: 503, headers: { "retry-after": "600" } });
  }
  return Response.json(toEvidenceJsonLd(result.view), {
    headers: {
      "content-type": "application/ld+json; charset=utf-8",
      // Graf se mění dávkou; denní cache kopíruje revalidate stránky.
      "cache-control": "public, max-age=86400",
    },
  });
}
