import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import KrajPage from "@/features/civicscore/KrajPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { krajSlate, listKraje } from "@/features/civicscore/kraj";

/*
 * /kraj/[kraj] — volební karta kraje (moonshot 5E): trvalý odkaz na kandidátku
 * poslanců jednoho kraje (slug bez diakritiky, viz krajSlug). Tenká routa:
 * ověří slug proti krajům odvozeným z reálného grafu, ořeže vstupy archu
 * (datum, živá URL) a vše ostatní žije ve features/civicscore/KrajPage.
 *
 * Neznámý slug = skutečná 404 (kraj neexistuje); nedostupný store = poctivé
 * DataUnavailable (HTTP 200) — kraj existuje, databáze byla jen zaneprázdněná.
 *
 * Copy česky přímo zde (messages/*.json mimo plochu — precedens batch 1D).
 */

/** Živá URL karty z request hlaviček — na patičce archu nesmí být vymyšlená
 *  doména; v dev čestně stojí localhost, v nasazení reálný host. */
async function liveKrajUrl(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/kraj/${slug}` : `/kraj/${slug}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kraj: string }>;
}): Promise<Metadata> {
  const { kraj } = await params;
  const data = await getLeaderboardListData();
  const slate = data ? krajSlate(data.entries, kraj) : null;
  if (!slate) return { title: "Můj kraj — volební karta · Politicas" };
  return {
    title: `${slate.label} — volební karta · Politicas`,
    description: `Kandidátka poslanců (${slate.rows.length}): ${slate.label}. Index přispění z veřejných dat psp.cz, se zdrojem a datem, připravená k tisku.`,
  };
}

export default async function KrajKartaPage({ params }: { params: Promise<{ kraj: string }> }) {
  const { kraj } = await params;
  const data = await getLeaderboardListData();
  if (!data) {
    return <DataUnavailable what="volební karta kraje" backHref="/kraj" backLabel="zpět na rozcestník krajů" />;
  }

  // Slug je platný jen pro kraj, který v žebříčku skutečně existuje.
  if (!listKraje(data.entries).some((k) => k.slug === kraj)) notFound();

  return (
    <KrajPage
      data={data}
      slug={kraj}
      // Datum, ke kterému čísla platí = den vykreslení ze živého grafu.
      retrievedAt={new Date().toISOString().slice(0, 10)}
      liveUrl={await liveKrajUrl(kraj)}
    />
  );
}
