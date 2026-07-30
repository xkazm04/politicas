import type { Metadata } from "next";
import KrajPickerPage from "@/features/civicscore/KrajPickerPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { listKraje } from "@/features/civicscore/kraj";

/*
 * /kraj — rozcestník volebních karet (moonshot 5E). Tenká routa: odvodí výčet
 * krajů z reálného žebříčku (mandáty PSP10) a předá ho klientskému rozcestníku.
 * Null (store nedostupný) → poctivé upozornění, nikdy mock.
 *
 * Copy česky přímo zde (messages/*.json mimo plochu — precedens batch 1D).
 */

export const metadata: Metadata = {
  title: "Můj kraj — volební karta · Politicas",
  description:
    "Vyberte kraj a dostanete kandidátku jeho poslanců: index přispění, složky, odznaky — se zdrojem a datem, připravenou k tisku.",
};

export default async function KrajRozcestnikPage() {
  const data = await getLeaderboardListData();
  return <KrajPickerPage kraje={data ? listKraje(data.entries) : null} />;
}
