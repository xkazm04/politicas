import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import KompasPage from "@/features/votetrack/kompas/KompasPage";
import { getKompas } from "@/features/votetrack/getKompas";

/*
 * /kompas — Volební kompas naruby (moonshot 5B). Tenká routa: server načte
 * reálný záznam (getKompas: výběr otázek zveřejněným pravidlem + poziční
 * záznam vybraných hlasování) a předá klientovi; shoda se počítá u čtenáře
 * a celý výsledek žije v adrese (?hlasy=…).
 *
 * DVA různé neúspěchy, dvě různé věty (2026-08-11): `null` znamená VÝPADEK —
 * hlasovací nebo tematická vrstva se nepřečetla — a jen ten vykresluje
 * DataUnavailable. Výběr, který nad přečteným záznamem poctivě nevybral ani
 * jednu otázku, vrací záznam s prázdnými otázkami a vlastní větu si vykreslí
 * KompasPage; do 2026-08-11 obojí končilo stejnou hláškou o nedostupnosti dat,
 * tedy tvrzením o výpadku, který se nekonal.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("kompasTitle"),
    description: t("kompasDescription"),
  };
}

export default async function KompasRoute() {
  const data = await getKompas();
  if (!data) {
    const t = await getTranslations("votetrack");
    return (
      <DataUnavailable
        what={t("kompas.unavailableWhat")}
        backHref="/hlasovani"
        backLabel={t("kompas.backToVotes")}
      />
    );
  }
  return <KompasPage data={data} />;
}
