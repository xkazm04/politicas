import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/*
 * ROBOTS — the crawler-facing half of "internal" .
 *
 * The repo had no robots.ts at all, so every route was crawlable, including
 * `/penize/kontrola`: the human-review console (unlinked from the /penize header
 * in 211ced5, but still reachable from public pages — /dukazy and /penize/strety
 * point at it). It is not a publication — it is the queue of undecided ties, showing
 * reviewer notes and unreviewed analyst prose about named people, and its buttons write
 * to the audit chain. Having it turn up in a search result for a politician's name is a
 * different product from the one /penize documents.
 *
 * `/rentgen` is an archived art direction and already declares `robots: { index: false }`
 * on its own page; `/admin` is an operator tool behind a gate and declares the same. A
 * per-page directive and a Disallow line do different jobs (one stops indexing after the
 * fetch, the other asks for no fetch), so both are stated — and stating them here means
 * one file answers "what is not public" for the whole app.
 *
 * This is a crawler REQUEST, not access control — exactly the caveat
 * `app/admin/accessGate.ts` already spells out. Nothing here protects anything; the
 * console's write path is gated by REVIEWER_TOKEN, and it always will be.
 */
/**
 * The paths this app asks crawlers not to fetch. Exported because `app/sitemap.ts`
 * MUST exclude exactly these — a sitemap that advertises a Disallow-ed path is two
 * files disagreeing about what is public, and the disagreement is invisible until a
 * crawler acts on it. One declaration, two readers.
 */
export const DISALLOWED_PATHS = ["/penize/kontrola", "/rentgen", "/admin"] as const;

/*
 * SITEMAPA (2026-08-13). Tenhle soubor a `app/sitemap.ts` vznikly jako dvojice —
 * sitemapa si odsud importuje `DISALLOWED_PATHS`, aby jedno místo rozhodovalo,
 * co je veřejné — jenže robots.txt adresu sitemapy NEVYPISOVAL. Robots.txt je
 * standardní místo, kde ji crawler hledá bez toho, aby se ji musel dohadovat;
 * bez řádku `Sitemap:` čekala celá evidenční polovina platformy na náhodný
 * proklik přesně tak, jak to popisuje hlavička sitemapy.
 *
 * ZÁKLAD ADRESY se čte z hlaviček requestu — týž precedens jako `app/sitemap.ts`
 * a všechny čtyři feedy: v dev čestně localhost, v nasazení skutečný host,
 * NIKDY vymyšlená doména. Řádek `Sitemap:` přitom musí být ABSOLUTNÍ URL; bez
 * hostitele se proto nevypíše vůbec, místo aby se doména uhodla. Čtení hlaviček
 * dělá z robots.txt dynamickou routu — stejně jako u sitemapy, a ze stejného
 * důvodu.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    ...(host ? { sitemap: `${proto}://${host}/sitemap.xml` } : {}),
  };
}
