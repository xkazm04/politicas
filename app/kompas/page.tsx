import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import KompasPage from "@/features/votetrack/kompas/KompasPage";
import KompasNeverComputed from "@/features/votetrack/kompas/KompasNeverComputed";
import { getKompas } from "@/features/votetrack/getKompas";

/*
 * /kompas — Volební kompas naruby (moonshot 5B). Tenká routa: server načte
 * reálný záznam (getKompas: výběr otázek zveřejněným pravidlem + poziční
 * záznam vybraných hlasování) a předá klientovi; shoda se počítá u čtenáře
 * a celý výsledek žije v adrese (?hlasy=…).
 *
 * TŘI různé neúspěchy, tři různé věty. `null` znamená VÝPADEK — store není nebo
 * se z něj nedá číst — a jen ten vykresluje DataUnavailable. `never-computed`
 * (2026-08-12) znamená, že se čtení POVEDLO a tematická vrstva je prázdná: nikdy
 * se nespočítala, což není totéž co nedostupný zdroj. A výběr, který nad
 * přečteným záznamem poctivě nevybral ani jednu otázku, vrací záznam s prázdnými
 * otázkami a vlastní větu si vykreslí KompasPage. Do 2026-08-11 končily všechny
 * tři stejnou hláškou o nedostupnosti dat, tedy tvrzením o výpadku, který se
 * nekonal.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("kompasTitle"),
    description: t("kompasDescription"),
  };
}

export default async function KompasRoute() {
  const read = await getKompas();
  if (read === null) {
    const t = await getTranslations("votetrack");
    return (
      <DataUnavailable
        what={t("kompas.unavailableWhat")}
        backHref="/hlasovani"
        backLabel={t("kompas.backToVotes")}
      />
    );
  }
  if (read.state === "never-computed") return <KompasNeverComputed />;
  return <KompasPage data={read.data} />;
}
