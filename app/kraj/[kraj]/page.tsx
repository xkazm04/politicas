import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import KrajPage from "@/features/civicscore/KrajPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { krajSlate, listKraje } from "@/features/civicscore/kraj";
import { liveUrl } from "@/lib/routing/liveUrl";

/*
 * /kraj/[kraj] — volební karta kraje (moonshot 5E): trvalý odkaz na kandidátku
 * poslanců jednoho kraje (slug bez diakritiky, viz krajSlug). Tenká routa:
 * ověří slug proti krajům odvozeným z reálného grafu, složí živou URL archu
 * z request hlaviček a vše ostatní žije ve features/civicscore/KrajPage.
 *
 * Neznámý slug = skutečná 404 (kraj neexistuje); nedostupný store = poctivé
 * DataUnavailable (HTTP 200) — kraj existuje, databáze byla jen zaneprázdněná.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kraj: string }>;
}): Promise<Metadata> {
  const { kraj } = await params;
  const t = await getTranslations("meta");
  const data = await getLeaderboardListData();
  const slate = data ? krajSlate(data.entries, kraj) : null;
  if (!slate) return { title: t("krajTitle") };
  return {
    title: t("krajCardTitle", { kraj: slate.label }),
    description: t("krajCardDescription", { count: slate.rows.length, kraj: slate.label }),
  };
}

export default async function KrajKartaPage({ params }: { params: Promise<{ kraj: string }> }) {
  const { kraj } = await params;
  const data = await getLeaderboardListData();
  if (!data) {
    const t = await getTranslations("civicscore");
    return <DataUnavailable what={t("krajUnavailableWhat")} backHref="/kraj" backLabel={t("krajBackToPicker")} />;
  }

  // Slug je platný jen pro kraj, který v žebříčku skutečně existuje.
  if (!listKraje(data.entries).some((k) => k.slug === kraj)) notFound();

  // Den, ke kterému čísla platí, routa NEPODÁVÁ: do 2026-08-12 tu stálo
  // `new Date()`, tedy okamžik vykreslení, a vytištěný arch tím datoval sám
  // sebe místo dat pod sebou. Datum si karta bere z komorového agregátu
  // provenience, který je součástí `data` (viz KrajPage) — jeden zdroj dne,
  // žádný prop, kterým by šel dnešek propašovat zpátky.
  // Živá URL karty z request hlaviček (lib/routing/liveUrl.ts) — na patičce archu
  // nesmí být vymyšlená doména; v dev čestně stojí localhost, v nasazení reálný host.
  return <KrajPage data={data} slug={kraj} liveUrl={await liveUrl(`/kraj/${kraj}`)} />;
}
