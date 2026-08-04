import type { MetadataRoute } from "next";

/*
 * ROBOTS — the crawler-facing half of "internal" .
 *
 * The repo had no robots.ts at all, so every route was crawlable, including
 * `/penize/kontrola`: the human-review console, which is LINKED IN PUBLIC from the
 * /penize header. It is not a publication — it is the queue of undecided ties, showing
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
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/penize/kontrola", "/rentgen", "/admin"],
      },
    ],
  };
}
