import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import StretyPage from "@/features/money/collisions/StretyPage";
import { getCollisionCandidates } from "@/features/money/collisions/getCollisionCandidates";

/** Kandidáti stojí na DÁVKOVÉM artefaktu (peněžní vrstva grafu + hlasovací
 *  ledger PSP10), který se mění přepočtem, ne za běhu požadavku — stejné okno
 *  jako `/penize/firma/[ico]` a /dashboard, aby dvě plochy nad týmž grafem
 *  nemohly být rozdílně staré. Next čte `revalidate` staticky, takže je to
 *  literál; hodnotu drží `DASHBOARD_REVALIDATE_SECONDS`. Co dnes stáří opravdu
 *  omezuje, je memo v loaderu (MONEY_MEMO_TTL_MS) — celá aplikace je dynamická
 *  kvůli locale cookie (viz features/dashboard/freshness.ts). */
export const revalidate = 86_400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("stretyTitle"),
    description: t("stretyDescription"),
  };
}

export default async function StretyRoute() {
  // Žádné review-řádky, žádná materializace: join se odvozuje ze živého grafu a
  // drží se jen memoizovaný VÝSLEDEK (getCollisionCandidates) — null, když
  // datová vrstva není dostupná.
  const data = await getCollisionCandidates();
  return <StretyPage data={data} />;
}
