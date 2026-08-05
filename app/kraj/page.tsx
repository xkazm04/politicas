import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import KrajPickerPage from "@/features/civicscore/KrajPickerPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { listKraje } from "@/features/civicscore/kraj";

/*
 * /kraj — rozcestník volebních karet (moonshot 5E). Tenká routa: odvodí výčet
 * krajů z reálného žebříčku (mandáty PSP10) a předá ho klientskému rozcestníku.
 * Null (store nedostupný) → poctivé upozornění, nikdy mock.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("krajTitle"),
    description: t("krajDescription"),
  };
}

export default async function KrajRozcestnikPage() {
  const data = await getLeaderboardListData();
  return <KrajPickerPage kraje={data ? listKraje(data.entries) : null} />;
}
