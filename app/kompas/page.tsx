import type { Metadata } from "next";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import KompasPage from "@/features/votetrack/kompas/KompasPage";
import { KOMPAS_COPY } from "@/features/votetrack/kompas/copy";
import { getKompas } from "@/features/votetrack/getKompas";

/*
 * /kompas — Volební kompas naruby (moonshot 5B). Tenká routa: server načte
 * reálný záznam (getKompas: výběr otázek zveřejněným pravidlem + poziční
 * záznam vybraných hlasování) a předá klientovi; shoda se počítá u čtenáře
 * a celý výsledek žije v adrese (?hlasy=…). Metadata česky přímo zde
 * (messages/*.json mimo plochu — precedens /denik, /dukazy).
 */

export const metadata: Metadata = {
  title: "Volební kompas naruby — Politicas",
  description:
    "Obrácená volební kalkulačka: zaujměte postoj ke skutečným hlasováním sněmovny a spočítejte si — deterministicky, z uložených jmenovitých hlasů PSP10 — kteří poslanci a kluby hlasovali jako vy. Výsledek je v odkazu, žádný účet.",
};

export default async function KompasRoute() {
  const data = await getKompas();
  if (!data) {
    return (
      <DataUnavailable
        what={KOMPAS_COPY.unavailableWhat}
        backHref="/hlasovani"
        backLabel={KOMPAS_COPY.backToVotes}
      />
    );
  }
  return <KompasPage data={data} />;
}
